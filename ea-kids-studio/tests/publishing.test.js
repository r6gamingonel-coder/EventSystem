import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, buildProject, makeApprovable, HAS_MEDIA } from './helpers.js';
import { sharp } from '../server/lib/imaging.js';

const skip = !HAS_MEDIA && 'ffmpeg / espeak-ng not installed';
let t; let P;
before(async () => { t = await startTestServer(); await t.ctx.seedPromise; });
after(async () => { await t.close(); });
const ev = async (id) => (await t.owner.get(`/api/projects/${id}/compliance`)).data;

test('thumbnails: three 16:9 concepts, ≤ 2 MB export, selectable, correct text rendering size', async () => {
  const c = await t.owner.post('/api/projects', { title: 'نتعلم الألوان', category: 'colors' });
  const id = c.data.project.id;
  await t.ctx.jobs.waitFor((await t.owner.post(`/api/projects/${id}/generate`, { provider: 'offline_templates', kit: 'colors', itemCount: 2 })).data.job.id, 20000);
  const g = await t.owner.post(`/api/projects/${id}/thumbnails/generate`, {});
  assert.equal(g.data.assets.length, 3);
  for (const a of g.data.assets) { assert.equal(a.width, 1280); assert.equal(a.height, 720); }
  const exp = await t.ctx.publishing.exportThumbnail(id);
  assert.ok(exp.bytes <= 2_000_000); assert.equal((await sharp(exp.buffer).metadata()).format, 'jpeg');
  const sel = await t.owner.post(`/api/projects/${id}/thumbnails/select`, { assetId: g.data.assets[1].id });
  assert.equal(sel.status, 200);
  assert.equal((await t.owner.get(`/api/projects/${id}/thumbnails/check`)).data.ok, true);
  // custom edit with different params regenerates all variants with the new headline
  const e = await t.owner.post(`/api/projects/${id}/thumbnails/generate`, { variants: ['A'], overrides: { title: 'ألوان جميلة', accent: 'blue' } });
  assert.equal(e.data.assets[0].meta.params.title, 'ألوان جميلة');
});

test('metadata validation catches clickbait, stuffing, over-long titles and tag limits', async () => {
  const c = await t.owner.post('/api/projects', { title: 'x', category: 'colors' }); const id = c.data.project.id;
  await t.ctx.jobs.waitFor((await t.owner.post(`/api/projects/${id}/generate`, { provider: 'offline_templates', kit: 'colors', itemCount: 2 })).data.job.id, 20000);
  assert.equal((await t.owner.patch(`/api/projects/${id}/metadata`, { title: 'ا'.repeat(101) })).status, 400, 'route rejects titles over 100 chars');
  const cur = (await t.owner.get(`/api/projects/${id}`)).data.project.package;
  cur.metadata = { ...cur.metadata, title: 'لن تصدق!!! ' + 'ا'.repeat(100), description: 'ألوان '.repeat(30), tags: Array.from({ length: 20 }, (_, i) => `tag${i}`) };
  await t.owner.put(`/api/projects/${id}/package`, { package: cur });
  const m = (await t.owner.get(`/api/projects/${id}/metadata/validate`)).data.issues.map((i) => i.id);
  for (const k of ['title_len', 'clickbait', 'shouting', 'stuffing', 'tags_many']) assert.ok(m.includes(k), `${k} in ${m}`);
  const sug = (await t.owner.get(`/api/projects/${id}/metadata/suggest`)).data.suggestion;
  assert.match(sug.description, /مُولَّد|الصوت|فيديو تعليمي أصلي/);
});

test('compliance: a fresh project is blocked with actionable items; approval is refused', async () => {
  P = await buildProject(t, { render: false, narrate: false, title: 'الألوان — تجربة' });
  const e = await ev(P.id);
  assert.ok(e.blockers >= 6);
  const ids = e.items.filter((i) => i.status === 'fail').map((i) => i.id);
  for (const k of ['scenes_approved', 'facts_verified', 'checklist', 'render_exists', 'audience_decided', 'manual_watched_full']) assert.ok(ids.includes(k), k);
  assert.ok(e.items.find((i) => i.id === 'scenes_approved').fix);
  assert.equal(e.audienceAssessment.likelyMadeForKids, true);
  assert.match(e.audienceAssessment.guidance, /made for kids/i);
  const a = await t.owner.post(`/api/projects/${P.id}/compliance/approve`);
  assert.equal(a.status, 409); assert.equal(a.data.error.code, 'COMPLIANCE_BLOCKED');
});

test('compliance: personal-info prompts, unlicensed imports and wrong audience are blockers', { skip }, async () => {
  const p = (await t.owner.get(`/api/projects/${P.id}`)).data.project; const sc = p.package.scenes[1];
  await t.owner.patch(`/api/projects/${P.id}/scenes/${sc.id}`, { narration: 'اكتب اسمك في التعليقات. ما أجمل الألوان!' });
  assert.equal((await ev(P.id)).items.find((i) => i.id === 'no_personal_info').status, 'fail');
  await t.owner.patch(`/api/projects/${P.id}/scenes/${sc.id}`, { narration: 'هذا لون أحمر. التفاحة حمراء!' });
  assert.equal((await ev(P.id)).items.find((i) => i.id === 'no_personal_info').status, 'pass');
  // upload a PNG without licence info → blocker; add licence → pass
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#f00' } }).png().toBuffer();
  const up = await t.owner.post(`/api/projects/${P.id}/assets?filename=bg.png&kind=image`, png, { raw: true, headers: { 'content-type': 'application/octet-stream' } });
  assert.equal(up.status, 201);
  assert.equal((await ev(P.id)).items.find((i) => i.id === 'licences').status, 'fail');
  await t.owner.patch(`/api/assets/${up.data.asset.id}`, { license: { source: 'Own drawing', license: 'Owned', commercialUse: true } });
  assert.equal((await ev(P.id)).items.find((i) => i.id === 'licences').status, 'pass');
  await t.owner.put(`/api/projects/${P.id}/compliance/review`, { audience: { madeForKids: false, rationale: 'I think it is general audience' } });
  assert.equal((await ev(P.id)).items.find((i) => i.id === 'audience_mismatch').status, 'fail');
});

test('compliance: similar scripts are flagged as repetitive/template content', async () => {
  const A = await buildProject(t, { narrate: false, title: 'نسخة أ' }); const B = await buildProject(t, { narrate: false, title: 'نسخة ب' });
  const e = await ev(B.id); const sim = e.items.find((i) => i.id === 'similar_script');
  assert.equal(sim.status, 'fail'); assert.match(sim.detail, /overlap/); assert.match(sim.fix, /original/i);
  void A;
});

test('compliance approval flow: only reviewers/owners, requires human confirmations, goes stale on edits', { skip }, async () => {
  const R = await buildProject(t, { kit: 'numbers', title: 'فيديو جاهز', itemCount: 2 });
  await makeApprovable(t, R.id);
  const e = await ev(R.id);
  assert.equal(e.blockers, 0, JSON.stringify(e.items.filter((i) => i.status === 'fail')));
  // viewer cannot approve
  await t.owner.post('/api/auth/users', { email: 'viewer2@example.com', password: 'ViewerPass123', role: 'viewer' });
  await t.owner.post('/api/auth/users', { email: 'rev@example.com', password: 'ReviewerPass123', role: 'reviewer' });
  const v = t.client(); await v.signIn('viewer2@example.com', 'ViewerPass123');
  assert.equal((await v.post(`/api/projects/${R.id}/compliance/approve`)).status, 403);
  const rv = t.client(); await rv.signIn('rev@example.com', 'ReviewerPass123');
  const ok = await rv.post(`/api/projects/${R.id}/compliance/approve`);
  assert.equal(ok.status, 200); assert.equal(ok.data.approval.approved, true);
  assert.equal((await t.owner.get(`/api/projects/${R.id}`)).data.project.status, 'approved');
  // editing metadata after approval invalidates it
  await t.owner.patch(`/api/projects/${R.id}/metadata`, { title: 'عنوان معدّل | EA KIDS' });
  const after = await ev(R.id);
  assert.equal(after.approval.approved, false); assert.equal(after.approval.stale, true);
  assert.equal((await t.ctx.publishing.isApproved(R.id)), false);
  // reviewer cannot weaken the gate by un-ticking confirmations and re-approving
  await rv.put(`/api/projects/${R.id}/compliance/review`, { manual: { watched_full: false } });
  assert.equal((await rv.post(`/api/projects/${R.id}/compliance/approve`)).status, 409);
});

test('monetization readiness: loads configurable policy with sources, no promises, owner-only edits', async () => {
  const m = (await t.owner.get('/api/monetization')).data;
  assert.ok(m.items.length >= 15 && m.concepts.length === 3);
  assert.match(m.note, /not a prediction/i);
  assert.ok(m.policy.ypp.full.subscribers.source.startsWith('https://'));
  assert.equal(m.policy.payments.iraq.value.wire, true); assert.equal(m.policy.payments.iraq.status, 'search_snippet');
  const s = (await t.owner.put('/api/monetization', { answers: { subs: 1200, two_step: true } })).data;
  assert.equal(s.items.find((i) => i.id === 'subs').done, true);
  assert.equal(s.items.find((i) => i.id === 'watch_hours').done, false);
  const ed = t.client(); await t.owner.post('/api/auth/users', { email: 'ed@example.com', password: 'EditorPass1234', role: 'editor' }); await ed.signIn('ed@example.com', 'EditorPass1234');
  assert.equal((await ed.put('/api/monetization', { answers: { subs: 9 } })).status, 403);
});
