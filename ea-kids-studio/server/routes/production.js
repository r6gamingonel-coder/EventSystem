// Voice & narration, pronunciation lexicon, rendering/preview, subtitle export.
import express, { Router } from 'express';
import { z } from 'zod';
import { validate } from '../lib/http.js';
import { AppError, notFound } from '../lib/errors.js';
import { newId } from '../lib/security.js';
import { TTS_INFO, VOICES } from '../providers/tts.js';
import { toSrt, toVtt } from '../content/timing.js';
import { FORMATS } from '../content/registry.js';

export default function productionRoutes(ctx) {
  const { auth, narration, render, jobs, costs, projects, media, db, cfg, caps } = ctx;
  const r = Router();
  const W = auth.requirePerm('write'); const G = auth.requirePerm('generate'); const RN = auth.requirePerm('render');

  // ---- providers / voices ----
  r.get('/tts/providers', async (_req, res) => {
    const c = await caps.detect();
    res.json({ providers: Object.entries(TTS_INFO).map(([id, v]) => ({ id, label: v.label, quality: v.quality, paid: v.paid, configured: !!c.providers.tts[id]?.configured, env: c.providers.tts[id]?.env || '' })).concat([{ id: 'import', label: 'Import your own recording', quality: 'owner-recorded', paid: false, configured: true, env: '' }]), voices: VOICES, settings: narration.settings() });
  });
  r.put('/tts/settings', W, (req, res) => { const s = validate(z.object({ provider: z.enum(['espeak', 'azure', 'openai', 'elevenlabs', 'google']), voice: z.string().max(80).default(''), speed: z.number().min(0.6).max(1.4) }), req.body); narration.saveSettings(s); res.json({ settings: narration.settings() }); });
  r.post('/tts/preview', G, (req, res) => {
    const b = validate(z.object({ provider: z.enum(['espeak', 'azure', 'openai', 'elevenlabs', 'google']), voice: z.string().max(80).default(''), speed: z.number().min(0.6).max(1.4).default(1), language: z.enum(['ar', 'en']).default('ar'), text: z.string().min(1).max(300), confirmCost: z.number().min(0).optional() }), req.body);
    const est = costs.estimate({ kind: 'tts', provider: b.provider, chars: b.text.length }); costs.authorize(est, { confirmCost: b.confirmCost, user: req.user });
    const job = jobs.enqueue('tts_preview', { payload: b, createdBy: req.user.id, costEstimateUsd: est.estimateUsd, costConfirmed: est.paid });
    if (est.paid) costs.record({ jobId: job.id, provider: b.provider, operation: 'tts.preview', est, units: b.text.length, unit: 'chars' });
    res.status(202).json({ job, estimate: est });
  });

  // ---- pronunciation lexicon ----
  r.get('/pronunciations', (req, res) => res.json({ entries: db.all('SELECT * FROM pronunciations WHERE language = ? ORDER BY word', req.query.language || 'ar') }));
  r.post('/pronunciations', W, (req, res) => {
    const b = validate(z.object({ language: z.enum(['ar', 'en']).default('ar'), word: z.string().min(1).max(60), replacement: z.string().min(1).max(120), note: z.string().max(200).optional() }), req.body);
    db.run('INSERT INTO pronunciations(id,language,word,replacement,note) VALUES (?,?,?,?,?) ON CONFLICT(language,word) DO UPDATE SET replacement=excluded.replacement, note=excluded.note', newId('pr_'), b.language, b.word, b.replacement, b.note || '');
    res.status(201).json({ ok: true });
  });
  r.delete('/pronunciations/:id', W, (req, res) => { db.run('DELETE FROM pronunciations WHERE id = ?', req.params.id); res.json({ ok: true }); });

  // ---- narration ----
  r.get('/projects/:id/narration', (req, res) => {
    const p = projects.must(req.params.id);
    res.json({ status: narration.status(p), settings: narration.settings(), assets: media.list({ projectId: p.id, kind: 'audio' }).filter((a) => a.meta.key === 'narration').map((a) => ({ ...a, path: undefined })) });
  });
  r.post('/projects/:id/narration/generate', G, (req, res) => {
    const b = validate(z.object({ sceneIds: z.array(z.string()).optional(), provider: z.enum(['espeak', 'azure', 'openai', 'elevenlabs', 'google']).optional(), voice: z.string().max(80).optional(), speed: z.number().min(0.6).max(1.4).optional(), force: z.boolean().optional(), confirmCost: z.number().min(0).optional() }), req.body);
    const p = projects.must(req.params.id);
    const s = { ...narration.settings(), ...Object.fromEntries(Object.entries(b).filter(([k, v]) => ['provider', 'voice', 'speed'].includes(k) && v !== undefined)) };
    // only scenes that actually need synthesis count toward the estimate
    const st = narration.status(p);
    const need = p.package.scenes.filter((sc) => sc.narration && (!b.sceneIds || b.sceneIds.includes(sc.id)) && (b.force || st.find((x) => x.sceneId === sc.id)?.state !== 'fresh')).map((sc) => sc.id);
    if (!need.length) return res.status(200).json({ upToDate: true, message: 'Narration is already up to date for the selected scenes.' });
    const est = narration.estimate(p, need, s.provider);
    costs.authorize(est, { confirmCost: b.confirmCost, user: req.user });
    const job = jobs.enqueue('synthesize_narration', { projectId: p.id, payload: { projectId: p.id, sceneIds: need, provider: s.provider, voice: s.voice, speed: s.speed, force: !!b.force, costEstimate: est }, createdBy: req.user.id, costEstimateUsd: est.estimateUsd, costConfirmed: est.paid });
    res.status(202).json({ job, estimate: est, scenes: need.length });
  });
  r.post('/projects/:id/scenes/:sid/narration-import', W, express.raw({ type: () => true, limit: `${cfg.maxUploadMb}mb` }), async (req, res) => {
    const p = projects.must(req.params.id); const sc = p.package.scenes.find((s) => s.id === req.params.sid); if (!sc) throw notFound('Scene');
    const q = validate(z.object({ filename: z.string().max(200).optional(), licenseSource: z.string().max(200).optional() }), req.query);
    const a = await narration.importNarration(p, sc, { buffer: req.body, filename: q.filename, license: { source: q.licenseSource || 'Owner recording', license: 'Own recording', commercialUse: true } });
    res.status(201).json({ asset: { ...a, path: undefined } });
  });

  // ---- render / preview ----
  r.get('/projects/:id/timeline', (req, res) => {
    const p = projects.must(req.params.id); const fmt = FORMATS[p.format];
    const nb = {}; narration.status(p).forEach((s) => { if (s.assetId) nb[s.sceneId] = media.get(s.assetId); });
    const plan = render.planTimeline(p, { mode: 'final', width: fmt.width, height: fmt.height, fps: 30, narrationByScene: nb });
    res.json({ totalSec: +plan.total.toFixed(2), scenes: plan.items.map((it) => ({ sceneId: it.scene.id, title: it.scene.title, start: +it.start.toFixed(2), duration: +it.dur.toFixed(2), narrated: !!it.narration, mediaType: it.scene.visual.mediaType })) });
  });
  r.post('/projects/:id/render', RN, (req, res) => {
    const b = validate(z.object({ mode: z.enum(['preview', 'final']).default('final'), sceneIds: z.array(z.string()).optional(), burnCaptions: z.boolean().default(true), fps: z.number().int().refine((n) => [24, 25, 30, 50, 60].includes(n)).optional(), exportAudio: z.boolean().optional() }), req.body);
    const p = projects.must(req.params.id);
    if (jobs.list({ projectId: p.id, status: 'running' }).some((j) => j.type === 'render_video') || jobs.list({ projectId: p.id, status: 'queued' }).some((j) => j.type === 'render_video')) throw new AppError(409, 'RENDER_IN_PROGRESS', 'A render is already queued or running for this project.', { hint: 'Wait for it to finish or cancel it in Production Logs.' });
    const job = jobs.enqueue('render_video', { projectId: p.id, payload: { projectId: p.id, mode: b.mode, sceneIds: b.sceneIds, burnCaptions: b.burnCaptions, fpsOverride: b.fps, exportAudio: b.exportAudio }, createdBy: req.user.id });
    res.status(202).json({ job });
  });
  r.get('/projects/:id/scenes/:sid/still.png', async (req, res) => {
    const p = projects.must(req.params.id); const sc = p.package.scenes.find((s) => s.id === req.params.sid); if (!sc) throw notFound('Scene');
    const file = await render.sceneStill(p, sc, Math.min(1280, Math.max(160, Number(req.query.w) || 640)));
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=30' }).sendFile(file, { dotfiles: 'deny' });
  });
  r.get('/projects/:id/renders', (req, res) => res.json({ renders: media.list({ projectId: req.params.id }).filter((a) => ['render', 'preview'].includes(a.kind)).map((a) => ({ ...a, path: undefined })) }));
  r.delete('/projects/:id/render-cache', RN, (req, res) => res.json(render.clearCache(req.params.id)));

  // ---- subtitle export (SRT / VTT) from the narration timings ----
  r.get('/projects/:id/subtitles.:ext', (req, res) => {
    const ext = req.params.ext; if (!['srt', 'vtt'].includes(ext)) throw notFound('Format');
    const p = projects.must(req.params.id); const fmt = FORMATS[p.format];
    const nb = {}; narration.status(p).forEach((s) => { if (s.assetId) nb[s.sceneId] = media.get(s.assetId); });
    const plan = render.planTimeline(p, { mode: 'final', width: fmt.width, height: fmt.height, fps: 30, narrationByScene: nb });
    const cues = plan.items.flatMap((it) => (it.narration?.meta.cues?.length ? it.narration.meta.cues : it.scene.subtitles).map((c) => ({ start: it.start + (it.narration?.meta.imported ? it.leadSec : 0) + c.start, end: it.start + (it.narration?.meta.imported ? it.leadSec : 0) + Math.min(c.end, it.dur - 0.05), text: c.text })));
    res.type(ext === 'srt' ? 'application/x-subrip; charset=utf-8' : 'text/vtt; charset=utf-8').set('Content-Disposition', `attachment; filename="captions.${ext}"`).send(ext === 'srt' ? toSrt(cues) : toVtt(cues));
  });
  return r;
}
