// Narration: per-sentence TTS → measured durations → assembled scene audio with exact cue timings.
import fs from 'node:fs';
import path from 'node:path';
import { newId, sha256 } from '../lib/security.js';
import { AppError } from '../lib/errors.js';
import { ffmpeg, probe } from '../media/ffmpeg.js';
import { createTts, applyPronunciations, TTS_INFO } from '../providers/tts.js';
import { splitCues, CUE_GAP_SEC, SCENE_LEAD_SEC, SCENE_TAIL_SEC } from '../content/timing.js';
import { getSetting, setSetting } from '../db.js';

export const DEFAULT_TTS = { provider: 'espeak', voice: '', speed: 1 };

export function createNarration(ctx) {
  const { db, cfg, media, projects, jobs, costs } = ctx;
  const tts = createTts(ctx);

  const settings = () => ({ ...DEFAULT_TTS, ...getSetting(db, 'tts', {}) });
  const saveSettings = (s) => setSetting(db, 'tts', { ...DEFAULT_TTS, ...s });
  const lexicon = (language) => db.all('SELECT word, replacement FROM pronunciations WHERE language = ? ORDER BY word', language);
  const lexHash = (language) => sha256(JSON.stringify(lexicon(language))).slice(0, 8);
  const narrationHash = (scene, language, s) => sha256([scene.narration, scene.narrationSpeed, language, s.provider, s.voice, s.speed, lexHash(language)].join('|')).slice(0, 16);

  /** Per-scene narration state used by the UI and the render preflight. */
  function status(project) {
    const lang = project.language; const s = settings();
    return project.package.scenes.map((sc) => {
      if (!sc.narration) return { sceneId: sc.id, state: 'not_needed' };
      const a = media.list({ projectId: project.id, sceneId: sc.id, kind: 'audio' }).find((x) => x.meta.key === 'narration');
      if (!a) return { sceneId: sc.id, state: 'missing' };
      if (a.meta.imported) return { sceneId: sc.id, state: 'fresh', assetId: a.id, imported: true, provider: 'imported' };
      return { sceneId: sc.id, state: a.meta.hash === narrationHash(sc, lang, s) ? 'fresh' : 'stale', assetId: a.id, provider: a.provider, durationMs: a.duration_ms };
    });
  }

  async function synthesizeScene(project, scene, { provider, voice, speed, force = false, signal }) {
    const lang = project.language; const eff = { provider, voice, speed };
    const hash = narrationHash(scene, lang, eff);
    const existing = media.list({ projectId: project.id, sceneId: scene.id, kind: 'audio' }).find((x) => x.meta.key === 'narration' && !x.meta.imported);
    if (existing && existing.meta.hash === hash && !force) return { asset: existing, reused: true };

    const tmp = media.projectDir(project.id, 'tmp');
    const cues = splitCues(scene.narration);
    if (!cues.length) throw new AppError(400, 'NO_NARRATION', `Scene "${scene.title}" has no narration text.`);
    const entries = lexicon(lang);
    const files = []; const durs = [];
    for (let i = 0; i < cues.length; i++) {
      const raw = path.join(tmp, `${scene.id}-${i}-${newId('c')}`);
      const text = applyPronunciations(cues[i], entries);
      const { file, ext } = await tts.synthesizeCue(provider, { text, language: lang, voice, speed: speed * (scene.narrationSpeed || 1), outFile: `${raw}.${provider === 'elevenlabs' ? 'mp3' : 'wav'}`, signal });
      // normalise every clip to 44.1 kHz mono PCM so they concatenate cleanly
      const norm = `${raw}-n.wav`;
      await ffmpeg(cfg, ['-i', file, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', norm], { signal });
      fs.rmSync(file, { force: true });
      const p = await probe(cfg, norm);
      if (!p.durationSec || p.durationSec < 0.15) throw new AppError(502, 'TTS_EMPTY', `The voice produced empty audio for: "${cues[i].slice(0, 40)}…"`, { hint: 'Check the provider, voice id and text.' });
      files.push(norm); durs.push(p.durationSec);
    }
    // assemble: lead silence + cue + gap …
    const inputs = files.flatMap((f) => ['-i', f]);
    const parts = files.map((_, i) => `[${i}:a]apad=pad_dur=${CUE_GAP_SEC}[a${i}]`).join(';');
    const concat = `${files.map((_, i) => `[a${i}]`).join('')}concat=n=${files.length}:v=0:a=1[cc];[cc]adelay=${Math.round(SCENE_LEAD_SEC * 1000)}:all=1[out]`;
    const outRel = `projects/${project.id}/audio/${scene.id}-${hash}.wav`;
    const outAbs = media.abs(outRel); fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    await ffmpeg(cfg, [...inputs, '-filter_complex', `${parts};${concat}`, '-map', '[out]', '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', outAbs], { signal });
    files.forEach((f) => fs.rmSync(f, { force: true }));

    let t = SCENE_LEAD_SEC;
    const timed = cues.map((text, i) => { const c = { text, start: +t.toFixed(3), end: +(t + durs[i]).toFixed(3) }; t += durs[i] + CUE_GAP_SEC; return c; });
    media.removeWhere(project.id, scene.id, 'audio', 'narration');
    const asset = await media.create({
      projectId: project.id, sceneId: scene.id, kind: 'audio', mediaType: 'tts_audio', relPath: outRel, mime: 'audio/wav', provider,
      license: TTS_INFO[provider].license, reviewStatus: 'pending',
      meta: { key: 'narration', hash, cues: timed, voice, speed, leadSec: SCENE_LEAD_SEC, gapSec: CUE_GAP_SEC, tailSec: SCENE_TAIL_SEC, chars: scene.narration.length, quality: TTS_INFO[provider].quality },
    });
    return { asset, reused: false };
  }

  /** Attach the owner's own recording as the narration for a scene (cue timing is proportional, flagged approximate). */
  async function importNarration(project, scene, { buffer, filename, license }) {
    const a = await media.importUpload({ projectId: project.id, sceneId: scene.id, buffer, filename, kindHint: 'audio', license });
    if (a.kind !== 'audio') { media.remove(a.id); throw new AppError(400, 'NOT_AUDIO', 'The file is not an audio recording.'); }
    media.removeWhere(project.id, scene.id, 'audio', 'narration');
    const cues = splitCues(scene.narration); const total = (a.duration_ms || 0) / 1000;
    const words = cues.map((c) => Math.max(1, c.split(/\s+/).length)); const sum = words.reduce((x, y) => x + y, 0);
    let t = 0.2; const usable = Math.max(0.5, total - 0.4);
    const timed = cues.map((text, i) => { const d = (words[i] / sum) * usable; const c = { text, start: +t.toFixed(3), end: +(t + d).toFixed(3) }; t += d; return c; });
    db.run('UPDATE assets SET meta = ?, media_type = ? WHERE id = ?', JSON.stringify({ key: 'narration', imported: true, cues: timed, approximateTiming: true, leadSec: 0, tailSec: SCENE_TAIL_SEC }), 'imported_audio', a.id);
    return media.get(a.id);
  }

  /** Cost estimate for synthesising a set of scenes with a provider. */
  function estimate(project, sceneIds, provider) {
    const scenes = project.package.scenes.filter((s) => !sceneIds || sceneIds.includes(s.id));
    const chars = scenes.reduce((a, s) => a + s.narration.length, 0);
    return costs.estimate({ kind: 'tts', provider, chars });
  }

  jobs.register('synthesize_narration', async ({ job, signal, log: jlog, progress }) => {
    const { projectId, sceneIds, provider, voice, speed, force, costEstimate } = job.payload;
    const project = projects.must(projectId);
    const scenes = project.package.scenes.filter((s) => s.narration && (!sceneIds || sceneIds.includes(s.id)));
    if (!scenes.length) throw new AppError(400, 'NO_SCENES', 'No scenes with narration to synthesise.');
    const costId = costEstimate?.estimateUsd > 0 ? costs.record({ projectId, jobId: job.id, provider, operation: 'tts.synthesize', est: costEstimate, units: costEstimate.breakdown?.chars, unit: 'chars' }) : null;
    let billedChars = 0; let done = 0;
    try {
      for (const sc of scenes) {
        jlog('info', `Narrating "${sc.title}" with ${provider}`);
        const r = await synthesizeScene(project, sc, { provider, voice, speed, force, signal });
        if (!r.reused) billedChars += sc.narration.length;
        jlog('info', r.reused ? `"${sc.title}": up to date (reused)` : `"${sc.title}": ${(r.asset.duration_ms / 1000).toFixed(1)}s`);
        progress(++done / scenes.length, `Narrated ${done}/${scenes.length}`);
      }
    } catch (e) {
      if (costId) costs.settle(costId, costs.estimate({ kind: 'tts', provider, chars: billedChars }).estimateUsd, billedChars ? 'actual' : 'estimate');
      throw e;
    }
    if (costId) costs.settle(costId, costs.estimate({ kind: 'tts', provider, chars: billedChars }).estimateUsd);
    return { scenes: scenes.length, chars: billedChars };
  }, { lane: 'media', maxAttempts: 3 });

  jobs.register('tts_preview', async ({ job, signal }) => {
    const { provider, voice, speed, text, language } = job.payload;
    const dir = path.join(cfg.mediaDir, 'library', 'previews'); fs.mkdirSync(dir, { recursive: true });
    const raw = path.join(dir, `prev-${newId('p')}`);
    const { file } = await tts.synthesizeCue(provider, { text: applyPronunciations(text, lexicon(language)), language, voice, speed, outFile: `${raw}.${provider === 'elevenlabs' ? 'mp3' : 'wav'}`, signal });
    const rel = path.relative(cfg.mediaDir, file);
    const a = await media.create({ kind: 'audio', mediaType: 'tts_audio', relPath: rel, mime: file.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav', provider, license: TTS_INFO[provider].license, meta: { key: 'preview', text } });
    return { assetId: a.id };
  }, { lane: 'media', maxAttempts: 2 });

  return { settings, saveSettings, status, synthesizeScene, importNarration, estimate, lexicon, tts };
}
