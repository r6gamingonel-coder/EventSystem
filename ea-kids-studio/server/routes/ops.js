// YouTube, analytics, costs, calendar, backups, audit log, system diagnostics.
import fs from 'node:fs';
import express, { Router } from 'express';
import { z } from 'zod';
import { validate } from '../lib/http.js';
import { newId } from '../lib/security.js';
import { toCsv } from '../services/analytics.js';
import { now } from '../db.js';

export default function opsRoutes(ctx) {
  const { auth, youtube, analytics, costs, db, backup, jobs, projects, cfg, caps } = ctx;
  const r = Router();
  const OWN = auth.requirePerm('publish'); const ADM = auth.requirePerm('admin'); const SP = auth.requirePerm('spend'); const W = auth.requirePerm('write');

  // ---------------------------------------------------------------- YouTube
  r.get('/youtube/status', (_req, res) => res.json(youtube.status()));
  r.post('/youtube/connect', OWN, (req, res) => res.json({ url: youtube.authUrl(req.user.id, validate(z.object({ scopes: z.array(z.enum(['upload', 'read', 'manage', 'analytics', 'revenue'])).min(1).default(['upload', 'read', 'analytics']) }), req.body).scopes) }));
  // OAuth redirect target. Open route (the browser arrives from Google without our SameSite=Strict cookie); the one-time
  // `state` (bound to the user who started the flow, plus PKCE) is the authentication. We answer with an HTML page that
  // navigates same-origin so the session cookie is sent on the next request.
  r.get('/youtube/oauth/callback', async (req, res) => {
    const page = (msg, ok) => res.type('html').send(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="${ok ? 1 : 4};url=/#/youtube"><title>EA KIDS Studio</title><body style="font-family:sans-serif;padding:2rem"><h2>${ok ? '✅ Connected' : '⚠️ Not connected'}</h2><p>${msg.replace(/[<>&]/g, '')}</p><p>Returning to the dashboard…</p>`);
    try { const s = await youtube.handleCallback({ code: String(req.query.code || ''), state: String(req.query.state || ''), error: req.query.error ? String(req.query.error) : undefined }); page(`Channel: ${s.channel?.title || 'connected'}`, true); }
    catch (e) { page(e.message || 'Authorization failed.', false); }
  });
  r.post('/youtube/disconnect', OWN, async (_req, res) => { await youtube.disconnect(); res.json({ ok: true }); });
  r.post('/youtube/refresh', OWN, async (_req, res) => res.json({ channel: await youtube.refreshChannelInfo() }));
  r.get('/youtube/uploads', (req, res) => res.json({ uploads: youtube.listUploads(req.query.projectId) }));
  r.post('/projects/:id/youtube/dry-run', auth.requirePerm('render'), async (req, res) => {
    const b = validate(z.object({ privacy: z.enum(['private', 'unlisted', 'public']).default('private'), publishAt: z.string().datetime().optional(), playlist: z.string().max(120).optional(), containsSyntheticMedia: z.boolean().optional() }), req.body);
    res.json(await youtube.dryRun(req.params.id, b, req.user));
  });
  r.post('/youtube/uploads/:uploadId/approve', OWN, async (req, res) => res.status(202).json(await youtube.approveUpload(req.params.uploadId, validate(z.object({ confirm: z.string(), confirmPublic: z.boolean().optional() }), req.body), req.user)));
  r.post('/youtube/analytics/sync', OWN, (req, res) => res.status(202).json({ job: jobs.enqueue('youtube_analytics_sync', { payload: validate(z.object({ days: z.number().int().min(1).max(365).default(28) }), req.body), createdBy: req.user.id }) }));

  // Manual export workflow (no API needed): everything to upload by hand in YouTube Studio.
  r.get('/projects/:id/manual-export', async (req, res) => {
    const p = projects.must(req.params.id); const plan = await youtube.buildPayload(p.id, { privacy: 'private' });
    const subs = ctx.media.list({ projectId: p.id, kind: 'subtitle' });
    res.json({ title: plan.payload.snippet.title, description: plan.payload.snippet.description, tags: plan.payload.snippet.tags, language: plan.payload.snippet.defaultLanguage, madeForKids: plan.payload.status.selfDeclaredMadeForKids,
      files: [plan.video && { label: 'Video (MP4)', assetId: plan.video.assetId, filename: plan.video.filename }, ...ctx.media.list({ projectId: p.id, kind: 'thumbnail' }).filter((a) => a.id === p.package.thumbnail.selectedAssetId).map((a) => ({ label: 'Thumbnail', assetId: a.id, filename: a.filename })), ...subs.map((a) => ({ label: `Captions (${a.filename.split('.').pop().toUpperCase()})`, assetId: a.id, filename: a.filename }))].filter(Boolean),
      steps: ['Open YouTube Studio → Create → Upload videos and choose the MP4.', 'Paste the title, description and tags above.', 'Audience: choose the setting you decided in Compliance (made for kids = Yes).', 'Upload the thumbnail and the SRT/VTT captions.', 'Choose Private/Unlisted first, watch it once on YouTube, then publish or schedule.'] });
  });

  // ---------------------------------------------------------------- analytics
  r.get('/analytics/summary', (req, res) => res.json(analytics.summary({ days: Math.min(365, Number(req.query.days) || 28), source: req.query.source })));
  r.get('/analytics/production', (_req, res) => res.json({ videos: analytics.production() }));
  r.post('/analytics/import', W, express.text({ type: () => true, limit: '5mb' }), (req, res) => res.json(analytics.importCsv(String(req.body || ''))));
  r.get('/analytics/export.csv', (req, res) => res.type('text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="eakids-analytics.csv"').send(toCsv(analytics.exportRows())));
  r.get('/analytics/production.csv', (_req, res) => res.type('text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="eakids-production.csv"').send(toCsv([['project', 'category', 'format', 'status', 'machine_seconds', 'cost_usd', 'cost_price_verified'], ...analytics.production().map((v) => [v.title, v.category, v.format, v.status, v.machineSeconds, v.costUsd, v.costVerified])])));

  // ---------------------------------------------------------------- costs
  r.get('/costs/summary', (_req, res) => res.json({ ...costs.usageSummary(), recent: db.all('SELECT * FROM usage_costs ORDER BY ts DESC LIMIT 100'), pricing: costs.PRICING }));
  r.post('/costs/estimate', (req, res) => res.json(costs.estimate(validate(z.object({ kind: z.enum(['llm', 'tts', 'image']), provider: z.string(), model: z.string().optional(), inputTokens: z.number().optional(), outputTokens: z.number().optional(), chars: z.number().optional(), images: z.number().optional() }), req.body))));
  r.get('/projects/:id/costs', (req, res) => res.json(costs.projectCosts(req.params.id)));
  r.post('/costs/manual', SP, (req, res) => { const b = validate(z.object({ projectId: z.string().optional(), provider: z.string().min(1).max(60), operation: z.string().min(1).max(80), amountUsd: z.number().min(0).max(100000), note: z.string().max(300).optional() }), req.body); costs.record({ projectId: b.projectId, provider: b.provider, operation: b.operation, est: { estimateUsd: b.amountUsd, verified: true }, kind: 'manual', note: b.note || '' }); res.status(201).json({ ok: true }); });

  // ---------------------------------------------------------------- calendar (scheduled projects + custom entries)
  r.get('/calendar', (_req, res) => {
    const entries = db.all('SELECT * FROM calendar_events ORDER BY date');
    const scheduled = db.all("SELECT id, title, scheduled_at, status, format FROM projects WHERE scheduled_at IS NOT NULL").map((p) => ({ id: `proj_${p.id}`, title: p.title, date: p.scheduled_at.slice(0, 10), kind: 'publish', project_id: p.id, notes: p.status }));
    res.json({ events: [...entries, ...scheduled].sort((a, b) => a.date.localeCompare(b.date)) });
  });
  r.post('/calendar', W, (req, res) => { const b = validate(z.object({ title: z.string().min(1).max(160), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kind: z.enum(['note', 'script', 'render', 'review', 'publish']).default('note'), projectId: z.string().optional(), notes: z.string().max(500).optional() }), req.body); const id = newId('ev_'); db.run('INSERT INTO calendar_events(id,title,date,kind,project_id,notes,created_at) VALUES (?,?,?,?,?,?,?)', id, b.title, b.date, b.kind, b.projectId ?? null, b.notes ?? '', now()); res.status(201).json({ id }); });
  r.delete('/calendar/:id', W, (req, res) => { db.run('DELETE FROM calendar_events WHERE id = ?', req.params.id); res.json({ ok: true }); });
  r.patch('/projects/:id/schedule', auth.requirePerm('publish'), (req, res) => res.json({ project: projects.updateMeta(req.params.id, validate(z.object({ scheduledAt: z.string().datetime().nullable() }), req.body)) }));

  // ---------------------------------------------------------------- backups, audit, diagnostics
  r.get('/backups', ADM, (_req, res) => res.json({ backups: backup.list() }));
  r.post('/backups', ADM, async (req, res) => { const out = backup.create(); const media = req.body?.includeMedia ? await backup.createMediaArchive() : null; backup.prune(); res.status(201).json({ ...out, media }); });
  r.get('/backups/:name', ADM, (req, res) => res.download(backup.file(req.params.name)));
  r.get('/audit', ADM, (_req, res) => res.json({ entries: db.all('SELECT a.*, u.email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 200') }));
  r.get('/diagnostics', ADM, async (_req, res) => {
    const c = await caps.detect(true);
    const disk = fs.statfsSync ? (() => { try { const s = fs.statfsSync(cfg.dataDir); return { freeBytes: s.bavail * s.bsize, totalBytes: s.blocks * s.bsize }; } catch { return null; } })() : null;
    res.json({ capabilities: c, disk, node: process.version, dbBytes: fs.statSync(cfg.dbFile).size, env: cfg.env, bind: `${cfg.host}:${cfg.port}`, secureCookies: cfg.secureCookies });
  });
  return r;
}
