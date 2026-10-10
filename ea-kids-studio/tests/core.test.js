import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';
import { RetryableError } from '../server/lib/errors.js';
import { safeJoin, encryptSecret, decryptSecret, sniffMedia, sanitizeFilename } from '../server/lib/security.js';
import { redact, registerSecrets } from '../server/lib/logger.js';

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });

test('unauthenticated API access is rejected, status is open', async () => {
  const anon = t.client();
  assert.equal((await anon.get('/api/system/settings')).status, 401);
  const st = await anon.get('/api/auth/status');
  assert.equal(st.status, 200);
  assert.equal(st.data.needsSetup, false);
});

test('first-run setup is only possible once', async () => {
  const r = await t.client().post('/api/auth/setup', { email: 'x@example.com', password: 'AnotherPass123' });
  assert.equal(r.status, 409);
});

test('login rejects bad credentials and throttles repeated failures', async () => {
  const c = t.client();
  for (let i = 0; i < 8; i++) assert.equal((await c.signIn('ghost@example.com', 'wrong-pass-' + i)).status, 401);
  assert.equal((await c.signIn('ghost@example.com', 'wrong-pass-again')).status, 429);
});

test('CSRF token is required for mutations', async () => {
  const c = t.client();
  await c.signIn('owner@example.com', 'Sup3rSecretPass');
  const r = await c.call('PUT', '/api/system/settings', { channelName: 'x' }, { headers: { 'x-csrf-token': 'nope' } });
  assert.equal(r.status, 403);
});

test('settings: owner can update, validation errors are explicit, viewer is forbidden', async () => {
  const cur = (await t.owner.get('/api/system/settings')).data.settings;
  const ok = await t.owner.put('/api/system/settings', { ...cur, limits: { dailyUsd: 2, monthlyUsd: 20 } });
  assert.equal(ok.status, 200);
  const bad = await t.owner.put('/api/system/settings', { ...cur, fps: 29 });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error.message, /fps/);

  await t.owner.post('/api/auth/users', { email: 'view@example.com', password: 'ViewerPass123', role: 'viewer' });
  const v = t.client();
  await v.signIn('view@example.com', 'ViewerPass123');
  assert.equal((await v.put('/api/system/settings', cur)).status, 403);
  assert.equal((await v.get('/api/system/settings')).status, 200);
});

test('job queue: retries transient failures with backoff, then succeeds', async () => {
  let n = 0;
  t.ctx.jobs.register('test_flaky', async () => { n += 1; if (n < 3) throw new RetryableError('upstream 503'); return { n }; }, { lane: 'io', maxAttempts: 3 });
  const job = t.ctx.jobs.enqueue('test_flaky');
  const done = await t.ctx.jobs.waitFor(job.id, 5000);
  assert.equal(done.status, 'succeeded');
  assert.equal(done.attempts, 3);
  assert.ok(t.ctx.jobs.logs(job.id).some((l) => /Retrying/.test(l.message)));
});

test('job queue: permanent errors fail immediately with details; retry re-queues', async () => {
  let fail = true;
  t.ctx.jobs.register('test_perm', async () => { if (fail) throw Object.assign(new Error('bad input'), { hint: 'fix it' }); return {}; });
  const job = t.ctx.jobs.enqueue('test_perm');
  const done = await t.ctx.jobs.waitFor(job.id, 3000);
  assert.equal(done.status, 'failed');
  assert.equal(done.attempts, 1);
  assert.equal(done.error.hint, 'fix it');
  fail = false;
  t.ctx.jobs.retry(job.id);
  assert.equal((await t.ctx.jobs.waitFor(job.id, 3000)).status, 'succeeded');
});

test('job queue: running jobs can be cancelled', async () => {
  t.ctx.jobs.register('test_slow', ({ signal }) => new Promise((res, rej) => { signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { cancelled: true }))); setTimeout(res, 5000); }));
  const job = t.ctx.jobs.enqueue('test_slow');
  await new Promise((r) => setTimeout(r, 200));
  t.ctx.jobs.cancel(job.id);
  assert.equal((await t.ctx.jobs.waitFor(job.id, 3000)).status, 'cancelled');
});

test('security: path traversal is blocked, secrets round-trip encrypted, uploads are sniffed', () => {
  assert.throws(() => safeJoin('/data/media', '../etc/passwd'));
  assert.throws(() => safeJoin('/data/media', '/etc/passwd'));
  assert.equal(safeJoin('/data/media', 'a/b.png'), '/data/media/a/b.png');
  const enc = encryptSecret('refresh-token-123', 'app-secret');
  assert.ok(!enc.includes('refresh-token-123'));
  assert.equal(decryptSecret(enc, 'app-secret'), 'refresh-token-123');
  assert.throws(() => decryptSecret(enc, 'other-secret'));
  assert.equal(sniffMedia(Buffer.from('MZ\x90\x00 not media'))?.kind, undefined);
  assert.equal(sniffMedia(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0]))?.ext, 'png');
  assert.equal(sanitizeFilename('../../evil name?.png'), 'evil name_.png');
});

test('logger redacts API keys and tokens', () => {
  registerSecrets(['my-very-secret-value']);
  const out = redact({ msg: 'key sk-ant-abcdefghijklmnop and my-very-secret-value and Bearer abcdefghijklmnopqrst', token: 'ya29.abcdefghijklmnopqrstuvwxyz' });
  assert.ok(!/sk-ant-abc|my-very-secret|abcdefghijklmnopqrst|ya29\./.test(out), out);
});

test('first-run setup cannot be claimed through a reverse proxy (X-Forwarded-For) without SETUP_TOKEN', async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const { createApp } = await import('../server/app.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eak-setup-'));
  const { app, ctx } = await createApp({ DATA_DIR: dir, NODE_ENV: 'test', SETUP_TOKEN: 'a-long-random-setup-token-123' }); // empty database: no owner yet
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const url = `http://127.0.0.1:${server.address().port}/api/auth/setup`;
  const post = (extra, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) });
  try {
    const proxied = { 'x-forwarded-for': '203.0.113.9' };
    assert.equal((await post(proxied, { email: 'evil@example.com', password: 'AttackerPass123' })).status, 403, 'relayed request without token');
    assert.equal((await post(proxied, { email: 'evil@example.com', password: 'AttackerPass123', setupToken: 'nope' })).status, 403, 'wrong token');
    assert.equal((await post(proxied, { email: 'me@example.com', password: 'MyOwnPass12345', setupToken: 'a-long-random-setup-token-123' })).status, 201, 'correct token');
  } finally { server.close(); await ctx.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
