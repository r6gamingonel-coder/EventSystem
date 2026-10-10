// Thumbnails, metadata, playlists, compliance gate, monetization readiness.
import express, { Router } from 'express';
import { z } from 'zod';
import { validate } from '../lib/http.js';
import { notFound } from '../lib/errors.js';
import { THUMB_TEMPLATES } from '../art/thumbnail.js';

export default function publishingRoutes(ctx) {
  const { auth, publishing, projects, media, cfg } = ctx;
  const r = Router();
  const W = auth.requirePerm('write'); const REV = auth.requirePerm('review'); const OWN = auth.requirePerm('admin');

  // ---- thumbnails ----
  r.get('/thumbnail-templates', (_req, res) => res.json({ templates: Object.entries(THUMB_TEMPLATES).map(([id, t]) => ({ id, label: t.label })) }));
  r.get('/projects/:id/thumbnails', (req, res) => {
    const p = projects.must(req.params.id);
    res.json({ selectedAssetId: p.package.thumbnail.selectedAssetId, params: p.package.thumbnail, assets: media.list({ projectId: p.id, kind: 'thumbnail' }).map((a) => ({ ...a, path: undefined })) });
  });
  r.post('/projects/:id/thumbnails/generate', W, async (req, res) => {
    const b = validate(z.object({ variants: z.array(z.enum(['A', 'B', 'C'])).min(1).max(3).optional(), overrides: z.object({ template: z.string().optional(), title: z.string().max(60).optional(), glyph: z.string().max(4).optional(), accent: z.string().max(20).optional(), characters: z.array(z.object({ slug: z.string(), emotion: z.string().optional() })).max(3).optional(), concept: z.string().max(500).optional() }).optional() }), req.body);
    const assets = await publishing.generateThumbnails(req.params.id, { variants: b.variants, overrides: b.overrides });
    res.json({ assets: assets.map((a) => ({ ...a, path: undefined })) });
  });
  r.post('/projects/:id/thumbnails/select', W, (req, res) => res.json({ asset: { ...publishing.selectThumbnail(req.params.id, validate(z.object({ assetId: z.string() }), req.body).assetId), path: undefined } }));
  r.post('/projects/:id/thumbnails/upload', W, express.raw({ type: () => true, limit: `${cfg.maxUploadMb}mb` }), async (req, res) => {
    projects.must(req.params.id);
    const a = await media.importUpload({ projectId: req.params.id, buffer: req.body, filename: req.query.filename || 'thumbnail', kindHint: 'image', license: { source: String(req.query.licenseSource || 'Owner artwork'), license: 'Own work', commercialUse: true } });
    if (a.kind !== 'image') { media.remove(a.id); throw notFound('Image'); }
    publishing.selectThumbnail(req.params.id, a.id);
    res.status(201).json({ asset: { ...a, path: undefined } });
  });
  r.get('/projects/:id/thumbnails/check', async (req, res) => res.json(await publishing.checkThumbnail(projects.must(req.params.id))));

  // ---- metadata ----
  r.get('/projects/:id/metadata/suggest', (req, res) => res.json({ suggestion: publishing.suggestMetadata(projects.must(req.params.id)), issues: publishing.validateMetadata(projects.must(req.params.id)) }));
  r.get('/projects/:id/metadata/validate', (req, res) => res.json({ issues: publishing.validateMetadata(projects.must(req.params.id)) }));
  r.get('/playlists', (_req, res) => res.json({ playlists: publishing.playlists.list() }));
  r.post('/playlists', W, (req, res) => res.status(201).json({ playlist: publishing.playlists.create(validate(z.object({ title: z.string().min(1).max(120), description: z.string().max(500).optional() }), req.body)) }));
  r.delete('/playlists/:id', W, (req, res) => { publishing.playlists.remove(req.params.id); res.json({ ok: true }); });

  // ---- compliance ----
  r.get('/projects/:id/compliance', async (req, res) => res.json(await publishing.evaluate(req.params.id)));
  r.get('/compliance/manual-items', (_req, res) => res.json({ items: publishing.MANUAL.map(([id, label]) => ({ id, label })) }));
  r.put('/projects/:id/compliance/review', REV, async (req, res) => {
    const b = validate(z.object({ audience: z.object({ madeForKids: z.boolean(), rationale: z.string().min(5).max(800) }).optional(), manual: z.record(z.string(), z.boolean()).optional(), notes: z.string().max(1000).optional() }), req.body);
    publishing.saveReview(req.params.id, b, req.user);
    res.json(await publishing.evaluate(req.params.id));
  });
  r.post('/projects/:id/compliance/approve', REV, async (req, res) => res.json(await publishing.approve(req.params.id, req.user)));
  r.post('/projects/:id/compliance/request-changes', REV, async (req, res) => res.json(await publishing.requestChanges(req.params.id, req.body?.notes, req.user)));

  // ---- monetization readiness ----
  r.get('/monetization', (_req, res) => res.json(publishing.readiness.get()));
  r.put('/monetization', OWN, (req, res) => res.json(publishing.readiness.save(validate(z.object({ answers: z.record(z.string(), z.union([z.boolean(), z.number().min(0)])) }), req.body).answers)));
  return r;
}
