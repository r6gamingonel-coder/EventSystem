import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { startTestServer, buildProject, makeApprovable, HAS_MEDIA } from './helpers.js';
import { startGoogleMock } from './mocks.js';

const skip = !HAS_MEDIA && 'ffmpeg / espeak-ng not installed';
let plain; let t; let g; let R;
before(async () => {
  plain = await startTestServer();                       // no YouTube credentials at all
  g = await startGoogleMock();
  t = await startTestServer({
    YOUTUBE_CLIENT_ID: 'client-id.apps.googleusercontent.com', YOUTUBE_CLIENT_SECRET: 'GOCSPX-test-client-secret-value', YOUTUBE_REDIRECT_URI: 'http://localhost/cb',
    YOUTUBE_TOKEN_URL: `${g.base}/token`, YOUTUBE_API_BASE: g.base, YOUTUBE_ANALYTICS_BASE: g.base, YOUTUBE_AUTH_BASE: 'https://accounts.example/auth', UPLOAD_CHUNK_BYTES: '262144',
  });
  await t.ctx.seedPromise; await plain.ctx.seedPromise;
});
after(async () => { await plain.close(); await t.close(); await g.close(); });

test('without credentials: clear setup instructions, dry-run + manual export still work', { skip }, async () => {
  const s = (await plain.owner.get('/api/youtube/status')).data;
  assert.equal(s.configured, false); assert.match(s.setup, /YOUTUBE_CLIENT_ID/);
  const c = await plain.owner.post('/api/youtube/connect', {});
  assert.equal(c.status, 412); assert.equal(c.data.error.code, 'NOT_CONFIGURED'); assert.match(c.data.error.hint, /GOOGLE_OAUTH_SETUP|Google Cloud/);
  const P = await buildProject(plain, { title: 'تجربة بدون يوتيوب', itemCount: 2 });
  const dr = (await plain.owner.post(`/api/projects/${P.id}/youtube/dry-run`, {})).data;
  assert.equal(dr.wouldUpload, false);
  assert.ok(dr.problems.some((x) => /credentials are not configured/.test(x)));
  assert.equal(dr.payload.status.privacyStatus, 'private', 'dry-run defaults to private');
  const man = (await plain.owner.get(`/api/projects/${P.id}/manual-export`)).data;
  assert.ok(man.title && man.steps.length >= 4);
});

test('OAuth: PKCE URL, state-bound callback, replay protection, tokens encrypted at rest', { skip }, async () => {
  const url = new URL((await t.owner.post('/api/youtube/connect', { scopes: ['upload', 'read', 'analytics'] })).data.url);
  assert.equal(url.origin + url.pathname, 'https://accounts.example/auth');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.match(url.searchParams.get('scope'), /youtube\.upload/); assert.ok(!url.searchParams.get('scope').includes('monetary'), 'revenue scope is opt-in');
  assert.ok(!url.toString().includes('GOCSPX'), 'client secret never appears in the browser URL');
  const state = url.searchParams.get('state');
  const anon = t.client(); // the browser returning from Google has no session cookie
  const cb = await anon.get(`/api/youtube/oauth/callback?code=good-code&state=${state}`);
  assert.equal(cb.status, 200); assert.match(cb.data.toString(), /Connected/);
  const st = (await t.owner.get('/api/youtube/status')).data;
  assert.equal(st.connected, true); assert.equal(st.channel.title, 'EA KIDS');
  const raw = JSON.stringify(t.ctx.db.all('SELECT * FROM youtube_accounts'));
  assert.ok(!raw.includes('rt-secret-REFRESH') && !raw.includes('ya29.access'), 'tokens are not stored in plaintext');
  const replay = await anon.get(`/api/youtube/oauth/callback?code=good-code&state=${state}`);
  assert.match(replay.data.toString(), /Not connected/);
  const bad = await anon.get('/api/youtube/oauth/callback?code=good-code&state=forged');
  assert.match(bad.data.toString(), /Not connected/);
});

test('upload requires compliance approval, an owner dry-run and explicit confirmation; resumes after a transient failure', { skip }, async () => {
  R = await buildProject(t, { kit: 'numbers', title: 'نعد معا', itemCount: 3 });
  // not approved yet → dry-run lists the problem, approval impossible
  let dr = (await t.owner.post(`/api/projects/${R.id}/youtube/dry-run`, {})).data;
  assert.equal(dr.wouldUpload, false); assert.ok(dr.problems.some((x) => /Compliance review is not approved|No final render/.test(x)));
  assert.equal((await t.owner.post(`/api/youtube/uploads/${dr.uploadId}/approve`, { confirm: 'UPLOAD' })).status, 409);

  await makeApprovable(t, R.id);
  await t.owner.post(`/api/projects/${R.id}/compliance/approve`);
  const before = Object.keys(g.state.uploads).length;
  dr = (await t.owner.post(`/api/projects/${R.id}/youtube/dry-run`, { privacy: 'private' })).data;
  assert.equal(dr.wouldUpload, true, JSON.stringify(dr.problems));
  assert.equal(dr.payload.status.selfDeclaredMadeForKids, true);
  assert.equal(dr.payload.status.privacyStatus, 'private'); assert.equal(dr.payload.snippet.categoryId, '27');
  assert.ok(dr.video.bytes > 262144 * 2, 'video spans several upload chunks');
  assert.ok(dr.thumbnail.bytes <= 2_000_000);
  assert.equal(Object.keys(g.state.uploads).length, before, 'a dry-run uploads nothing');

  // only the owner, and only with explicit confirmation
  await t.owner.post('/api/auth/users', { email: 'editor3@example.com', password: 'EditorPass1234', role: 'editor' });
  const ed = t.client(); await ed.signIn('editor3@example.com', 'EditorPass1234');
  assert.equal((await ed.post(`/api/youtube/uploads/${dr.uploadId}/approve`, { confirm: 'UPLOAD' })).status, 403);
  assert.equal((await t.owner.post(`/api/youtube/uploads/${dr.uploadId}/approve`, { confirm: 'yes' })).status, 400);
  assert.equal(Object.keys(g.state.uploads).length, before, 'still nothing uploaded');

  const ap = await t.owner.post(`/api/youtube/uploads/${dr.uploadId}/approve`, { confirm: 'UPLOAD' });
  assert.equal(ap.status, 202);
  const job = await t.ctx.jobs.waitFor(ap.data.job.id, 120000);
  assert.equal(job.status, 'succeeded', JSON.stringify(job.error));
  assert.ok(job.attempts >= 2, 'the injected 503 forced a retry that resumed the session');
  assert.equal(job.result.videoId, 'VID123');
  assert.equal(Object.keys(g.state.uploads).length, 1, 'resumed the same upload session instead of starting over');
  assert.equal(g.state.uploads.sess0.received, g.state.uploads.sess0.total);
  assert.deepEqual(g.state.insertBody.snippet.tags, dr.payload.snippet.tags);
  assert.equal(g.state.insertBody.status.privacyStatus, 'private');
  assert.equal(g.state.thumbs, 1); assert.ok(g.state.thumbBytes > 1000);
  assert.equal(g.state.playlistItems.length, 1);
  assert.equal(g.state.authFailures, 0, 'every call carried a Bearer token');
  const row = t.ctx.db.get('SELECT * FROM youtube_uploads WHERE id = ?', dr.uploadId);
  assert.equal(row.status, 'uploaded'); assert.equal(row.video_id, 'VID123');
  assert.ok(!String(row.response).includes('http://127.0.0.1'), 'session URI is stored encrypted');
});

test('public uploads need an extra explicit confirmation; content changes after the dry-run block the upload', { skip }, async () => {
  const dr = (await t.owner.post(`/api/projects/${R.id}/youtube/dry-run`, { privacy: 'public' })).data;
  assert.match(dr.privacyNote, /PUBLIC/);
  const no = await t.owner.post(`/api/youtube/uploads/${dr.uploadId}/approve`, { confirm: 'UPLOAD' });
  assert.equal(no.status, 400); assert.equal(no.data.error.code, 'CONFIRM_PUBLIC_REQUIRED');
  await t.owner.patch(`/api/projects/${R.id}/metadata`, { title: 'عنوان آخر | EA KIDS' });
  const changed = await t.owner.post(`/api/youtube/uploads/${dr.uploadId}/approve`, { confirm: 'UPLOAD', confirmPublic: true });
  assert.equal(changed.status, 409);
  assert.ok(['COMPLIANCE_NOT_APPROVED', 'CONTENT_CHANGED'].includes(changed.data.error.code));
});

test('scheduling: publishAt needs private status and a future time', { skip }, async () => {
  const bad = await t.owner.post(`/api/projects/${R.id}/youtube/dry-run`, { privacy: 'public', publishAt: new Date(Date.now() + 86400e3).toISOString() });
  assert.equal(bad.data.error.code, 'BAD_SCHEDULE');
  const past = await t.owner.post(`/api/projects/${R.id}/youtube/dry-run`, { privacy: 'private', publishAt: new Date(Date.now() - 1000).toISOString() });
  assert.equal(past.data.error.code, 'BAD_SCHEDULE');
  const ok = await t.owner.post(`/api/projects/${R.id}/youtube/dry-run`, { privacy: 'private', publishAt: new Date(Date.now() + 86400e3).toISOString() });
  assert.equal(ok.status, 200); assert.ok(ok.data.payload.status.publishAt);
});

test('analytics sync stores only what the API returned; revenue stays out without the scope; CSV import is labelled manual', { skip }, async () => {
  const empty = (await plain.owner.get('/api/analytics/summary')).data;
  assert.equal(empty.hasData, false); assert.deepEqual(empty.totals, {}); assert.equal(empty.revenue, null);
  // expire the access token → the sync must refresh it transparently
  t.ctx.db.run('UPDATE youtube_accounts SET expires_at = ?', new Date(0).toISOString());
  const job = await t.ctx.jobs.waitFor((await t.owner.post('/api/youtube/analytics/sync', { days: 7 })).data.job.id, 60000);
  assert.equal(job.status, 'succeeded', JSON.stringify(job.error));
  assert.equal(job.result.revenueIncluded, false); assert.ok(g.state.tokenRefreshes >= 1);
  const s = (await t.owner.get('/api/analytics/summary?days=3650')).data;
  assert.ok(s.sources.includes('youtube_api')); assert.equal(s.totals.views, 100 + 200);
  assert.equal(s.revenue, null); assert.ok(s.retention.length === 3 && s.retention[1].watchRatio === 0.62);
  assert.ok(s.videos.length >= 1);
  const csv = 'date,video_id,impressions,impressions click-through rate (%),views\n2026-10-03,VID123,5000,4.2,300\n';
  assert.equal((await t.owner.post('/api/analytics/import', csv, { raw: true, headers: { 'content-type': 'text/csv' } })).data.rowsImported, 3);
  const exp = (await t.owner.get('/api/analytics/export.csv')).data.toString();
  assert.match(exp, /manual_import/); assert.match(exp, /youtube_api/);
  const bad = await t.owner.post('/api/analytics/import', 'foo,bar\n1,2\n', { raw: true, headers: { 'content-type': 'text/csv' } });
  assert.equal(bad.status, 400); assert.match(bad.data.error.hint, /Studio/);
});

test('disconnect revokes locally; no leftover tokens', { skip }, async () => {
  await t.owner.post('/api/youtube/disconnect', {});
  assert.equal((await t.owner.get('/api/youtube/status')).data.connected, false);
  assert.equal(t.ctx.db.all('SELECT * FROM youtube_accounts').length, 0);
  const logFile = `${t.ctx.cfg.logDir}/app.log`;
  if (fs.existsSync(logFile)) assert.ok(!/rt-secret-REFRESH|GOCSPX-test-client-secret/.test(fs.readFileSync(logFile, 'utf8')), 'no secrets in logs');
});
