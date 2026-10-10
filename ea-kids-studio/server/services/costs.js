// Cost estimation, spending limits and the paid-operation gate.
// Rules: (1) zero-cost/local options are the default; (2) a paid operation needs an explicit
// confirmation equal to or above the estimate; (3) daily/monthly limits default to $0, so paid
// providers stay blocked until the owner deliberately raises a limit; (4) prices are labelled
// "verified" only when they came from a reliable source we actually checked — everything else is
// shown as an unverified estimate.
import { now, getSetting } from '../db.js';
import { newId } from '../lib/security.js';
import { AppError, confirmationRequired, forbidden } from '../lib/errors.js';
import { can } from './auth.js';

const ANTHROPIC_SRC = 'Anthropic model/pricing table bundled with the Claude API reference (cached 2026-10-06). Confirm at https://platform.claude.com/docs/en/about-claude/pricing';
export const PRICING = {
  'llm:anthropic': {
    models: {
      'claude-opus-5-5': [4, 20], 'claude-opus-5': [5, 25], 'claude-sonnet-5-5': [2, 10], 'claude-sonnet-5': [2, 10],
      'claude-haiku-5-5': [0.1, 0.5], 'claude-fable-5-1': [10, 50], 'claude-fable-5': [10, 50],
    },
    unit: 'USD per 1M tokens (input, output)', verified: true, checkedAt: '2026-10-06', source: ANTHROPIC_SRC,
  },
  'llm:openai': { perMTok: [2, 8], unit: 'USD per 1M tokens (input, output)', verified: false, source: 'https://openai.com/api/pricing/ — NOT verified; check before use' },
  'llm:openai_compatible': { perMTok: [0, 0], unit: 'self-hosted (e.g. Ollama): no per-token fee', verified: true, source: 'local' },
  'tts:espeak': { perMChar: 0, unit: 'USD per 1M characters', verified: true, source: 'local, free' },
  'tts:import': { perMChar: 0, unit: 'USD per 1M characters', verified: true, source: 'your own recordings' },
  'tts:azure': { perMChar: 16, unit: 'USD per 1M characters (neural)', verified: false, source: 'https://azure.microsoft.com/pricing/details/cognitive-services/speech-services/ — NOT verified (free tier may apply)' },
  'tts:openai': { perMChar: 15, unit: 'USD per 1M characters', verified: false, source: 'https://openai.com/api/pricing/ — NOT verified' },
  'tts:google': { perMChar: 16, unit: 'USD per 1M characters (neural/WaveNet)', verified: false, source: 'https://cloud.google.com/text-to-speech/pricing — NOT verified (free tier may apply)' },
  'tts:elevenlabs': { perMChar: 180, unit: 'USD per 1M characters (plan dependent)', verified: false, source: 'https://elevenlabs.io/pricing — NOT verified; plan based, commercial use requires a paid plan' },
  'image:openai': { perImage: 0.05, unit: 'USD per image (medium quality, approx.)', verified: false, source: 'https://openai.com/api/pricing/ — NOT verified' },
  'image:local_svg': { perImage: 0, unit: 'USD per image', verified: true, source: 'local rendering' },
};

export function createCosts({ db }) {
  const limits = () => ({ dailyUsd: 0, monthlyUsd: 0, ...(getSetting(db, 'app', {}).limits || {}) });
  const spentSince = (iso) => db.get('SELECT COALESCE(SUM(est_cost_usd),0) s FROM usage_costs WHERE ts >= ?', iso).s;
  const startOfDay = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
  const startOfMonth = () => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

  function usageSummary() {
    const l = limits();
    return { limits: l, spentTodayUsd: +spentSince(startOfDay()).toFixed(4), spentMonthUsd: +spentSince(startOfMonth()).toFixed(4) };
  }

  /** @returns {{estimateUsd:number, verified:boolean, paid:boolean, breakdown:object, source:string}} */
  function estimate({ kind, provider, model, inputTokens = 0, outputTokens = 0, chars = 0, images = 0 }) {
    const key = `${kind}:${provider}`;
    const p = PRICING[key];
    if (!p) return { estimateUsd: 0, verified: false, paid: false, breakdown: { note: 'No pricing entry; treated as local/free.' }, source: '' };
    let usd = 0;
    if (kind === 'llm') {
      const [pin, pout] = p.models?.[model] || p.perMTok || [0, 0];
      usd = (inputTokens / 1e6) * pin + (outputTokens / 1e6) * pout;
    } else if (kind === 'tts') usd = (chars / 1e6) * (p.perMChar || 0);
    else if (kind === 'image') usd = images * (p.perImage || 0);
    const verified = !!p.verified && (kind !== 'llm' || !p.models || !!p.models[model] || !!p.perMTok);
    return { estimateUsd: +usd.toFixed(4), verified, paid: usd > 0, breakdown: { inputTokens, outputTokens, chars, images, unit: p.unit }, source: p.source };
  }

  /** Throws unless the paid operation is allowed. Free operations always pass. */
  function authorize(est, { confirmCost, user } = {}) {
    if (!est.paid || est.estimateUsd <= 0) return { ok: true };
    if (user && !can(user, 'spend')) throw forbidden('Only the owner can approve paid generation.');
    const l = limits();
    if (l.dailyUsd <= 0 && l.monthlyUsd <= 0) {
      throw new AppError(402, 'SPENDING_LIMIT_NOT_SET', 'Paid providers are blocked because no spending limit is set.', {
        hint: 'Open Costs → Limits and set a daily and/or monthly limit above $0. Nothing is ever purchased automatically.',
        details: { estimateUsd: est.estimateUsd },
      });
    }
    const day = spentSince(startOfDay()); const month = spentSince(startOfMonth());
    if (l.dailyUsd > 0 && day + est.estimateUsd > l.dailyUsd) throw new AppError(402, 'DAILY_LIMIT_EXCEEDED', `This would exceed your daily limit ($${l.dailyUsd}). Spent today: $${day.toFixed(2)}, estimate: $${est.estimateUsd.toFixed(2)}.`, { hint: 'Raise the limit in Costs → Limits or try again tomorrow.' });
    if (l.monthlyUsd > 0 && month + est.estimateUsd > l.monthlyUsd) throw new AppError(402, 'MONTHLY_LIMIT_EXCEEDED', `This would exceed your monthly limit ($${l.monthlyUsd}). Spent this month: $${month.toFixed(2)}, estimate: $${est.estimateUsd.toFixed(2)}.`, { hint: 'Raise the limit in Costs → Limits.' });
    if (confirmCost === undefined || confirmCost === null || Number(confirmCost) + 1e-9 < est.estimateUsd) {
      throw confirmationRequired(`This operation is estimated to cost about $${est.estimateUsd.toFixed(4)}${est.verified ? '' : ' (price NOT verified — check the provider)'}. Confirmation required.`, { ...est });
    }
    return { ok: true };
  }

  function record({ projectId = null, jobId = null, provider, operation, units = 0, unit = '', est, kind = 'estimate', note = '' }) {
    const id = newId('cost_');
    db.run('INSERT INTO usage_costs(id,project_id,job_id,provider,operation,units,unit,est_cost_usd,price_verified,kind,note,ts) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      id, projectId, jobId, provider, operation, units, unit, est?.estimateUsd ?? 0, est?.verified ? 1 : 0, kind, note, now());
    return id;
  }
  const settle = (id, usd, kind = 'actual') => db.run('UPDATE usage_costs SET est_cost_usd = ?, kind = ? WHERE id = ?', +usd.toFixed(6), kind, id);

  function projectCosts(projectId) {
    const rows = db.all('SELECT * FROM usage_costs WHERE project_id = ? ORDER BY ts', projectId);
    return { rows, totalUsd: +rows.reduce((a, r) => a + r.est_cost_usd, 0).toFixed(4), allVerified: rows.every((r) => r.price_verified || r.est_cost_usd === 0) };
  }

  return { limits, usageSummary, estimate, authorize, record, settle, projectCosts, PRICING };
}
