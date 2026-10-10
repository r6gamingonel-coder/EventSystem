import express, { Router } from 'express';
import { z } from 'zod';
import { validate } from '../lib/http.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import * as R from '../content/registry.js';
import { briefFromProject } from '../services/generation.js';
import { totalDuration } from '../content/schema.js';

const Brief = z.object({
  title: z.string().min(1).max(160), category: z.enum(R.CATEGORIES.map((c) => c.id)), language: z.enum(['ar', 'en']).optional(),
  ageMin: z.number().int().min(1).max(12).optional(), ageMax: z.number().int().min(1).max(14).optional(),
  targetDurationSec: z.number().int().min(15).max(1800).optional(), topic: z.string().max(500).optional(),
  visualStyle: z.enum(R.VISUAL_STYLES).optional(), narrationStyle: z.enum(R.NARRATION_STYLES).optional(),
  difficulty: z.enum(R.DIFFICULTIES).optional(), format: z.enum(['landscape', 'shorts']).optional(),
});
const GenBody = z.object({
  provider: z.string().default('offline_templates'), kit: z.string().optional(), topic: z.string().max(800).optional(), notes: z.string().max(1500).optional(),
  characters: z.array(z.string()).max(4).optional(), itemCount: z.number().int().min(1).max(30).optional(), noBookends: z.boolean().optional(), confirmCost: z.number().min(0).optional(),
});
const ScenePatch = z.object({
  title: z.string().max(120).optional(), kind: z.string().optional(), narration: z.string().max(3000).optional(), narrationSpeed: z.number().optional(), durationSec: z.number().optional(), durationMode: z.enum(['auto', 'manual']).optional(),
  subtitles: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })).optional(),
  visual: z.any().optional(), camera: z.any().optional(), animationNotes: z.string().optional(), characterNotes: z.string().optional(), audio: z.any().optional(), transition: z.string().optional(), locked: z.boolean().optional(), review: z.any().optional(),
}).strict();

export default function projectRoutes(ctx) {
  const { auth, projects, jobs, llm, costs, media, db, cfg } = ctx;
  const r = Router();
  const W = auth.requirePerm('write'); const G = auth.requirePerm('generate'); const REV = auth.requirePerm('review');

  r.get('/', (req, res) => res.json({ projects: projects.list({ status: req.query.status, category: req.query.category, q: req.query.q }) }));
  r.post('/', W, (req, res) => res.status(201).json({ project: projects.create(validate(Brief, req.body), req.user.id) }));
  r.get('/:id', (req, res) => {
    const p = projects.must(req.params.id);
    res.json({ project: p, totalDurationSec: +totalDuration(p.package).toFixed(1), assets: media.list({ projectId: p.id }).map((a) => ({ ...a, path: undefined })), versions: projects.listVersions(p.id), jobs: jobs.list({ projectId: p.id, limit: 30 }), costs: costs.projectCosts(p.id) });
  });
  r.patch('/:id', W, (req, res) => res.json({ project: projects.updateMeta(req.params.id, validate(Brief.partial().extend({ scheduledAt: z.string().nullable().optional() }), req.body)) }));
  r.delete('/:id', auth.requirePerm('admin'), (req, res) => { projects.remove(req.params.id); res.json({ ok: true }); });

  // ---- generation (job + cost gate) ----
  r.post('/:id/generate', G, (req, res) => {
    const body = validate(GenBody, req.body);
    const p = projects.must(req.params.id);
    const brief = briefFromProject(p, body);
    const paidProviders = ['anthropic', 'openai'];
    let est = { estimateUsd: 0, paid: false, verified: true, breakdown: {} };
    if (body.provider !== 'offline_templates') {
      const t = llm.estimateTokens(brief);
      est = costs.estimate({ kind: 'llm', provider: body.provider, model: llm.modelFor(body.provider), ...t });
      if (paidProviders.includes(body.provider) && est.estimateUsd === 0) est.paid = true;
      costs.authorize(est, { confirmCost: body.confirmCost, user: req.user });
    }
    const job = jobs.enqueue('generate_package', { projectId: p.id, payload: { projectId: p.id, provider: body.provider, brief, costEstimate: est, userId: req.user.id }, createdBy: req.user.id, costEstimateUsd: est.estimateUsd, costConfirmed: est.paid });
    res.status(202).json({ job, estimate: est });
  });

  r.put('/:id/package', W, (req, res) => {
    const pkg = validate(z.object({ package: z.any(), snapshot: z.boolean().optional(), label: z.string().max(120).optional() }), req.body);
    res.json({ project: projects.savePackage(req.params.id, pkg.package, { snap: pkg.snapshot, label: pkg.label, userId: req.user.id }) });
  });
  r.patch('/:id/overview', W, (req, res) => res.json({ project: projects.setOverview(req.params.id, validate(z.object({ objective: z.string().max(1000).optional(), outcomes: z.array(z.string()).optional(), music: z.any().optional() }), req.body)) }));
  r.patch('/:id/metadata', W, (req, res) => res.json({ project: projects.setMetadata(req.params.id, validate(z.object({ title: z.string().max(100).optional(), description: z.string().max(5000).optional(), tags: z.array(z.string().max(60)).max(30).optional(), chapters: z.array(z.any()).optional(), language: z.string().optional(), playlist: z.string().max(120).optional(), thumbnailFilename: z.string().max(120).optional() }), req.body)) }));
  r.put('/:id/checklist', REV, (req, res) => res.json({ project: projects.setChecklist(req.params.id, validate(z.object({ items: z.array(z.object({ id: z.string().optional(), text: z.string(), done: z.boolean() })) }), req.body).items) }));
  r.put('/:id/factcheck', REV, (req, res) => res.json({ project: projects.setFactCheck(req.params.id, validate(z.object({ items: z.array(z.object({ claim: z.string(), status: z.enum(['unverified', 'verified', 'disputed']), source: z.string().optional() })) }), req.body).items) }));

  // ---- versions ----
  r.get('/:id/versions', (req, res) => res.json({ versions: projects.listVersions(req.params.id) }));
  r.post('/:id/versions', W, (req, res) => res.status(201).json({ version: projects.snapshot(req.params.id, validate(z.object({ label: z.string().max(120).optional() }), req.body).label || 'Manual save', req.user.id) }));
  r.get('/:id/versions/:no', (req, res) => res.json({ version: projects.getVersion(req.params.id, Number(req.params.no)) }));
  r.get('/:id/versions/:a/diff/:b', (req, res) => res.json({ diff: projects.diffVersions(req.params.id, Number(req.params.a), req.params.b) }));
  r.post('/:id/versions/:no/restore', W, (req, res) => res.json({ project: projects.restore(req.params.id, Number(req.params.no), req.user.id) }));

  // ---- scenes ----
  r.post('/:id/scenes', W, (req, res) => res.status(201).json({ scene: projects.addScene(req.params.id, req.body?.scene || {}, req.body?.afterId, req.user.id) }));
  r.patch('/:id/scenes/:sid', W, (req, res) => res.json({ scene: projects.updateScene(req.params.id, req.params.sid, validate(ScenePatch, req.body), req.user.id) }));
  r.delete('/:id/scenes/:sid', W, (req, res) => { projects.deleteScene(req.params.id, req.params.sid, req.user.id); res.json({ ok: true }); });
  r.post('/:id/scenes/:sid/duplicate', W, (req, res) => res.status(201).json({ scene: projects.duplicateScene(req.params.id, req.params.sid, req.user.id) }));
  r.post('/:id/scenes/:sid/move', W, (req, res) => res.json({ project: projects.moveScene(req.params.id, req.params.sid, validate(z.object({ direction: z.enum(['up', 'down']) }), req.body).direction, req.user.id) }));
  r.post('/:id/scenes/:sid/review', REV, (req, res) => {
    const b = validate(z.object({ status: z.enum(['approved', 'rejected', 'pending']), note: z.string().max(500).optional() }), req.body);
    res.json({ scene: projects.reviewScene(req.params.id, req.params.sid, b.status, b.note, req.user.id) });
  });
  r.post('/:id/scenes/:sid/revise', G, (req, res) => {
    const b = validate(z.object({ instruction: z.string().min(3).max(1000), provider: z.string(), confirmCost: z.number().min(0).optional() }), req.body);
    const p = projects.must(req.params.id);
    const scene = p.package.scenes.find((s) => s.id === req.params.sid); if (!scene) throw notFound('Scene');
    if (scene.locked) throw new AppError(409, 'SCENE_LOCKED', 'This scene is locked. Unlock it before AI revision.');
    if (b.provider === 'offline_templates') throw new AppError(412, 'NOT_CONFIGURED', 'AI scene revision needs an AI provider.', { hint: 'Configure Anthropic, OpenAI or a local OpenAI-compatible model in AI Providers — or edit the scene fields directly.' });
    const est = costs.estimate({ kind: 'llm', provider: b.provider, model: llm.modelFor(b.provider), inputTokens: 3000, outputTokens: 1500 });
    if (['anthropic', 'openai'].includes(b.provider) && est.estimateUsd === 0) est.paid = true;
    costs.authorize(est, { confirmCost: b.confirmCost, user: req.user });
    const job = jobs.enqueue('revise_scene', { projectId: p.id, sceneId: scene.id, payload: { projectId: p.id, sceneId: scene.id, instruction: b.instruction, provider: b.provider, costEstimate: est, userId: req.user.id }, createdBy: req.user.id, costEstimateUsd: est.estimateUsd, costConfirmed: est.paid });
    res.status(202).json({ job, estimate: est });
  });

  // ---- assets ----
  r.get('/:id/assets', (req, res) => res.json({ assets: media.list({ projectId: req.params.id, sceneId: req.query.sceneId, kind: req.query.kind }).map((a) => ({ ...a, path: undefined })) }));
  r.post('/:id/assets', W, express.raw({ type: () => true, limit: `${cfg.maxUploadMb}mb` }), async (req, res) => {
    projects.must(req.params.id);
    const q = validate(z.object({ filename: z.string().max(200).optional(), sceneId: z.string().max(60).optional(), kind: z.enum(['music', 'sfx', 'audio', 'image', 'video']).optional(), licenseSource: z.string().max(200).optional(), license: z.string().max(200).optional(), commercialUse: z.enum(['true', 'false']).optional(), attribution: z.string().max(300).optional(), proofUrl: z.string().max(400).optional() }), req.query);
    if (q.sceneId && !projects.must(req.params.id).package.scenes.some((s) => s.id === q.sceneId)) throw badRequest('Unknown scene for this project.');
    const asset = await media.importUpload({ projectId: req.params.id, sceneId: q.sceneId, buffer: req.body, filename: q.filename, kindHint: q.kind, license: { source: q.licenseSource, license: q.license, commercialUse: q.commercialUse === undefined ? null : q.commercialUse === 'true', attribution: q.attribution, proofUrl: q.proofUrl } });
    res.status(201).json({ asset: { ...asset, path: undefined } });
  });

  r.get('/:id/export/script', (req, res) => {
    const p = projects.must(req.params.id);
    const md = [`# ${p.title}`, '', `**Objective:** ${p.package.objective}`, '', ...p.package.scenes.map((s, i) => `## ${i + 1}. ${s.title}\n\n${s.narration}\n`), '## Facts to verify', ...p.package.factCheck.map((f) => `- [${f.status}] ${f.claim}`)].join('\n');
    res.type('text/markdown; charset=utf-8').set('Content-Disposition', 'attachment; filename="script.md"').send(md);
  });
  return r;
}
