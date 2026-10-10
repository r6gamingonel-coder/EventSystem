import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.NODE_ENV = 'test';
const { createApp, listen } = await import('../server/app.js');

/** Boots an isolated app (own temp data dir + db) on a random port, with a cookie-aware client. */
export async function startTestServer(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eak-test-'));
  const { app, ctx } = await createApp({ DATA_DIR: dir, PORT: '0', JOB_POLL_MS: '50', JOB_RETRY_BASE_MS: '30', NODE_ENV: 'test', ...overrides });
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  ctx.jobs.start();
  const mk = () => {
    let cookie = ''; let csrf = '';
    const call = async (method, url, body, extra = {}) => {
      const headers = { ...(cookie ? { cookie } : {}), ...(csrf ? { 'x-csrf-token': csrf } : {}), ...(extra.headers || {}) };
      let payload = body;
      if (body !== undefined && !Buffer.isBuffer(body) && !extra.raw) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
      const res = await fetch(base + url, { method, headers, body: payload });
      const sc = res.headers.getSetCookie?.() ?? [];
      if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
      return { status: res.status, data, headers: res.headers };
    };
    return {
      get: (u) => call('GET', u), post: (u, b, e) => call('POST', u, b ?? {}, e), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b), del: (u) => call('DELETE', u),
      async signIn(email, password) { const r = await call('POST', '/api/auth/login', { email, password }); if (r.status === 200) csrf = r.data.csrf; return r; },
      setCsrf: (c) => { csrf = c; }, call,
    };
  };
  const owner = mk();
  await owner.post('/api/auth/setup', { email: 'owner@example.com', name: 'Owner', password: 'Sup3rSecretPass' });
  await owner.signIn('owner@example.com', 'Sup3rSecretPass');
  return {
    base, ctx, owner, client: mk, dir,
    async close() { server.close(); await ctx.close(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

import { execFileSync } from 'node:child_process';
export const hasBin = (b, a = ['-version']) => { try { execFileSync(b, a, { stdio: 'ignore' }); return true; } catch { return false; } };
export const HAS_MEDIA = hasBin('ffmpeg') && hasBin('ffprobe') && hasBin('espeak-ng', ['--version']);

/** Create a project from an offline kit, narrate it, and (optionally) do a small final render. */
export async function buildProject(t, { kit = 'colors', itemCount = 2, format = 'landscape', title = 'مشروع اختبار', narrate = true, render = false, resolution = { width: 640, height: 360 } } = {}) {
  const c = await t.owner.post('/api/projects', { title, category: ({ colors: 'colors', numbers: 'numbers', song_colors: 'songs' })[kit] || 'colors', language: 'ar', format, targetDurationSec: 60 });
  const id = c.data.project.id;
  const g = await t.owner.post(`/api/projects/${id}/generate`, { provider: 'offline_templates', kit, itemCount });
  await t.ctx.jobs.waitFor(g.data.job.id, 20000);
  if (narrate) { const n = await t.owner.post(`/api/projects/${id}/narration/generate`, { provider: 'espeak' }); await t.ctx.jobs.waitFor(n.data.job.id, 180000); }
  let renderJob = null;
  if (render) { renderJob = t.ctx.jobs.enqueue('render_video', { projectId: id, payload: { projectId: id, mode: 'final', resolution, exportAudio: true } }); renderJob = await t.ctx.jobs.waitFor(renderJob.id, 600000); }
  return { id, renderJob };
}

/** Bring a project to a state where compliance can be approved (scenes approved → final render → thumbnails → review). */
export async function makeApprovable(t, id, { renderIt = true } = {}) {
  const p = (await t.owner.get(`/api/projects/${id}`)).data.project;
  for (const s of p.package.scenes) await t.owner.post(`/api/projects/${id}/scenes/${s.id}/review`, { status: 'approved' });
  if (renderIt) { const j = t.ctx.jobs.enqueue('render_video', { projectId: id, payload: { projectId: id, mode: 'final', resolution: { width: 640, height: 360 } } }); const d = await t.ctx.jobs.waitFor(j.id, 600000); if (d.status !== 'succeeded') throw new Error(`render failed: ${JSON.stringify(d.error)}`); }
  const q = (await t.owner.get(`/api/projects/${id}`)).data.project.package;
  await t.owner.put(`/api/projects/${id}/factcheck`, { items: q.factCheck.map((f) => ({ ...f, status: 'verified', source: 'Checked against a textbook' })) });
  await t.owner.put(`/api/projects/${id}/checklist`, { items: q.reviewChecklist.map((c) => ({ ...c, done: true })) });
  await t.owner.post(`/api/projects/${id}/thumbnails/generate`, {});
  await t.owner.put(`/api/projects/${id}/compliance/review`, { audience: { madeForKids: true, rationale: 'Cartoon educational video for ages 3-6.' }, manual: { watched_full: true, accuracy: true, value_add: true, licences_ok: true, no_child_data: true } });
}
