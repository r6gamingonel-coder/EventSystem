import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';
import { generateOffline } from '../server/content/generator.js';
import { KITS } from '../server/content/kits.js';
import { normalizePackage, validateForRender } from '../server/content/schema.js';
import { splitCues, toSrt, toVtt, estimateScene } from '../server/content/timing.js';
import { extractJson } from '../server/providers/llm.js';

let t; let projectId;
before(async () => { t = await startTestServer(); await t.ctx.seedPromise; });
after(async () => { await t.close(); });

test('every offline kit yields a valid, renderable package in both formats', () => {
  for (const kit of Object.keys(KITS)) for (const format of ['landscape', 'shorts']) {
    const pkg = generateOffline({ kit, language: 'ar', format });
    assert.ok(pkg.scenes.length >= 3, `${kit}/${format}`);
    assert.deepEqual(validateForRender(pkg), [], `${kit}/${format}`);
    assert.ok(pkg.objective && pkg.factCheck.length && pkg.reviewChecklist.length >= 10);
    for (const s of pkg.scenes) { assert.ok(s.id.startsWith('sc_')); assert.ok(s.durationSec >= 1.5); assert.equal(s.visual.mediaType, 'motion_graphics'); }
  }
});

test('colours sample episode meets the brief: ≥6 scenes, correct title, Arabic narration', () => {
  const pkg = generateOffline({ kit: 'colors', language: 'ar', format: 'landscape', targetDurationSec: 90 });
  assert.equal(pkg.meta.title, 'نتعلم الألوان مع أصدقاء الحيوانات | EA KIDS');
  assert.ok(pkg.scenes.length >= 6);
  assert.ok(pkg.scenes.every((s) => /[\u0600-\u06FF]/.test(s.narration)));
});

test('normalizePackage clamps and repairs untrusted (LLM) input', () => {
  const pkg = normalizePackage({ scenes: [{ title: 'x', narration: 'مرحبا. كيف حالك؟', visual: { background: { preset: 'nope' }, layers: [{ type: 'prop', ref: 'dragon', x: 9, y: -9, size: 50, anim: 'explode' }, { type: 'character', ref: 'mickey' }] }, transition: 'evil', camera: { move: 'spin', amount: 99 } }] });
  const s = pkg.scenes[0];
  assert.equal(s.visual.background.preset, 'meadow');
  assert.equal(s.visual.layers[0].ref, 'star'); assert.ok(s.visual.layers[0].x <= 1.2 && s.visual.layers[0].size <= 1.2); assert.equal(s.visual.layers[0].anim, 'none');
  assert.equal(s.visual.layers[1].ref, 'rayyan');
  assert.equal(s.transition, 'fade'); assert.equal(s.camera.move, 'zoom_in'); assert.ok(s.camera.amount <= 0.3);
});

test('timing: cues, SRT/VTT export', () => {
  const cues = splitCues('هذا اللون أحمر. التفاحة حمراء! قولوا معي: أحمر؟');
  assert.equal(cues.length, 3);
  const est = estimateScene('جملة أولى. جملة ثانية.');
  const srt = toSrt(est.subtitles); const vtt = toVtt(est.subtitles);
  assert.match(srt, /^1\n00:00:00,5\d\d --> /); assert.match(vtt, /^WEBVTT/); assert.match(vtt, /\d\d:\d\d\.\d\d\d --> /);
});

test('extractJson tolerates fences/prose and rejects garbage', () => {
  assert.deepEqual(extractJson('Here:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('noise {"a":{"b":2}} trailing'), { a: { b: 2 } });
  assert.throws(() => extractJson('no json here'));
  assert.throws(() => extractJson('{bad json}'));
});

test('project lifecycle: create → generate (job) → edit scene → versions → restore', async () => {
  const c = await t.owner.post('/api/projects', { title: 'نتعلم الألوان مع أصدقاء الحيوانات | EA KIDS', category: 'colors', language: 'ar', ageMin: 3, ageMax: 6, targetDurationSec: 90 });
  assert.equal(c.status, 201); projectId = c.data.project.id;

  const g = await t.owner.post(`/api/projects/${projectId}/generate`, { provider: 'offline_templates', kit: 'colors' });
  assert.equal(g.status, 202);
  const done = await t.ctx.jobs.waitFor(g.data.job.id, 10000);
  assert.equal(done.status, 'succeeded');

  let p = (await t.owner.get(`/api/projects/${projectId}`)).data;
  assert.ok(p.project.package.scenes.length >= 6);
  assert.equal(p.project.status, 'scripted');
  assert.ok(p.versions.length >= 1);

  const scene = p.project.package.scenes[2];
  const before = scene.narration;
  const edit = await t.owner.patch(`/api/projects/${projectId}/scenes/${scene.id}`, { narration: 'نص جديد للمشهد. جملة ثانية!' });
  assert.equal(edit.status, 200);
  assert.equal(edit.data.scene.narration, 'نص جديد للمشهد. جملة ثانية!');
  assert.equal(edit.data.scene.subtitles.length, 2, 'subtitles re-derived from new narration');
  assert.equal(edit.data.scene.review.status, 'pending');

  const snap = await t.owner.post(`/api/projects/${projectId}/versions`, { label: 'after edit' });
  assert.equal(snap.status, 201);
  const diff = (await t.owner.get(`/api/projects/${projectId}/versions/1/diff/current`)).data.diff;
  assert.ok(diff.changed.some((c) => c.id === scene.id && c.narrationChanged));

  const rest = await t.owner.post(`/api/projects/${projectId}/versions/1/restore`);
  assert.equal(rest.status, 200);
  p = (await t.owner.get(`/api/projects/${projectId}`)).data;
  assert.equal(p.project.package.scenes.find((s) => s.id === scene.id).narration, before, 'restore brings back the original narration');
  assert.ok(p.versions.some((v) => /Restored from v1/.test(v.label)));
  assert.ok(p.versions.some((v) => /Before restoring/.test(v.label)), 'restore is non-destructive');
});

test('scene operations: reorder, duplicate, delete, approve/reject, lock', async () => {
  const p = (await t.owner.get(`/api/projects/${projectId}`)).data.project;
  const [a, b] = p.package.scenes;
  await t.owner.post(`/api/projects/${projectId}/scenes/${a.id}/move`, { direction: 'down' });
  let cur = (await t.owner.get(`/api/projects/${projectId}`)).data.project.package.scenes;
  assert.equal(cur[1].id, a.id); assert.equal(cur[0].id, b.id);
  const dup = (await t.owner.post(`/api/projects/${projectId}/scenes/${a.id}/duplicate`)).data.scene;
  assert.notEqual(dup.id, a.id);
  const rej = await t.owner.post(`/api/projects/${projectId}/scenes/${dup.id}/review`, { status: 'rejected', note: 'Character looks off-model' });
  assert.equal(rej.data.scene.review.status, 'rejected');
  assert.ok(validateForRender((await t.owner.get(`/api/projects/${projectId}`)).data.project.package).some((x) => /rejected/.test(x)));
  assert.equal((await t.owner.del(`/api/projects/${projectId}/scenes/${dup.id}`)).status, 200);
  await t.owner.patch(`/api/projects/${projectId}/scenes/${a.id}`, { locked: true });
  const locked = await t.owner.post(`/api/projects/${projectId}/scenes/${a.id}/revise`, { instruction: 'make it simpler', provider: 'anthropic' });
  assert.equal(locked.status, 409); assert.equal(locked.data.error.code, 'SCENE_LOCKED');
  await t.owner.patch(`/api/projects/${projectId}/scenes/${a.id}`, { locked: false });
  const rv = await t.owner.post(`/api/projects/${projectId}/scenes/${a.id}/revise`, { instruction: 'make it simpler', provider: 'offline_templates' });
  assert.equal(rv.status, 412); assert.match(rv.data.error.hint, /provider|edit/i);
});

test('paid LLM providers: not configured → clear setup message; configured → needs limits then explicit confirmation', async () => {
  const noKey = await t.owner.post(`/api/projects/${projectId}/generate`, { provider: 'anthropic', topic: 'x' });
  // Estimate is paid and no limit is set → blocked before anything is called.
  assert.equal(noKey.status, 402); assert.equal(noKey.data.error.code, 'SPENDING_LIMIT_NOT_SET');
  const cur = (await t.owner.get('/api/system/settings')).data.settings;
  await t.owner.put('/api/system/settings', { ...cur, limits: { dailyUsd: 5, monthlyUsd: 50 } });
  const needConfirm = await t.owner.post(`/api/projects/${projectId}/generate`, { provider: 'anthropic', topic: 'x' });
  assert.equal(needConfirm.status, 402); assert.equal(needConfirm.data.error.code, 'CONFIRMATION_REQUIRED');
  assert.ok(needConfirm.data.error.details.estimateUsd > 0);
  const confirmed = await t.owner.post(`/api/projects/${projectId}/generate`, { provider: 'anthropic', topic: 'x', confirmCost: needConfirm.data.error.details.estimateUsd });
  assert.equal(confirmed.status, 202);
  const job = await t.ctx.jobs.waitFor(confirmed.data.job.id, 10000);
  assert.equal(job.status, 'failed');
  assert.match(job.error.message, /not configured/i);
  assert.match(job.error.hint, /ANTHROPIC_API_KEY/);
  const spent = t.ctx.costs.usageSummary();
  assert.equal(spent.spentTodayUsd, 0, 'a call that never reached the provider is not billed');
});
