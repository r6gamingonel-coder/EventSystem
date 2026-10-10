// Registries, lesson kits, ideas, characters, jobs and asset file access.
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import * as R from '../content/registry.js';
import { KIT_LIST } from '../content/kits.js';
import { PALETTE } from '../art/palette.js';
import { ANIMALS_DEF } from '../art/animals.js';

export default function libraryRoutes(ctx) {
  const { auth, ideas, characters, jobs, media } = ctx;
  const r = Router();
  const W = auth.requirePerm('write');

  r.get('/registry', (_req, res) => res.json({
    categories: R.CATEGORIES, backgrounds: R.BACKGROUNDS, props: R.PROPS, animals: R.ANIMALS.map((k) => ({ key: k, nameAr: ANIMALS_DEF[k].nameAr })), characters: R.CHARACTER_SLUGS,
    emotions: R.EMOTION_KEYS, anims: R.ANIMS, cameraMoves: R.CAMERA_MOVES, transitions: R.TRANSITIONS, sfx: R.SFX, mediaTypes: R.MEDIA_TYPES, sceneKinds: R.SCENE_KINDS,
    visualStyles: R.VISUAL_STYLES, narrationStyles: R.NARRATION_STYLES, difficulties: R.DIFFICULTIES, formats: R.FORMATS, palette: PALETTE,
  }));
  r.get('/kits', (_req, res) => res.json({ kits: KIT_LIST }));

  // ---- ideas ----
  const Idea = z.object({ title: z.string().min(1).max(200), description: z.string().max(2000).optional(), category: z.string().optional(), language: z.enum(['ar', 'en']).optional(), ageMin: z.number().int().optional(), ageMax: z.number().int().optional(), status: z.enum(['new', 'planned', 'in_production', 'done', 'archived']).optional(), tags: z.array(z.string().max(40)).max(20).optional(), projectId: z.string().nullable().optional() });
  r.get('/ideas', (req, res) => res.json({ ideas: ideas.list({ status: req.query.status, category: req.query.category, q: req.query.q }) }));
  r.post('/ideas', W, (req, res) => res.status(201).json({ idea: ideas.create(validate(Idea, req.body)) }));
  r.patch('/ideas/:id', W, (req, res) => res.json({ idea: ideas.update(req.params.id, validate(Idea.partial(), req.body)) }));
  r.delete('/ideas/:id', W, (req, res) => { ideas.remove(req.params.id); res.json({ ok: true }); });

  // ---- characters ----
  const Char = z.object({ slug: z.string().max(40).optional(), nameAr: z.string().min(1).max(60), nameEn: z.string().max(60).optional(), species: z.string().max(60).optional(), description: z.string().max(1500).optional(), colors: z.record(z.string(), z.string()).optional(), features: z.string().max(1500).optional(), personality: z.string().max(800).optional(), eduRole: z.string().max(400).optional(), voice: z.any().optional(), approvedPrompts: z.array(z.string().max(1500)).max(20).optional() });
  r.get('/characters', (req, res) => res.json({ characters: characters.list({ archived: req.query.archived === '1' }) }));
  r.post('/characters', W, (req, res) => res.status(201).json({ character: characters.create(validate(Char, req.body)) }));
  r.get('/characters/:id', (req, res) => { const c = characters.get(req.params.id); if (!c) throw notFound('Character'); res.json({ character: c, versions: characters.versions(c.id), references: media.list({ characterId: c.id }).map((a) => ({ ...a, path: undefined })) }); });
  r.patch('/characters/:id', W, (req, res) => res.json({ character: characters.update(req.params.id, validate(Char.partial(), req.body)) }));
  r.post('/characters/:id/archive', W, (req, res) => { characters.archive(req.params.id, req.body?.archived !== false); res.json({ ok: true }); });

  // ---- jobs & logs ----
  r.get('/jobs', (req, res) => res.json({ jobs: jobs.list({ projectId: req.query.projectId, status: req.query.status, limit: Math.min(200, Number(req.query.limit) || 60) }) }));
  r.get('/jobs/:id', (req, res) => { const j = jobs.get(req.params.id); if (!j) throw notFound('Job'); res.json({ job: j, logs: jobs.logs(j.id, Number(req.query.after) || 0) }); });
  r.post('/jobs/:id/cancel', auth.requirePerm('render'), (req, res) => res.json({ job: jobs.cancel(req.params.id) }));
  r.post('/jobs/:id/retry', auth.requirePerm('render'), (req, res) => res.json({ job: jobs.retry(req.params.id) }));
  r.get('/projects/:id/logs', (req, res) => res.json({ logs: jobs.projectLogs(req.params.id, Math.min(500, Number(req.query.limit) || 200)) }));

  // ---- asset file / metadata ----
  r.get('/assets', (req, res) => res.json({ assets: media.list({ library: req.query.library === '1', kind: req.query.kind }).map((a) => ({ ...a, path: undefined })) }));
  r.get('/assets/:id/file', (req, res) => {
    const a = media.get(req.params.id); if (!a) throw notFound('Asset');
    res.set({ 'Content-Type': a.mime, 'Cache-Control': 'private, max-age=60', 'X-Content-Type-Options': 'nosniff', ...(req.query.download ? { 'Content-Disposition': `attachment; filename="${encodeURIComponent(a.filename)}"` } : {}) });
    res.sendFile(media.abs(a.path), { dotfiles: 'deny' }, (e) => { if (e && !res.headersSent) res.status(404).json({ error: { code: 'FILE_MISSING', message: 'The media file is missing on disk.', hint: 'Regenerate or re-import it.' } }); });
  });
  r.patch('/assets/:id', W, (req, res) => {
    const b = validate(z.object({ license: z.object({ source: z.string().max(200), license: z.string().max(200), commercialUse: z.boolean().nullable(), attribution: z.string().max(300).optional(), proofUrl: z.string().max(400).optional() }).optional(), reviewStatus: z.enum(['pending', 'approved', 'rejected']).optional(), reviewNote: z.string().max(500).optional() }), req.body);
    if (b.license) media.setLicense(req.params.id, { attribution: '', proofUrl: '', ...b.license });
    if (b.reviewStatus) media.review(req.params.id, b.reviewStatus, b.reviewNote);
    res.json({ asset: { ...media.get(req.params.id), path: undefined } });
  });
  r.delete('/assets/:id', W, (req, res) => { media.remove(req.params.id); res.json({ ok: true }); });
  return r;
}
