import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer, buildProject, HAS_MEDIA } from './helpers.js';
import { buildAss } from '../server/media/ass.js';
import { sharp } from '../server/lib/imaging.js';
import { ROOT } from '../server/config.js';

const SECRETS = {
  ANTHROPIC_API_KEY: 'sk-ant-SECRETVALUE-aaaaaaaaaaaaaaaaaa', OPENAI_API_KEY: 'sk-proj-SECRETVALUE-bbbbbbbbbbbbbbbbbb', AZURE_SPEECH_KEY: 'azurekeySECRETVALUE0123456789', AZURE_SPEECH_REGION: 'westeurope',
  ELEVENLABS_API_KEY: 'elevenSECRETVALUE0123456789', GOOGLE_TTS_API_KEY: 'AIzaSySECRETVALUE0123456789abcdef', YOUTUBE_CLIENT_ID: 'cid.apps.googleusercontent.com', YOUTUBE_CLIENT_SECRET: 'GOCSPX-SECRETVALUE-0123456789', APP_SECRET: 'app-secret-SECRETVALUE-0123456789abcdef', MAX_UPLOAD_MB: '1',
};
let t;
before(async () => { t = await startTestServer(SECRETS); await t.ctx.seedPromise; });
after(async () => { await t.close(); });

const leaks = (s) => Object.entries(SECRETS).filter(([k, v]) => k !== 'AZURE_SPEECH_REGION' && k !== 'MAX_UPLOAD_MB' && !k.endsWith('CLIENT_ID') && String(s).includes(v)).map(([k]) => k);

test('API responses never contain provider keys or app secrets, but report what is configured', async () => {
  const urls = ['/api/system/status', '/api/system/settings', '/api/tts/providers', '/api/diagnostics', '/api/costs/summary', '/api/youtube/status', '/api/registry', '/api/auth/status', '/api/monetization', '/api/audit', '/api/backups'];
  for (const u of urls) { const r = await t.owner.get(u); assert.deepEqual(leaks(JSON.stringify(r.data)), [], u); }
  const caps = (await t.owner.get('/api/system/status')).data.capabilities.providers;
  assert.equal(caps.llm.anthropic.configured, true); assert.equal(caps.llm.openai.configured, true); assert.equal(caps.tts.azure.configured, true);
  assert.ok(!JSON.stringify(caps).includes('SECRETVALUE'));
  assert.equal(caps.llm.anthropic.env, 'ANTHROPIC_API_KEY', 'only the variable NAME is shown');
});

test('static hosting exposes only the dashboard — no source, config, env or database files', async () => {
  for (const u of ['/.env', '/server/config.js', '/package.json', '/data/studio.db', '/../package.json', '/%2e%2e/.env', '/assets/fonts/../../.env', '/tests/security.test.js']) {
    const r = await t.owner.get(u);
    const body = Buffer.isBuffer(r.data) ? r.data.toString('utf8', 0, 600) : JSON.stringify(r.data);
    assert.ok(!/SQLite format|APP_SECRET|ANTHROPIC_API_KEY=|"name": "ea-kids-studio"/.test(body), `${u} leaked content`);
  }
  assert.deepEqual(leaks((await t.owner.get('/')).data.toString()), []);
  const js = fs.readdirSync(path.join(ROOT, 'web'), { recursive: true }).filter((f) => /\.(js|html|css)$/.test(f));
  for (const f of js) assert.deepEqual(leaks(fs.readFileSync(path.join(ROOT, 'web', f), 'utf8')), [], f);
});

test('source tree contains no committed secrets and .env.example holds placeholders only', () => {
  const files = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', 'data', 'out'].includes(e.name)) continue; const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push(p); } };
  walk(ROOT);
  const re = /(sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}|ya29\.[0-9A-Za-z_-]{30,}|GOCSPX-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
  for (const f of files) { if (/\.(png|jpg|ttf|mp4|wav|db|woff2?)$/.test(f) || f.includes(`${path.sep}tests${path.sep}`)) continue; assert.ok(!re.test(fs.readFileSync(f, 'utf8')), `secret-like string in ${path.relative(ROOT, f)}`); }
  const env = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  for (const line of env.split('\n').filter((l) => /^[A-Z_]+=/.test(l))) { const v = line.split('=')[1].trim(); assert.ok(!v || /^(your-|change-me|<|http|\d|true|false|[a-z]+$|ar$|claude|gpt|data|studio|ffmpeg|ffprobe|espeak|development|production|3|4)/i.test(v) || v.length < 24, `suspicious value in .env.example: ${line}`); }
});

test('application log never contains provider keys or the app secret', async () => {
  const P = (await t.owner.post('/api/projects', { title: 'log test', category: 'colors' })).data.project;
  t.ctx.log.error('provider call failed', { key: SECRETS.ANTHROPIC_API_KEY, url: `https://x/?key=${SECRETS.GOOGLE_TTS_API_KEY}`, auth: `Bearer ${SECRETS.OPENAI_API_KEY}`, secret: SECRETS.APP_SECRET });
  await t.owner.post(`/api/projects/${P.id}/generate`, { provider: 'anthropic', topic: 'x' }); // blocked by the spend gate; logs the attempt path
  await new Promise((r) => setTimeout(r, 150));
  const file = `${t.ctx.cfg.logDir}/app.log`;
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes('provider call failed'), 'the line was written');
  assert.deepEqual(leaks(text), []);
});

test('session cookie is HttpOnly + SameSite=Strict; security headers are set; media needs a session', async () => {
  const res = await fetch(`${t.base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'Sup3rSecretPass' }) });
  const cookie = res.headers.getSetCookie().join(';');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  const h = (await fetch(`${t.base}/api/health`)).headers;
  assert.match(h.get('content-security-policy'), /default-src 'self'/); assert.equal(h.get('x-content-type-options'), 'nosniff'); assert.equal(h.get('x-frame-options'), 'DENY');
  const asset = t.ctx.media.list({ library: true })[0];
  assert.equal((await fetch(`${t.base}/api/assets/${asset.id}/file`)).status, 401);
  assert.equal((await t.owner.get(`/api/assets/${asset.id}/file`)).status, 200);
  assert.equal((await t.owner.get('/api/assets/..%2f..%2fetc%2fpasswd/file')).status, 404);
});

test('uploads: type is verified by content, size is capped, filenames cannot escape the project folder', async () => {
  const P = (await t.owner.post('/api/projects', { title: 'u', category: 'colors' })).data.project;
  const fake = await t.owner.post(`/api/projects/${P.id}/assets?filename=evil.png`, Buffer.from('<?php system($_GET[1]); ?> not an image at all'), { raw: true });
  assert.equal(fake.status, 400); assert.match(fake.data.error.message, /Unsupported file type/);
  const png = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#0f0' } }).png().toBuffer();
  const ok = await t.owner.post(`/api/projects/${P.id}/assets?filename=${encodeURIComponent('../../../etc/evil name.png')}&kind=image`, png, { raw: true });
  assert.equal(ok.status, 201);
  const row = t.ctx.media.get(ok.data.asset.id);
  assert.ok(!row.path.includes('..') && row.path.startsWith(`projects/${P.id}/images/`), row.path);
  assert.ok(fs.existsSync(t.ctx.media.abs(row.path)));
  const big = Buffer.concat([png, Buffer.alloc(1.2 * 1024 * 1024)]);
  const tooBig = await t.owner.post(`/api/projects/${P.id}/assets?filename=big.png`, big, { raw: true });
  assert.ok([400, 413].includes(tooBig.status), String(tooBig.status));
  assert.throws(() => t.ctx.media.projectDir('../escape'));
  assert.throws(() => t.ctx.media.projectDir(P.id, '../x'));
});

test('caption text cannot inject ASS override tags', () => {
  const ass = buildAss([{ start: 0, end: 2, text: '{\\an8\\fs200\\pos(0,0)}مرحبا\\N{\\b1}' }], { width: 1920, height: 1080 });
  const line = ass.split('\n').find((l) => l.startsWith('Dialogue'));
  assert.ok(!/\{/.test(line.split(',,').pop()), line);
});

test('shell metacharacters in narration text are inert (argv/stdin only, never a shell)', { skip: !HAS_MEDIA }, async () => {
  const marker = '/tmp/eak-pwned-marker';
  fs.rmSync(marker, { force: true });
  const P = await buildProject(t, { narrate: false, itemCount: 2, title: 'حقن' });
  const p = (await t.owner.get(`/api/projects/${P.id}`)).data.project;
  await t.owner.patch(`/api/projects/${P.id}/scenes/${p.package.scenes[1].id}`, { narration: `مرحبا "; touch ${marker}; echo " $(touch ${marker}) \`touch ${marker}\` -v ar --help` });
  const n = await t.owner.post(`/api/projects/${P.id}/narration/generate`, { provider: 'espeak', sceneIds: [p.package.scenes[1].id] });
  await t.ctx.jobs.waitFor(n.data.job.id, 120000);
  assert.ok(!fs.existsSync(marker), 'no command was executed');
});

test('role matrix: viewer read-only; editor cannot administer or publish; reviewer cannot generate/render', async () => {
  const mk = async (role) => { await t.owner.post('/api/auth/users', { email: `${role}-m@example.com`, password: 'MatrixPass12345', role }); const c = t.client(); await c.signIn(`${role}-m@example.com`, 'MatrixPass12345'); return c; };
  const [viewer, editor, reviewer] = [await mk('viewer'), await mk('editor'), await mk('reviewer')];
  const P = (await t.owner.post('/api/projects', { title: 'rbac', category: 'colors' })).data.project;
  assert.equal((await viewer.get('/api/projects')).status, 200);
  assert.equal((await viewer.post('/api/projects', { title: 'x', category: 'colors' })).status, 403);
  assert.equal((await editor.post('/api/projects', { title: 'x', category: 'colors' })).status, 201);
  assert.equal((await editor.get('/api/auth/users')).status, 403);
  assert.equal((await editor.post('/api/youtube/connect', {})).status, 403);
  assert.equal((await editor.get('/api/backups')).status, 403);
  assert.equal((await reviewer.post(`/api/projects/${P.id}/generate`, { provider: 'offline_templates', kit: 'colors' })).status, 403);
  assert.equal((await reviewer.post(`/api/projects/${P.id}/render`, {})).status, 403);
  assert.equal((await reviewer.get(`/api/projects/${P.id}/compliance`)).status, 200);
  const spend = await editor.post(`/api/projects/${P.id}/generate`, { provider: 'anthropic', confirmCost: 1 });
  assert.equal(spend.status, 403, 'editors cannot approve paid generation'); assert.match(spend.data.error.message, /owner/i);
});
