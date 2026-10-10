import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { startTestServer, buildProject, HAS_MEDIA, sleep } from './helpers.js';

const skip = !HAS_MEDIA && 'ffmpeg / ffprobe / espeak-ng not installed';
let t; let P; let narrationJobId;
before(async () => { t = await startTestServer(); await t.ctx.seedPromise; });
after(async () => { await t.close(); });

const ffprobe = (file) => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]).toString());
const sh = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostdin', ...args], { encoding: 'utf8' }); return { status: r.status, stderr: r.stderr || '' }; };

test('final render is refused with a clear message when narration is missing', { skip }, async () => {
  P = await buildProject(t, { narrate: false });
  const job = t.ctx.jobs.enqueue('render_video', { projectId: P.id, payload: { projectId: P.id, mode: 'final' } });
  const done = await t.ctx.jobs.waitFor(job.id, 20000);
  assert.equal(done.status, 'failed');
  assert.equal(done.error.code, 'NARRATION_MISSING');
  assert.match(done.error.hint, /Generate narration/);
});

test('a single-scene preview renders without narration (estimated timing) and is a valid MP4', { skip }, async () => {
  const p = (await t.owner.get(`/api/projects/${P.id}`)).data.project;
  const sc = p.package.scenes[1];
  const r = await t.owner.post(`/api/projects/${P.id}/render`, { mode: 'preview', sceneIds: [sc.id] });
  assert.equal(r.status, 202);
  const job = await t.ctx.jobs.waitFor(r.data.job.id, 120000);
  assert.equal(job.status, 'succeeded', JSON.stringify(job.error));
  const asset = t.ctx.media.get(job.result.assetId);
  assert.equal(asset.kind, 'preview'); assert.equal(asset.width, 854);
  const info = ffprobe(t.ctx.media.abs(asset.path));
  assert.ok(info.streams.some((s) => s.codec_type === 'video') && info.streams.some((s) => s.codec_type === 'audio'));
});

test('narration: per-scene audio is attached to the right scene with measured, monotonic cue timings', { skip }, async () => {
  const n = await t.owner.post(`/api/projects/${P.id}/narration/generate`, { provider: 'espeak' });
  assert.equal(n.status, 202); narrationJobId = n.data.job.id;
  const job = await t.ctx.jobs.waitFor(narrationJobId, 180000);
  assert.equal(job.status, 'succeeded', JSON.stringify(job.error));
  assert.ok(job.progress === 1);
  const p = (await t.owner.get(`/api/projects/${P.id}`)).data.project;
  const sceneIds = new Set(p.package.scenes.map((s) => s.id));
  const audio = t.ctx.media.list({ projectId: P.id, kind: 'audio' }).filter((a) => a.meta.key === 'narration');
  assert.equal(audio.length, p.package.scenes.filter((s) => s.narration).length);
  for (const a of audio) {
    assert.ok(sceneIds.has(a.scene_id), 'asset belongs to a scene of this project');
    const scene = p.package.scenes.find((s) => s.id === a.scene_id);
    assert.equal(a.meta.cues.length, scene.narration.split(/(?<=[.!?؟])\s+/).filter(Boolean).length);
    let prev = 0; for (const c of a.meta.cues) { assert.ok(c.start >= prev && c.end > c.start); prev = c.end; }
    assert.ok(Math.abs(a.duration_ms / 1000 - (a.meta.cues.at(-1).end + a.meta.gapSec)) < 0.1, 'cue timeline matches the measured audio length');
    assert.equal(a.license.source, 'espeak-ng (local)');
  }
  const st = (await t.owner.get(`/api/projects/${P.id}/narration`)).data.status;
  assert.ok(st.every((s) => ['fresh', 'not_needed'].includes(s.state)));
  const again = await t.owner.post(`/api/projects/${P.id}/narration/generate`, {});
  assert.equal(again.data.upToDate, true, 'nothing re-synthesised when text is unchanged');
});

test('final render: valid MP4 at the requested size/fps, synced audio, QC passes, honest production summary', { skip }, async () => {
  const t0 = Date.now();
  const job = t.ctx.jobs.enqueue('render_video', { projectId: P.id, payload: { projectId: P.id, mode: 'final', resolution: { width: 640, height: 360 }, exportAudio: true } });
  const done = await t.ctx.jobs.waitFor(job.id, 600000);
  assert.equal(done.status, 'succeeded', JSON.stringify(done.error));
  assert.equal(done.progress, 1);
  const asset = t.ctx.media.get(done.result.assetId);
  assert.equal(asset.kind, 'render'); assert.equal(asset.mime, 'video/mp4');
  const info = ffprobe(t.ctx.media.abs(asset.path));
  const v = info.streams.find((s) => s.codec_type === 'video'); const a = info.streams.find((s) => s.codec_type === 'audio');
  assert.equal(v.width, 640); assert.equal(v.height, 360); assert.equal(v.codec_name, 'h264'); assert.equal(v.pix_fmt, 'yuv420p'); assert.equal(v.avg_frame_rate, '30/1');
  assert.equal(a.codec_name, 'aac');
  const dur = Number(info.format.duration);
  assert.ok(Math.abs(dur - asset.meta.durationSec) < 0.3, `duration ${dur} vs plan ${asset.meta.durationSec}`);
  assert.ok(Math.abs(Number(v.duration) - Number(a.duration)) < 0.25, 'audio/video lengths agree');
  // QC (ours)
  assert.equal(done.result.qc.passed, true, JSON.stringify(done.result.qc.checks.filter((c) => c.status !== 'pass')));
  // independent verification: whole file decodes without errors, no black frames, no clipping
  const dec = sh(['-v', 'error', '-i', t.ctx.media.abs(asset.path), '-f', 'null', '-']);
  assert.ok(!dec.stderr || dec.stderr.length === 0, `decode errors: ${dec.stderr}`);
  const bd = sh(['-i', t.ctx.media.abs(asset.path), '-vf', 'blackdetect=d=0.1:pic_th=0.98:pix_th=0.08', '-an', '-f', 'null', '-']);
  assert.ok(!/black_start/.test(String(bd.stderr)), 'no black frames');
  const vd = sh(['-i', t.ctx.media.abs(asset.path), '-vn', '-af', 'volumedetect', '-f', 'null', '-']);
  const peak = Number(String(vd.stderr).match(/max_volume: (-?[\d.]+) dB/)[1]);
  assert.ok(peak < -0.5, `peak ${peak} dB`);
  // production summary never calls a slideshow "AI video"
  assert.equal(asset.meta.summary.aiGeneratedVideoScenes, 0);
  assert.equal(asset.meta.summary.sceneMediaTypes.motion_graphics, 5);
  assert.deepEqual(asset.meta.summary.narration, ['espeak']);
  assert.match(asset.meta.summary.music, /in-house/);
  // exports
  const subs = t.ctx.media.list({ projectId: P.id, kind: 'subtitle' }).map((x) => x.filename).sort();
  assert.deepEqual(subs, ['captions.srt', 'captions.vtt']);
  assert.ok(t.ctx.media.list({ projectId: P.id, kind: 'audio' }).some((x) => x.meta.key === 'master-mp3'));
  const srt = (await t.owner.get(`/api/projects/${P.id}/subtitles.srt`)).data.toString();
  assert.match(srt, /^1\n\d\d:\d\d:\d\d,\d{3} --> \d\d:\d\d:\d\d,\d{3}\n/);
  const vtt = (await t.owner.get(`/api/projects/${P.id}/subtitles.vtt`)).data.toString();
  assert.match(vtt, /^WEBVTT/);
  assert.ok(/[\u0600-\u06FF]/.test(srt), 'Arabic text preserved');
  console.log(`      final render took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const logs = t.ctx.jobs.logs(job.id).map((l) => l.message).join('\n');
  assert.match(logs, /QC PASS/);
});

test('re-render reuses cached scene clips (error recovery / fast retries)', { skip }, async () => {
  const job = t.ctx.jobs.enqueue('render_video', { projectId: P.id, payload: { projectId: P.id, mode: 'final', resolution: { width: 640, height: 360 } } });
  const done = await t.ctx.jobs.waitFor(job.id, 600000);
  assert.equal(done.status, 'succeeded');
  const reused = t.ctx.jobs.logs(job.id).filter((l) => /reused cached clip/.test(l.message)).length;
  assert.equal(reused, 5);
});

test('editing narration makes it stale; final render is blocked; only the edited scene is re-narrated', { skip }, async () => {
  const p = (await t.owner.get(`/api/projects/${P.id}`)).data.project; const sc = p.package.scenes[2];
  await t.owner.patch(`/api/projects/${P.id}/scenes/${sc.id}`, { narration: 'جملة جديدة تمامًا لهذا المشهد. وجملة أخرى!' });
  const st = (await t.owner.get(`/api/projects/${P.id}/narration`)).data.status;
  assert.equal(st.find((s) => s.sceneId === sc.id).state, 'stale');
  assert.equal(st.filter((s) => s.state === 'fresh').length, 4);
  const blocked = t.ctx.jobs.enqueue('render_video', { projectId: P.id, payload: { projectId: P.id, mode: 'final', resolution: { width: 640, height: 360 } } });
  assert.equal((await t.ctx.jobs.waitFor(blocked.id, 20000)).error.code, 'NARRATION_MISSING');
  const n = await t.owner.post(`/api/projects/${P.id}/narration/generate`, {});
  assert.equal(n.data.scenes, 1);
  assert.equal((await t.ctx.jobs.waitFor(n.data.job.id, 120000)).status, 'succeeded');
});

test('rejected scenes block rendering until revised or approved', { skip }, async () => {
  const p = (await t.owner.get(`/api/projects/${P.id}`)).data.project; const sc = p.package.scenes[1];
  await t.owner.post(`/api/projects/${P.id}/scenes/${sc.id}/review`, { status: 'rejected', note: 'Lion looks distorted' });
  const r = await t.owner.post(`/api/projects/${P.id}/render`, { mode: 'final' });
  const job = await t.ctx.jobs.waitFor(r.data.job.id, 20000);
  assert.equal(job.status, 'failed'); assert.equal(job.error.code, 'NOT_RENDERABLE'); assert.match(job.error.message, /rejected/);
  await t.owner.post(`/api/projects/${P.id}/scenes/${sc.id}/review`, { status: 'approved' });
});

test('a queued/running render can be cancelled', { skip }, async () => {
  const job = t.ctx.jobs.enqueue('render_video', { projectId: P.id, payload: { projectId: P.id, mode: 'preview' } });
  await sleep(300);
  t.ctx.jobs.cancel(job.id);
  const done = await t.ctx.jobs.waitFor(job.id, 60000);
  assert.ok(['cancelled', 'succeeded'].includes(done.status));
  const dup = await t.owner.post(`/api/projects/${P.id}/render`, { mode: 'preview' });
  assert.ok([202, 409].includes(dup.status));
  if (dup.status === 202) await t.ctx.jobs.waitFor(dup.data.job.id, 120000);
});

test('YouTube Shorts format renders 9:16 with a Shorts-safe layout', { skip }, async () => {
  const S = await buildProject(t, { format: 'shorts', itemCount: 2, title: 'شورتس اختبار' });
  const r = await t.owner.post(`/api/projects/${S.id}/render`, { mode: 'preview' });
  const job = await t.ctx.jobs.waitFor(r.data.job.id, 180000);
  assert.equal(job.status, 'succeeded', JSON.stringify(job.error));
  const asset = t.ctx.media.get(job.result.assetId);
  assert.equal(asset.width, 480); assert.equal(asset.height, 854);
  assert.ok(job.result.qc.passed, JSON.stringify(job.result.qc.checks.filter((c) => c.status === 'fail')));
});

test('missing media is reported clearly (attached video clip deleted from disk)', { skip }, async () => {
  const M = await buildProject(t, { narrate: false, itemCount: 2, title: 'وسائط مفقودة' });
  const p = (await t.owner.get(`/api/projects/${M.id}`)).data.project; const sc = p.package.scenes[1];
  await t.owner.patch(`/api/projects/${M.id}/scenes/${sc.id}`, { visual: { mediaType: 'ai_video_clip' } });
  const r = await t.owner.post(`/api/projects/${M.id}/render`, { mode: 'preview', sceneIds: [sc.id] });
  const job = await t.ctx.jobs.waitFor(r.data.job.id, 60000);
  assert.equal(job.status, 'failed'); assert.match(job.error.message, /ai_video_clip|video clip/i);
  assert.ok(fs.existsSync(t.ctx.media.projectDir(M.id)));
});
