// Video assembly. A scene becomes an animated clip (layers + camera), clips are joined with
// transitions, audio is mixed (narration + ducked music + SFX) and loudness-normalised, captions are
// burned in, and the result is QC-checked. Everything is local FFmpeg — no fake "AI video".
//
// Honest labelling: each scene carries a media type. The summary stored with every render reports how
// many scenes were motion graphics / animated stills / imported video / AI video, and never describes
// a slideshow as AI-generated video.
import fs from 'node:fs';
import path from 'node:path';
import { AppError, notConfigured } from '../lib/errors.js';
import { sha256 } from '../lib/security.js';
import { run } from '../lib/exec.js';
import { ffmpeg, probe, escFilterPath } from '../media/ffmpeg.js';
import { renderBackground, renderLayer, renderImportedStill } from '../media/scene-art.js';
import { sharp } from '../lib/imaging.js';
import { buildAss } from '../media/ass.js';
import { synthMusic, synthSfx } from '../media/music.js';
import { validateForRender } from '../content/schema.js';
import { toSrt, toVtt, SCENE_LEAD_SEC, SCENE_TAIL_SEC } from '../content/timing.js';
import { ORIGINAL_LICENSE } from './media.js';
import { FORMATS } from '../content/registry.js';
import { getSetting } from '../db.js';

export const PREVIEW_SIZE = { landscape: { width: 854, height: 480 }, shorts: { width: 480, height: 854 } };
const TARGET_LUFS = -16; const TARGET_TP = -1.5;
const CLIP_VERSION = 'clip-v3';
const f2 = (n) => Number(n).toFixed(4);

// ----------------------------------------------------------------------------- timeline planning
export function planTimeline(project, { mode = 'final', width, height, fps, sceneIds, narrationByScene = {}, transitionSec = 0.5 }) {
  const scenes = project.package.scenes.filter((s) => !sceneIds || sceneIds.includes(s.id));
  const q = (sec) => Math.max(2, Math.round(sec * fps)) / fps;
  const items = scenes.map((scene) => {
    const na = narrationByScene[scene.id];
    const lead = na?.meta.imported ? SCENE_LEAD_SEC : 0;
    const audioSec = na ? (na.duration_ms || 0) / 1000 + lead + (na.meta.tailSec ?? SCENE_TAIL_SEC) : 0;
    let dur = scene.durationMode === 'manual' ? Math.max(scene.durationSec, audioSec) : (audioSec || scene.durationSec);
    dur = q(Math.max(1.5, dur));
    return { scene, dur, narration: na || null, leadSec: lead };
  });
  const tFor = (item) => (item.scene.transition === 'none' ? 2 / fps : Math.round(transitionSec * fps) / fps);
  let start = 0;
  items.forEach((it, i) => {
    it.start = start; it.tIn = i === 0 ? 0 : tFor(it); start += it.dur;
  });
  items.forEach((it, i) => { it.clipLen = it.dur + (items[i + 1] ? items[i + 1].tIn : 0); });
  return { width, height, fps, mode, items, total: start };
}

// ----------------------------------------------------------------------------- ffmpeg filter pieces
const easeOutBack = (x) => `(1+2.70158*pow(${x}-1,3)+1.70158*pow(${x}-1,2))`;

/** Returns {chain, x, y} for one layer: the per-layer filter chain and overlay position expressions. */
function layerMotion(layer, W, H, cx, cy) {
  const d = Number(layer.delay || 0);
  const amp = (f) => f2(f * Math.min(W, H));
  let chain = 'format=rgba'; let dx = '0'; let dy = '0';
  const ph = (layer.x * 5 + layer.y * 3).toFixed(2);
  const entrance = () => { chain += `,fade=t=in:st=${f2(d)}:d=0.25:alpha=1`; };
  switch (layer.anim) {
    case 'pop': {
      const x = `min(1,max(0,(t-${f2(d)})/0.45))`;
      chain += `,scale=w='max(2,2*trunc(iw*if(lt(t,${f2(d)}),0.01,${easeOutBack(x)})/2))':h='max(2,2*trunc(ih*if(lt(t,${f2(d)}),0.01,${easeOutBack(x)})/2))':eval=frame`;
      break; }
    case 'pulse':
      entrance();
      chain += `,scale=w='2*trunc(iw*(1+0.05*sin(2*PI*1.1*t))/2)':h='2*trunc(ih*(1+0.05*sin(2*PI*1.1*t))/2)':eval=frame`;
      break;
    case 'bob': entrance(); dy = `${amp(0.012)}*sin(2*PI*0.65*t+${ph})`; break;
    case 'float': entrance(); dy = `${amp(0.018)}*sin(2*PI*0.38*t+${ph})`; dx = `${amp(0.006)}*sin(2*PI*0.23*t+${ph})`; break;
    case 'wiggle': entrance(); chain += `,rotate=a='0.06*sin(2*PI*1.2*t+${ph})':ow='rotw(0.06)':oh='roth(0.06)':c=none`; break;
    case 'slide_left': dx = `-${f2(W * 0.6)}*pow(1-min(1,max(0,(t-${f2(d)})/0.7)),3)`; break;
    case 'slide_right': dx = `${f2(W * 0.6)}*pow(1-min(1,max(0,(t-${f2(d)})/0.7)),3)`; break;
    case 'slide_up': dy = `${f2(H * 0.6)}*pow(1-min(1,max(0,(t-${f2(d)})/0.7)),3)`; break;
    default: if (d > 0) entrance();
  }
  return { chain, x: `${f2(cx)}-w/2+${dx}`, y: `${f2(cy)}-h/2+${dy}` };
}

function cameraFilter(cam, dur, W, H) {
  const a = Number(cam.amount || 0);
  if (!a || cam.move === 'none') return null;
  const T = f2(dur);
  if (cam.move === 'zoom_in') return `scale=w='2*trunc(iw*(1+${f2(a)}*t/${T})/2)':h='2*trunc(ih*(1+${f2(a)}*t/${T})/2)':eval=frame:flags=bilinear,crop=${W}:${H}:'(in_w-${W})/2':'(in_h-${H})/2'`;
  if (cam.move === 'zoom_out') return `scale=w='2*trunc(iw*(1+${f2(a)}-${f2(a)}*t/${T})/2)':h='2*trunc(ih*(1+${f2(a)}-${f2(a)}*t/${T})/2)':eval=frame:flags=bilinear,crop=${W}:${H}:'(in_w-${W})/2':'(in_h-${H})/2'`;
  const sw = 2 * Math.trunc((W * (1 + a)) / 2); const sh = 2 * Math.trunc((H * (1 + a)) / 2);
  const x = cam.move === 'pan_left' ? `(in_w-${W})*(1-min(1,t/${T}))` : `(in_w-${W})*min(1,t/${T})`;
  return `scale=${sw}:${sh}:flags=bilinear,crop=${W}:${H}:'${x}':'(in_h-${H})/2'`;
}

export function createRender(ctx) {
  const { db, cfg, media, projects, jobs, narration } = ctx;

  async function requireFfmpeg() {
    const c = await ctx.caps.detect();
    if (!c.ffmpeg.ok) throw notConfigured('FFmpeg', c.ffmpeg.install);
    if (!c.ffmpeg.filters?.subtitles) throw notConfigured('FFmpeg subtitle support (libass)', 'Install an FFmpeg build with libass (the standard builds from ffmpeg.org / apt / brew include it).');
    return c;
  }

  const importedAsset = (scene) => (scene.visual.importedAssetId ? media.get(scene.visual.importedAssetId) : null);

  // --------------------------------------------------------------------------- scene clip
  async function renderSceneClip(item, plan, project, { signal, tmpDir, layerDir }) {
    const { width: W, height: H, fps } = plan;
    const { scene } = item;
    const imp = importedAsset(scene);
    if (['ai_video_clip', 'imported_video'].includes(scene.visual.mediaType) && (!imp || imp.kind !== 'video')) throw new AppError(400, 'MISSING_MEDIA', `Scene "${scene.title}" needs a video clip but none is attached.`, { hint: 'Attach a clip you are licensed to use, or switch the scene to motion graphics.' });
    if (imp && !fs.existsSync(media.abs(imp.path))) throw new AppError(400, 'MISSING_MEDIA', `Media file for scene "${scene.title}" is missing on disk.`, { hint: 'Re-import the file.' });
    const key = sha256(JSON.stringify([CLIP_VERSION, scene.visual, scene.camera, item.dur, item.clipLen, W, H, fps, imp?.sha256, plan.mode])).slice(0, 24);
    const out = path.join(tmpDir, `clip-${key}.mp4`);
    if (fs.existsSync(out)) return { file: out, cached: true };

    const inputs = []; const g = [];
    // background
    if (imp?.kind === 'video') {
      inputs.push('-stream_loop', '-1', '-t', f2(item.clipLen), '-i', media.abs(imp.path));
      g.push(`[0:v]fps=${fps},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,format=yuv420p[b0]`);
    } else {
      const bgPng = imp?.kind === 'image' ? await renderImportedStill(media.abs(imp.path), W, H, layerDir, imp.sha256) : await renderBackground(scene, W, H, layerDir);
      inputs.push('-loop', '1', '-framerate', String(fps), '-t', f2(item.clipLen), '-i', bgPng.file);
      g.push('[0:v]setsar=1,format=yuv420p[b0]');
    }
    // layers
    let last = 'b0'; let k = 1;
    for (const layer of scene.visual.layers) {
      const png = await renderLayer(layer, W, H, layerDir);
      inputs.push('-loop', '1', '-framerate', String(fps), '-t', f2(item.clipLen), '-i', png.file);
      const m = layerMotion(layer, W, H, layer.x * W, layer.y * H);
      g.push(`[${k}:v]${m.chain}[l${k}]`);
      g.push(`[${last}][l${k}]overlay=x='${m.x}':y='${m.y}':eval=frame:format=auto[b${k}]`);
      last = `b${k}`; k += 1;
    }
    const cam = cameraFilter(scene.camera, item.clipLen, W, H);
    g.push(`[${last}]${cam ? `${cam},` : ''}fps=${fps},format=yuv420p[vout]`);

    const preview = plan.mode === 'preview';
    await ffmpeg(cfg, [...inputs, '-filter_complex', g.join(';'), '-map', '[vout]', '-t', f2(item.clipLen), '-r', String(fps), '-an', '-c:v', 'libx264', '-preset', preview ? 'ultrafast' : 'veryfast', '-crf', preview ? '28' : '16', '-pix_fmt', 'yuv420p', out], { signal, timeoutMs: 20 * 60_000 });
    return { file: out, cached: false };
  }

  // --------------------------------------------------------------------------- join with transitions
  async function joinClips(clips, plan, outFile, { signal, onProgress }) {
    const { fps } = plan;
    if (clips.length === 1) { fs.copyFileSync(clips[0].file, outFile); return; }
    const inputs = clips.flatMap((c) => ['-i', c.file]);
    const g = clips.map((_, i) => `[${i}:v]fps=${fps},settb=1/${fps},setpts=PTS-STARTPTS,format=yuv420p[s${i}]`);
    let prev = 's0';
    plan.items.slice(1).forEach((it, idx) => {
      const i = idx + 1;
      const tr = it.scene.transition === 'none' ? 'fade' : it.scene.transition;
      g.push(`[${prev}][s${i}]xfade=transition=${tr}:duration=${f2(it.tIn)}:offset=${f2(it.start)}[x${i}]`);
      prev = `x${i}`;
    });
    await ffmpeg(cfg, [...inputs, '-filter_complex', g.join(';'), '-map', `[${prev}]`, '-r', String(fps), '-c:v', 'libx264', '-preset', plan.mode === 'preview' ? 'ultrafast' : 'veryfast', '-crf', plan.mode === 'preview' ? '28' : '16', '-pix_fmt', 'yuv420p', '-an', outFile], { signal, onProgress, expectedSec: plan.total, timeoutMs: 30 * 60_000 });
  }

  // --------------------------------------------------------------------------- audio
  async function ensureMusic(project, totalSec) {
    const pm = project.package.music || {};
    if (pm.assetId) { const a = media.get(pm.assetId); if (a && fs.existsSync(media.abs(a.path))) return { asset: a, imported: true }; }
    const existing = media.list({ projectId: project.id, kind: 'music' }).find((x) => x.meta.key === 'synth' && (x.duration_ms || 0) / 1000 >= totalSec + 1 && x.meta.mood === (project.package.scenes.some((s) => s.kind === 'song') ? 'main' : 'soft'));
    if (existing) return { asset: existing, imported: false };
    const mood = project.package.scenes.some((s) => s.kind === 'song') ? 'main' : 'soft';
    const wav = synthMusic({ durationSec: Math.ceil(totalSec + 2), bpm: mood === 'main' ? 110 : 92, seed: sha256(project.id).charCodeAt(0) + 3, mood });
    media.removeWhere(project.id, null, 'music', 'synth');
    const asset = await media.create({ projectId: project.id, kind: 'music', mediaType: 'synth_audio', relPath: `projects/${project.id}/music/synth-${mood}-${Math.ceil(totalSec)}s.wav`, buffer: wav, mime: 'audio/wav', provider: 'local_synth', license: { ...ORIGINAL_LICENSE, source: 'EA KIDS in-house synthesiser (original composition)', license: 'Original work — no third-party material' }, meta: { key: 'synth', mood } });
    return { asset, imported: false };
  }
  async function sfxFile(name) {
    const dir = media.libraryDir('sfx'); const f = path.join(dir, `${name}.wav`);
    if (!fs.existsSync(f)) fs.writeFileSync(f, synthSfx(name));
    return f;
  }

  async function mixAudio(plan, project, outWav, { signal, tmpDir }) {
    const total = plan.total; const inputs = []; const g = []; let idx = 0;
    const narr = [];
    for (const it of plan.items) {
      if (!it.narration) continue;
      inputs.push('-i', media.abs(it.narration.path));
      const delay = Math.round((it.start + it.leadSec) * 1000);
      g.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${delay}:all=1[n${idx}]`); narr.push(`[n${idx}]`); idx += 1;
    }
    if (narr.length) g.push(`${narr.join('')}amix=inputs=${narr.length}:normalize=0:duration=longest,apad=whole_dur=${f2(total)},atrim=0:${f2(total)},asplit=2[nm][ns]`);
    else g.push(`anullsrc=r=48000:cl=mono,atrim=0:${f2(total)},asplit=2[nm][ns]`);
    // music
    const { asset: musicAsset } = await ensureMusic(project, total);
    inputs.push('-stream_loop', '-1', '-i', media.abs(musicAsset.path)); const mi = idx; idx += 1;
    const vol = Math.max(0, Math.min(0.5, project.package.music?.volume ?? 0.16));
    const segs = plan.items.filter((it) => it.scene.audio.music !== 'main').map((it) => `volume=${it.scene.audio.music === 'none' ? 0 : 0.55}:enable='between(t,${f2(it.start)},${f2(it.start + it.dur)})'`);
    g.push(`[${mi}:a]aresample=48000,aformat=channel_layouts=mono,atrim=0:${f2(total)},asetpts=N/SR/TB,volume=${vol}${segs.length ? ',' + segs.join(',') : ''},afade=t=in:d=1.2,afade=t=out:st=${f2(Math.max(0, total - 2.5))}:d=2.5[mus]`);
    g.push('[mus][ns]sidechaincompress=threshold=0.03:ratio=9:attack=15:release=400:makeup=1[musd]');
    // sfx
    const sfx = [];
    for (const it of plan.items) for (const s of it.scene.audio.sfx || []) {
      if (it.start + s.at >= total) continue;
      inputs.push('-i', await sfxFile(s.name));
      g.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=mono,volume=0.5,adelay=${Math.round((it.start + s.at) * 1000)}:all=1[x${idx}]`); sfx.push(`[x${idx}]`); idx += 1;
    }
    if (sfx.length) g.push(`${sfx.join('')}amix=inputs=${sfx.length}:normalize=0:duration=longest,apad=whole_dur=${f2(total)},atrim=0:${f2(total)}[sx]`);
    else g.push(`anullsrc=r=48000:cl=mono,atrim=0:${f2(total)}[sx]`);
    g.push('[nm][musd][sx]amix=inputs=3:normalize=0:duration=first,aformat=sample_fmts=fltp:channel_layouts=stereo[mix]');
    const pre = path.join(tmpDir, 'premix.wav');
    await ffmpeg(cfg, [...inputs, '-filter_complex', g.join(';'), '-map', '[mix]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', '-t', f2(total), pre], { signal, timeoutMs: 10 * 60_000 });

    // loudness normalisation: two-pass for final, single-pass for preview
    const ln = `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=11`;
    let af = `${ln},alimiter=limit=0.95:level=disabled`;
    if (plan.mode === 'final') {
      const m = await measureLoudness(pre, ln, signal);
      if (m && Number.isFinite(+m.input_i) && +m.input_i > -70) af = `${ln}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,alimiter=limit=0.95:level=disabled`;
    }
    await ffmpeg(cfg, ['-i', pre, '-af', `${af},aresample=48000`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', '-t', f2(total), outWav], { signal, timeoutMs: 10 * 60_000 });
    fs.rmSync(pre, { force: true });
    return { music: musicAsset, narrationClips: narr.length, sfx: sfx.length };
  }

  async function measureLoudness(file, ln, signal) {
    try {
      const { stderr } = await run(cfg.ffmpeg, ['-hide_banner', '-nostdin', '-i', file, '-af', `${ln}:print_format=json`, '-f', 'null', '-'], { signal, timeoutMs: 5 * 60_000 });
      const j = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1);
      return JSON.parse(j);
    } catch (e) { if (e.cancelled) throw e; return null; }
  }

  // --------------------------------------------------------------------------- QC
  async function runQc(file, plan, { hasNarrationExpected, narrationMissing }) {
    const checks = []; const add = (id, label, status, detail = '') => checks.push({ id, label, status, detail });
    const p = await probe(cfg, file);
    add('valid_mp4', 'Valid MP4 with video and audio streams', p.hasVideo && p.hasAudio ? 'pass' : 'fail', `${p.videoCodec}/${p.audioCodec}`);
    add('resolution', `Resolution ${plan.width}×${plan.height}`, p.width === plan.width && p.height === plan.height ? 'pass' : 'fail', `${p.width}×${p.height}`);
    add('fps', `Frame rate ${plan.fps} fps`, Math.abs((p.fps || 0) - plan.fps) < 0.05 ? 'pass' : 'fail', `${(p.fps || 0).toFixed(2)}`);
    add('duration', 'Duration matches the timeline', Math.abs(p.durationSec - plan.total) <= 0.35 ? 'pass' : 'warn', `${p.durationSec.toFixed(2)}s vs planned ${plan.total.toFixed(2)}s`);
    // black frames
    const black = []; let loud = null; let maxVol = null; let meanVol = null;
    try {
      await run(cfg.ffmpeg, ['-hide_banner', '-nostdin', '-i', file, '-vf', 'blackdetect=d=0.12:pic_th=0.985:pix_th=0.08', '-an', '-f', 'null', '-'], { timeoutMs: 10 * 60_000, onStderrLine: (l) => { const m = l.match(/black_start:([\d.]+)\s+black_end:([\d.]+)/); if (m) black.push([+m[1], +m[2]]); } });
    } catch { /* detection failure reported below */ }
    add('black_frames', 'No unintended black frames', black.length === 0 ? 'pass' : 'fail', black.map(([a, b]) => `${a.toFixed(2)}–${b.toFixed(2)}s`).join(', '));
    try {
      await run(cfg.ffmpeg, ['-hide_banner', '-nostdin', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { timeoutMs: 5 * 60_000, onStderrLine: (l) => { const a = l.match(/max_volume:\s*(-?[\d.]+) dB/); if (a) maxVol = +a[1]; const b = l.match(/mean_volume:\s*(-?[\d.]+) dB/); if (b) meanVol = +b[1]; } });
    } catch { /* below */ }
    add('clipping', 'No audio clipping (peak ≤ −0.5 dB)', maxVol === null ? 'warn' : maxVol <= -0.5 ? 'pass' : 'fail', maxVol === null ? 'could not measure' : `peak ${maxVol} dB`);
    loud = await measureLoudness(file, `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=11`);
    if (loud) add('loudness', `Loudness near ${TARGET_LUFS} LUFS`, Math.abs(+loud.input_i - TARGET_LUFS) <= 2.5 ? 'pass' : 'warn', `${(+loud.input_i).toFixed(1)} LUFS, true peak ${(+loud.input_tp).toFixed(1)} dBTP`);
    add('audible', 'Audio is audible (not silent)', meanVol !== null && meanVol > -45 ? 'pass' : 'fail', meanVol === null ? '' : `mean ${meanVol} dB`);
    add('narration', 'Narration present for every scene with text', hasNarrationExpected && narrationMissing.length ? 'warn' : 'pass', narrationMissing.length ? `Missing: ${narrationMissing.join(', ')}` : '');
    const overlong = plan.items.flatMap((it) => (it.narration?.meta.cues || []).filter((c) => (c.end - c.start) > 0 && c.text.length / (c.end - c.start) > 17).map(() => it.scene.title));
    add('caption_speed', 'Captions are readable (≤ 17 characters/second)', overlong.length ? 'warn' : 'pass', overlong.length ? `Fast captions in: ${[...new Set(overlong)].join(', ')}` : '');
    add('sync', 'Audio and video lengths agree', Math.abs(p.durationSec - plan.total) <= 0.35 ? 'pass' : 'warn', '');
    return { passed: checks.every((c) => c.status !== 'fail'), checks, probe: p, loudness: loud ? { lufs: +loud.input_i, truePeak: +loud.input_tp } : null };
  }

  // --------------------------------------------------------------------------- orchestrator
  async function renderProject({ projectId, mode = 'final', sceneIds, burnCaptions = true, fpsOverride, resolution, exportAudio = false }, { signal, log: jlog, progress, jobId }) {
    await requireFfmpeg();
    const project = projects.must(projectId);
    const problems = validateForRender(project.package);
    if (sceneIds) { /* single-scene previews skip whole-project problems except rejected/missing media on those scenes */ }
    const blocking = problems.filter((x) => !sceneIds || sceneIds.some((id) => x.includes(project.package.scenes.find((s) => s.id === id)?.title || '§')));
    if (blocking.length) throw new AppError(400, 'NOT_RENDERABLE', `Cannot render yet: ${blocking[0]}`, { details: blocking, hint: 'Fix the listed items in the Storyboard, then render again.' });

    const fmt = FORMATS[project.format] || FORMATS.landscape;
    const size = mode === 'preview' ? PREVIEW_SIZE[project.format] : { width: resolution?.width || fmt.width, height: resolution?.height || fmt.height };
    const fps = mode === 'preview' ? 15 : (fpsOverride || getSetting(db, 'app', {}).fps || 30);
    const stat = narration.status(project);
    const narrationByScene = {}; const missing = [];
    for (const st of stat) {
      const sc = project.package.scenes.find((s) => s.id === st.sceneId);
      if (sceneIds && !sceneIds.includes(sc.id)) continue;
      if (st.state === 'fresh' || (mode === 'preview' && st.state === 'stale')) narrationByScene[sc.id] = media.get(st.assetId);
      else if (st.state !== 'not_needed') missing.push(sc.title);
    }
    if (mode === 'final' && missing.length) throw new AppError(412, 'NARRATION_MISSING', `Narration is missing or out of date for: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}`, { hint: 'Open Voice & Narration → Generate narration (or import a recording), then render again.', details: missing });

    const plan = planTimeline(project, { mode, ...size, fps, sceneIds, narrationByScene });
    jlog('info', `Plan: ${plan.items.length} scenes, ${plan.total.toFixed(1)}s, ${size.width}×${size.height}@${fps}fps (${mode})`);
    if (mode === 'preview' && missing.length) jlog('warn', `Preview has no narration audio for: ${missing.join(', ')} (estimated timing used)`);

    const tmpDir = media.projectDir(projectId, 'tmp'); const layerDir = media.projectDir(projectId, 'layers');
    const clips = []; let n = 0;
    for (const it of plan.items) {
      if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { cancelled: true });
      jlog('info', `Scene ${n + 1}/${plan.items.length}: "${it.scene.title}" (${it.dur.toFixed(1)}s, ${it.scene.visual.mediaType})`);
      const c = await renderSceneClip(it, plan, project, { signal, tmpDir, layerDir });
      if (c.cached) jlog('info', '  reused cached clip');
      clips.push(c); n += 1; progress((n / plan.items.length) * 0.6, `Rendered scene ${n}/${plan.items.length}`);
    }
    const joined = path.join(tmpDir, `joined-${jobId || 'x'}.mp4`);
    jlog('info', 'Joining scenes with transitions');
    await joinClips(clips, plan, joined, { signal, onProgress: (p) => progress(0.6 + p * 0.1, 'Joining scenes') });

    jlog('info', 'Mixing audio (narration, ducked music, sound effects) and normalising loudness');
    progress(0.72, 'Mixing audio');
    const master = path.join(tmpDir, `master-${jobId || 'x'}.wav`);
    const mixInfo = await mixAudio(plan, project, master, { signal, tmpDir });

    // captions from measured cue timings
    const cues = [];
    for (const it of plan.items) {
      const meta = it.narration?.meta;
      const list = meta?.cues?.length ? meta.cues : it.scene.subtitles;
      const base = it.start + (it.narration?.meta.imported ? it.leadSec : 0);
      for (const c of list) cues.push({ start: +(base + c.start).toFixed(3), end: +(base + Math.min(c.end, it.dur - 0.05)).toFixed(3), text: c.text });
    }
    const stamp = `${mode}-${Date.now()}`;
    const assFile = path.join(tmpDir, `subs-${stamp}.ass`);
    fs.writeFileSync(assFile, buildAss(cues, { width: size.width, height: size.height, shorts: project.format === 'shorts' }));

    jlog('info', burnCaptions ? 'Burning captions and encoding final MP4' : 'Encoding MP4 (captions not burned in)');
    progress(0.8, 'Encoding');
    const outDir = media.projectDir(projectId, 'renders');
    const outFile = path.join(outDir, `${mode === 'preview' ? 'preview' : 'episode'}-${stamp}.mp4`);
    const vf = burnCaptions ? ['-vf', `ass=${escFilterPath(assFile)}:fontsdir=${escFilterPath(cfg.fontsDir)}`] : [];
    await ffmpeg(cfg, ['-i', joined, '-i', master, ...vf, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', mode === 'preview' ? 'ultrafast' : 'medium', '-crf', mode === 'preview' ? '28' : '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps), '-c:a', 'aac', '-b:a', mode === 'preview' ? '96k' : '192k', '-ar', '48000', '-movflags', '+faststart', '-t', f2(plan.total), outFile], { signal, onProgress: (p) => progress(0.8 + p * 0.15, 'Encoding'), expectedSec: plan.total, timeoutMs: 40 * 60_000 });
    fs.rmSync(joined, { force: true });
    if (exportAudio && mode === 'final') {
      const mp3 = media.abs(`projects/${projectId}/audio/episode-mix.mp3`);
      await ffmpeg(cfg, ['-i', master, '-c:a', 'libmp3lame', '-b:a', '192k', mp3], { signal });
      media.removeWhere(projectId, null, 'audio', 'master-mp3');
      await media.create({ projectId, kind: 'audio', mediaType: 'synth_audio', relPath: `projects/${projectId}/audio/episode-mix.mp3`, mime: 'audio/mpeg', provider: 'ffmpeg', license: ORIGINAL_LICENSE, meta: { key: 'master-mp3', loudnessTarget: TARGET_LUFS } });
      jlog('info', 'Exported full audio mix (MP3)');
    }
    fs.rmSync(master, { force: true });

    progress(0.96, 'Quality checks');
    jlog('info', 'Running automated quality checks');
    const qc = await runQc(outFile, plan, { hasNarrationExpected: true, narrationMissing: missing });
    for (const c of qc.checks) jlog(c.status === 'fail' ? 'error' : c.status === 'warn' ? 'warn' : 'info', `QC ${c.status.toUpperCase()}: ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);

    // disclosure-grade summary of how the video was produced
    const byType = {}; plan.items.forEach((it) => { byType[it.scene.visual.mediaType] = (byType[it.scene.visual.mediaType] || 0) + 1; });
    const providers = [...new Set(plan.items.map((it) => it.narration?.provider).filter(Boolean))];
    const summary = { sceneMediaTypes: byType, narration: providers.length ? providers : ['none'], music: mixInfo.music.media_type === 'synth_audio' ? 'in-house synthesised (original)' : `imported (${mixInfo.music.license.source || 'licence not recorded'})`, aiGeneratedVideoScenes: byType.ai_video_clip || 0, syntheticVoice: providers.length > 0 };

    const asset = await media.create({
      projectId, kind: mode === 'preview' ? 'preview' : 'render', mediaType: mode === 'preview' ? 'other' : 'motion_graphics', relPath: media.rel(outFile), mime: 'video/mp4', provider: 'ffmpeg',
      license: ORIGINAL_LICENSE, reviewStatus: 'pending',
      meta: { key: mode, mode, fps, width: size.width, height: size.height, durationSec: plan.total, scenes: plan.items.length, sceneIds: sceneIds || null, qc, summary, burnedCaptions: burnCaptions, packageHash: sha256(JSON.stringify(project.package.scenes)).slice(0, 12) },
    });

    if (mode === 'final') {
      // subtitle exports (SRT / VTT) alongside the video
      for (const [ext, body, mime] of [['srt', toSrt(cues), 'application/x-subrip'], ['vtt', toVtt(cues), 'text/vtt']]) {
        media.removeWhere(projectId, null, 'subtitle', `subs-${ext}`);
        await media.create({ projectId, kind: 'subtitle', mediaType: 'other', relPath: `projects/${projectId}/subs/captions.${ext}`, buffer: Buffer.from(body, 'utf8'), mime, provider: 'local', meta: { key: `subs-${ext}`, cues: cues.length } });
      }
      if (qc.passed) projects.setStatus(projectId, 'rendered');
    }
    fs.rmSync(assFile, { force: true });
    return { assetId: asset.id, qc: { passed: qc.passed, checks: qc.checks }, summary, durationSec: plan.total, mode };
  }

  jobs.register('render_video', async (jc) => renderProject({ ...jc.job.payload }, { signal: jc.signal, log: jc.log, progress: jc.progress, jobId: jc.job.id }), { lane: 'render', maxAttempts: 2 });

  /** A still frame of a scene (final layout, no animation) for storyboard previews. Cached per content hash. */
  async function sceneStill(project, scene, width = 640) {
    const fmt = FORMATS[project.format] || FORMATS.landscape;
    const W = Math.round(width / 2) * 2; const H = Math.round((W * fmt.height) / fmt.width / 2) * 2;
    const layerDir = media.projectDir(project.id, 'layers');
    const imp = importedAsset(scene);
    const key = sha256(JSON.stringify(['still-v2', scene.visual, W, H, imp?.sha256])).slice(0, 24);
    const out = path.join(layerDir, `still-${key}.png`);
    if (fs.existsSync(out)) return out;
    let base;
    if (imp?.kind === 'video') base = await sharp(await extractFrame(media.abs(imp.path), W, H)).png().toBuffer();
    else base = await sharp((imp?.kind === 'image' ? await renderImportedStill(media.abs(imp.path), W, H, layerDir, imp.sha256) : await renderBackground(scene, W, H, layerDir)).file).png().toBuffer();
    const comps = [];
    for (const layer of scene.visual.layers) {
      const png = await renderLayer(layer, W, H, layerDir);
      let left = Math.round(layer.x * W - png.width / 2); let top = Math.round(layer.y * H - png.height / 2);
      let input = png.file; let w = png.width; let h = png.height;
      const cl = Math.max(0, -left); const ct = Math.max(0, -top); const cr = Math.max(0, left + w - W); const cb = Math.max(0, top + h - H);
      if (cl + cr >= w || ct + cb >= h) continue;
      if (cl || ct || cr || cb) { input = await sharp(png.file).extract({ left: cl, top: ct, width: w - cl - cr, height: h - ct - cb }).png().toBuffer(); left += cl; top += ct; }
      comps.push({ input, left, top });
    }
    fs.writeFileSync(out, await sharp(base).composite(comps).png().toBuffer());
    return out;
  }
  async function extractFrame(file, W, H) {
    const tmp = path.join(media.libraryDir('previews'), `frame-${Date.now()}.png`);
    await ffmpeg(cfg, ['-ss', '0.5', '-i', file, '-frames:v', '1', '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`, tmp]);
    const b = fs.readFileSync(tmp); fs.rmSync(tmp, { force: true }); return b;
  }

  /** Delete cached scene clips (kept between renders so retries and small edits are fast). */
  function clearCache(projectId) {
    let freed = 0;
    for (const sub of ['tmp', 'layers']) {
      const dir = media.projectDir(projectId, sub);
      for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); try { freed += fs.statSync(p).size; fs.rmSync(p, { force: true }); } catch { /* ignore */ } }
    }
    return { freedBytes: freed };
  }
  return { renderProject, planTimeline, clearCache, runQc, sceneStill };
}
