// Analytics: reads rows that came from the YouTube API or from a manual Studio CSV import.
// Every number is labelled with its source. Nothing is estimated or invented, and revenue is only
// shown when it exists in the data — and always labelled "estimated" (never "earned").
import { now } from '../db.js';
import { AppError } from '../lib/errors.js';

// Columns we understand in a YouTube Studio / custom CSV export (case-insensitive, EN headers).
const COLUMN_MAP = {
  views: 'views', 'watch time (hours)': 'watchHours', 'watch_time_hours': 'watchHours', impressions: 'impressions', 'impressions click-through rate (%)': 'ctrPercent', ctr: 'ctrPercent', 'ctr_percent': 'ctrPercent',
  'average view duration': 'averageViewDuration', subscribers: 'subscribersGained', 'subscribers gained': 'subscribersGained', 'estimated revenue (usd)': 'estimatedRevenue', 'estimated_revenue': 'estimatedRevenue', likes: 'likes', comments: 'comments',
};

export function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
export const toCsv = (rows) => rows.map((r) => r.map((v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');

export function createAnalytics({ db, projects }) {
  /** Import a CSV with a `date` column (YYYY-MM-DD) and optional `video_id`. Stored with source = manual_import. */
  function importCsv(text) {
    const rows = parseCsv(text); if (rows.length < 2) throw new AppError(400, 'CSV_EMPTY', 'The CSV has no data rows.');
    const head = rows[0].map((h) => h.trim().toLowerCase().replace(/^﻿/, ''));
    const di = head.indexOf('date'); const vi = head.findIndex((h) => ['video_id', 'video id', 'content'].includes(h));
    if (di < 0) throw new AppError(400, 'CSV_NO_DATE', 'The CSV needs a "date" column (YYYY-MM-DD).', { hint: 'Export from YouTube Studio → Analytics → Advanced mode (by day), or add a date column.' });
    const cols = head.map((h, i) => ({ i, metric: COLUMN_MAP[h] })).filter((c) => c.metric && c.i !== di);
    if (!cols.length) throw new AppError(400, 'CSV_NO_METRICS', `No known metric columns. Supported: ${Object.keys(COLUMN_MAP).join(', ')}`);
    let n = 0;
    db.tx(() => {
      for (const r of rows.slice(1)) {
        const date = (r[di] || '').trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const video = vi >= 0 ? (r[vi] || '').trim() : '';
        for (const c of cols) { const v = Number(String(r[c.i]).replace(/[^\d.\-]/g, '')); if (!Number.isFinite(v) || r[c.i] === '' || r[c.i] == null) continue; db.run("INSERT INTO analytics_rows(source,video_id,project_id,date,metric,value,imported_at) VALUES ('manual_import',?,?,?,?,?,?) ON CONFLICT(source,video_id,date,metric) DO UPDATE SET value=excluded.value, imported_at=excluded.imported_at", video, video ? db.get('SELECT project_id FROM youtube_uploads WHERE video_id = ?', video)?.project_id ?? null : null, date, c.metric, v, now()); n++; }
      }
    });
    if (!n) throw new AppError(400, 'CSV_NO_VALID_ROWS', 'No valid rows were found (dates must be YYYY-MM-DD, values numeric).');
    return { rowsImported: n };
  }

  const SUM = new Set(['views', 'estimatedMinutesWatched', 'subscribersGained', 'subscribersLost', 'likes', 'comments', 'shares', 'impressions', 'watchHours', 'estimatedRevenue']);
  function summary({ source, days = 28 } = {}) {
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const rows = db.all(`SELECT * FROM analytics_rows WHERE date >= ? AND date != 'retention' ${source ? 'AND source = ?' : ''} ORDER BY date`, since, ...(source ? [source] : []));
    const totals = {}; const byDay = {}; const byVideo = {}; const sources = new Set();
    for (const r of rows) {
      sources.add(r.source);
      if (r.video_id === '') { // channel-level rows
        byDay[r.date] = byDay[r.date] || {}; byDay[r.date][r.metric] = (byDay[r.date][r.metric] || 0) + r.value;
        if (SUM.has(r.metric)) totals[r.metric] = (totals[r.metric] || 0) + r.value;
      } else {
        const v = (byVideo[r.video_id] = byVideo[r.video_id] || { videoId: r.video_id, projectId: r.project_id, metrics: {} });
        if (SUM.has(r.metric)) v.metrics[r.metric] = (v.metrics[r.metric] || 0) + r.value; else { v.avg = v.avg || {}; (v.avg[r.metric] = v.avg[r.metric] || []).push(r.value); }
      }
    }
    for (const v of Object.values(byVideo)) { for (const [k, arr] of Object.entries(v.avg || {})) v.metrics[k] = +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2); delete v.avg; }
    if (totals.estimatedMinutesWatched && !totals.watchHours) totals.watchHours = +(totals.estimatedMinutesWatched / 60).toFixed(2);
    const avg = (m) => { const xs = Object.values(byDay).map((d) => d[m]).filter((x) => x != null); return xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : null; };
    // performance by topic/format: join video rows to projects
    const byTopic = {}; const byFormat = {};
    for (const v of Object.values(byVideo)) {
      const p = v.projectId && projects.get(v.projectId); if (!p) continue;
      const add = (map, key) => { const m = (map[key] = map[key] || { videos: 0, views: 0, watchMinutes: 0 }); m.videos += 1; m.views += v.metrics.views || 0; m.watchMinutes += v.metrics.estimatedMinutesWatched || 0; };
      add(byTopic, p.category); add(byFormat, p.format);
    }
    const retention = db.all("SELECT video_id, metric, value FROM analytics_rows WHERE date = 'retention' ORDER BY metric").map((r) => ({ video: r.video_id, ratio: Number(r.metric.split('@')[1]), watchRatio: r.value }));
    return {
      periodDays: days, sources: [...sources], hasData: rows.length > 0, totals, averages: { averageViewDuration: avg('averageViewDuration'), averageViewPercentage: avg('averageViewPercentage'), ctrPercent: avg('ctrPercent') },
      daily: Object.entries(byDay).map(([date, m]) => ({ date, ...m })), videos: Object.values(byVideo), byTopic, byFormat, retention,
      revenue: totals.estimatedRevenue !== undefined ? { estimatedUsd: +totals.estimatedRevenue.toFixed(2), label: 'ESTIMATED revenue from authorised analytics data — not finalised earnings, and not a payment.' } : null,
      notes: ['Impressions and click-through rate are not provided by the YouTube Analytics API; import them from a YouTube Studio CSV export.', 'Estimated revenue ≠ finalised earnings ≠ actual payments. Finalised earnings appear in AdSense; payments follow your payment threshold.'],
    };
  }

  /** Production time/cost per video, derived from real job timestamps and recorded cost rows. */
  function production() {
    return db.all('SELECT * FROM projects ORDER BY created_at DESC LIMIT 100').map((p) => {
      const j = db.all("SELECT type, started_at, finished_at, status FROM jobs WHERE project_id = ? AND status = 'succeeded'", p.id);
      const machineSec = j.reduce((a, x) => a + (x.started_at && x.finished_at ? (new Date(x.finished_at) - new Date(x.started_at)) / 1000 : 0), 0);
      const c = db.get('SELECT COALESCE(SUM(est_cost_usd),0) s, MIN(price_verified) v FROM usage_costs WHERE project_id = ?', p.id);
      return { projectId: p.id, title: p.title, category: p.category, format: p.format, status: p.status, machineSeconds: Math.round(machineSec), costUsd: +c.s.toFixed(4), costVerified: c.v === null ? true : !!c.v, createdAt: p.created_at };
    });
  }
  const exportRows = ({ days = 90 } = {}) => { const s = summary({ days }); return [['date', 'metric', 'value', 'source'], ...db.all("SELECT date, metric, value, source FROM analytics_rows WHERE date != 'retention' ORDER BY date, metric").map((r) => [r.date, r.metric, r.value, r.source])].concat(s.revenue ? [['', 'NOTE', 'estimatedRevenue is an estimate, not finalised earnings or a payment', '']] : []); };
  return { importCsv, summary, production, exportRows };
}
