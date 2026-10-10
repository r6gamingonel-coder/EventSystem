import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';
import { startAnthropicMock } from './mocks.js';

let mock; let t; let mode = 'ok'; let projectId;
const PACKAGE = {
  objective: 'أن يعرف الطفل لونين', outcomes: ['يسمّي اللون'], factCheck: [{ claim: 'التفاحة قد تكون حمراء' }],
  scenes: [
    { title: 'مقدمة', kind: 'intro', narration: 'أهلًا يا أصدقائي! هيا نتعلم.', visual: { background: { preset: 'stage' }, layers: [{ type: 'character', ref: 'rayyan', x: 0.5, y: 0.6, size: 0.5, anim: 'bob' }, { type: 'prop', ref: 'DRAGON', x: 7, y: 0.5, size: 0.4 }] } },
    { title: 'أحمر', kind: 'lesson', narration: 'هذا اللون أحمر. التفاحة حمراء!', visual: { background: { preset: 'tint', color: '#FFD6D6' }, layers: [{ type: 'prop', ref: 'apple', x: 0.7, y: 0.55, size: 0.5, anim: 'float' }, { type: 'text', text: 'أحمر', color: '#E5383B', x: 0.5, y: 0.13, size: 0.17, anim: 'pop' }] } },
    { title: 'ختام', kind: 'outro', narration: 'إلى اللقاء يا أصدقائي!', visual: { background: { preset: 'sunrise' }, layers: [] } },
  ],
  metadata: { title: 'ألوان | EA KIDS', description: 'درس الألوان للأطفال.', tags: ['ألوان'] }, thumbnail: { concept: 'x', title: 'ألوان' },
};
before(async () => {
  mock = await startAnthropicMock(async (body) => {
    if (mode === 'auth') return { status: 401 };
    if (mode === 'refusal') return { text: '', stop_reason: 'refusal', usage: { input: 100, output: 5 } };
    if (mode === 'garbage') return { text: 'Sorry, I cannot do JSON', usage: { input: 1000, output: 2000 } };
    if (/Revise ONE existing scene/.test(body.system)) return { text: JSON.stringify({ title: 'أحمر (مبسّط)', narration: 'هذا أحمر. تفاحة حمراء!', visual: { background: { preset: 'tint' }, layers: [{ type: 'prop', ref: 'apple', x: 0.5, y: 0.5, size: 0.6 }] } }), usage: { input: 2000, output: 300 } };
    return { text: '```json\n' + JSON.stringify(PACKAGE) + '\n```', usage: { input: 1500, output: 3000 } };
  });
  t = await startTestServer({ ANTHROPIC_API_KEY: 'sk-ant-test-0123456789abcdef', ANTHROPIC_BASE_URL: mock.base });
  await t.ctx.seedPromise;
  const cur = (await t.owner.get('/api/system/settings')).data.settings;
  await t.owner.put('/api/system/settings', { ...cur, limits: { dailyUsd: 1, monthlyUsd: 10 } });
  projectId = (await t.owner.post('/api/projects', { title: 'ألوان', category: 'colors' })).data.project.id;
});
after(async () => { await t.close(); await mock.close(); });

const est = async (path, body) => (await t.owner.post(path, body)).data.error.details.estimateUsd;

test('Claude generation: estimate shown first, confirmation required, output normalised, cost settled from real token usage', async () => {
  const body = { provider: 'anthropic', topic: 'ألوان' };
  const needs = await t.owner.post(`/api/projects/${projectId}/generate`, body);
  assert.equal(needs.status, 402); assert.equal(needs.data.error.code, 'CONFIRMATION_REQUIRED');
  assert.equal(needs.data.error.details.verified, true, 'Anthropic pricing is from a checked source');
  assert.equal(t.ctx.costs.usageSummary().spentTodayUsd, 0, 'nothing spent before confirmation');
  const ok = await t.owner.post(`/api/projects/${projectId}/generate`, { ...body, confirmCost: await est(`/api/projects/${projectId}/generate`, body) });
  assert.equal(ok.status, 202);
  const job = await t.ctx.jobs.waitFor(ok.data.job.id, 30000);
  assert.equal(job.status, 'succeeded', JSON.stringify(job.error));
  // request shape sent to the API
  const req = mock.seen.at(-1);
  assert.equal(req.headers['x-api-key'], 'sk-ant-test-0123456789abcdef');
  assert.equal(req.body.model, 'claude-opus-5-5'); assert.equal(req.body.stream, true);
  assert.equal(req.body.thinking, undefined); assert.equal(req.body.temperature, undefined, 'no removed sampling params');
  assert.match(req.body.system, /ORIGINAL/); assert.match(req.body.system, /rayyan/);
  // normalisation
  const p = (await t.owner.get(`/api/projects/${projectId}`)).data.project;
  assert.equal(p.package.scenes.length, 3);
  assert.equal(p.package.scenes[0].visual.layers[1].ref, 'star', 'unknown prop replaced');
  assert.ok(p.package.scenes[0].visual.layers[1].x <= 1.2, 'coordinates clamped');
  assert.equal(p.package.meta.generator.provider, 'anthropic');
  assert.equal(p.package.factCheck[0].status, 'unverified', 'AI claims always start unverified');
  // cost settled on real usage: 1500 in × $4/M + 3000 out × $20/M = $0.066
  const spent = t.ctx.costs.usageSummary().spentTodayUsd;
  assert.ok(Math.abs(spent - 0.066) < 0.0005, `spent ${spent}`);
});

test('scene revision via Claude touches one scene, snapshots first, keeps the rest', async () => {
  const p = (await t.owner.get(`/api/projects/${projectId}`)).data.project; const sc = p.package.scenes[1];
  const body = { instruction: 'اجعل الجملة أبسط', provider: 'anthropic' };
  const need = await est(`/api/projects/${projectId}/scenes/${sc.id}/revise`, body);
  const r = await t.owner.post(`/api/projects/${projectId}/scenes/${sc.id}/revise`, { ...body, confirmCost: need });
  assert.equal(r.status, 202);
  assert.equal((await t.ctx.jobs.waitFor(r.data.job.id, 30000)).status, 'succeeded');
  const q = (await t.owner.get(`/api/projects/${projectId}`)).data;
  const rs = q.project.package.scenes.find((s) => s.id === sc.id);
  assert.equal(rs.title, 'أحمر (مبسّط)'); assert.equal(rs.review.status, 'pending');
  assert.equal(q.project.package.scenes[0].title, 'مقدمة'); assert.equal(q.project.package.scenes.length, 3);
  assert.ok(q.versions.some((v) => /Before AI revision/.test(v.label)));
  const v = (await t.owner.get(`/api/projects/${projectId}/versions`)).data.versions.find((x) => /Before AI revision/.test(x.label));
  const old = (await t.owner.get(`/api/projects/${projectId}/versions/${v.version_no}`)).data.version.snapshot.scenes.find((s) => s.id === sc.id);
  assert.equal(old.title, 'أحمر');
});

test('failures: auth error, refusal and unusable output are explained, never billed wrongly', async () => {
  const before = t.ctx.costs.usageSummary().spentTodayUsd;
  const body = { provider: 'anthropic', topic: 'x' };
  const c = await est(`/api/projects/${projectId}/generate`, body);
  mode = 'auth';
  let job = await t.ctx.jobs.waitFor((await t.owner.post(`/api/projects/${projectId}/generate`, { ...body, confirmCost: c })).data.job.id, 30000);
  assert.equal(job.status, 'failed'); assert.equal(job.error.code, 'LLM_AUTH'); assert.match(job.error.hint, /ANTHROPIC_API_KEY/);
  assert.equal(t.ctx.costs.usageSummary().spentTodayUsd, before, 'rejected request is not billed');
  mode = 'refusal';
  job = await t.ctx.jobs.waitFor((await t.owner.post(`/api/projects/${projectId}/generate`, { ...body, confirmCost: c })).data.job.id, 30000);
  assert.equal(job.error.code, 'LLM_REFUSED');
  mode = 'garbage';
  job = await t.ctx.jobs.waitFor((await t.owner.post(`/api/projects/${projectId}/generate`, { ...body, confirmCost: c })).data.job.id, 30000);
  assert.equal(job.error.code, 'LLM_BAD_OUTPUT');
  assert.ok(t.ctx.costs.usageSummary().spentTodayUsd > before, 'tokens were consumed by the unusable reply, so they are recorded');
  mode = 'ok';
});

test('spending limits are enforced', async () => {
  const cur = (await t.owner.get('/api/system/settings')).data.settings;
  await t.owner.put('/api/system/settings', { ...cur, limits: { dailyUsd: 0.01, monthlyUsd: 10 } });
  const r = await t.owner.post(`/api/projects/${projectId}/generate`, { provider: 'anthropic', topic: 'x', confirmCost: 5 });
  assert.equal(r.status, 402); assert.equal(r.data.error.code, 'DAILY_LIMIT_EXCEEDED');
});

test('paid narration providers: estimate + confirmation first, then a clear setup message when the key is missing', async () => {
  const cur = (await t.owner.get('/api/system/settings')).data.settings;
  await t.owner.put('/api/system/settings', { ...cur, limits: { dailyUsd: 5, monthlyUsd: 50 } });
  const need = await t.owner.post(`/api/projects/${projectId}/narration/generate`, { provider: 'azure' });
  assert.equal(need.status, 402); assert.equal(need.data.error.code, 'CONFIRMATION_REQUIRED');
  assert.equal(need.data.error.details.verified, false, 'TTS prices are labelled unverified');
  const go = await t.owner.post(`/api/projects/${projectId}/narration/generate`, { provider: 'azure', confirmCost: need.data.error.details.estimateUsd });
  assert.equal(go.status, 202);
  const job = await t.ctx.jobs.waitFor(go.data.job.id, 30000);
  assert.equal(job.status, 'failed'); assert.match(job.error.message, /Azure Speech is not configured/); assert.match(job.error.hint, /AZURE_SPEECH_KEY/);
  const prev = await t.owner.post('/api/tts/preview', { provider: 'elevenlabs', text: 'مرحبا' });
  assert.equal(prev.status, 402);
});
