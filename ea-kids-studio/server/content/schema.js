// The "project package": script + storyboard + metadata, stored as JSON on the project and in each version.
// normalizePackage() is the single gate for generated or hand-edited content.
import { newId } from '../lib/security.js';
import * as R from './registry.js';
import { estimateScene, splitCues } from './timing.js';

const clamp = (n, lo, hi, d) => (Number.isFinite(+n) ? Math.min(hi, Math.max(lo, +n)) : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

export function normalizeLayer(l) {
  const type = oneOf(l?.type, ['character', 'animal', 'prop', 'text', 'logo', 'shape'], 'prop');
  let ref = String(l?.ref ?? '');
  if (type === 'character' && !R.CHARACTER_SLUGS.includes(ref)) ref = 'rayyan';
  if (type === 'animal' && !R.ANIMALS.includes(ref)) ref = 'cat';
  if (type === 'prop' && !R.PROPS.includes(ref)) ref = 'star';
  if (type === 'logo') ref = oneOf(ref, ['wordmark', 'main', 'horizontal'], 'wordmark');
  const out = {
    type, ref,
    x: clamp(l?.x, -0.2, 1.2, 0.5), y: clamp(l?.y, -0.2, 1.2, 0.5), size: clamp(l?.size, 0.03, 1.2, 0.4),
    anim: oneOf(l?.anim, R.ANIMS, 'none'), delay: clamp(l?.delay, 0, 30, 0),
  };
  if (['character', 'animal'].includes(type)) out.emotion = oneOf(l?.emotion, R.EMOTION_KEYS, 'happy');
  if (type === 'text') { out.text = String(l?.text ?? '').slice(0, 80); out.color = /^#[0-9a-f]{6}$/i.test(l?.color || '') ? l.color : '#FFFFFF'; }
  if (type === 'shape') out.color = /^#[0-9a-f]{6}$/i.test(l?.color || '') ? l.color : '#FFC93C';
  if (l?.flip) out.flip = true;
  if (l?.copies) out.copies = clamp(l.copies, 1, 12, 1);
  return out;
}

export function normalizeScene(s, i, { keepId = true } = {}) {
  const narration = String(s?.narration ?? '').trim();
  const speed = clamp(s?.narrationSpeed, 0.6, 1.4, 1);
  const est = estimateScene(narration, speed);
  const v = s?.visual || {};
  const bg = v.background || {};
  const scene = {
    id: keepId && s?.id ? String(s.id) : newId('sc_'),
    index: i,
    title: String(s?.title || `Scene ${i + 1}`).slice(0, 120),
    kind: oneOf(s?.kind, R.SCENE_KINDS, 'lesson'),
    narration,
    narrationSpeed: speed,
    // 'auto': length follows the narration (measured audio once synthesised). 'manual': the owner's value is a minimum.
    durationMode: s?.durationMode === 'manual' && Number.isFinite(+s?.durationSec) ? 'manual' : 'auto',
    durationSec: s?.durationMode === 'manual' ? clamp(s?.durationSec, 1.5, 120, est.durationSec) : est.durationSec,
    subtitles: Array.isArray(s?.subtitles) && s.subtitles.length
      ? s.subtitles.map((c) => ({ start: +c.start || 0, end: +c.end || 0, text: String(c.text || '') }))
      : est.subtitles,
    visual: {
      mediaType: oneOf(v.mediaType, R.MEDIA_TYPES, 'motion_graphics'),
      background: { preset: oneOf(bg.preset, R.BACKGROUNDS, 'meadow'), ...(bg.color && /^#[0-9a-f]{6}$/i.test(bg.color) ? { color: bg.color } : {}) },
      layers: Array.isArray(v.layers) ? v.layers.map(normalizeLayer) : [],
      prompt: String(v.prompt || '').slice(0, 2000),         // text prompt for AI image/video tools (optional workflow)
      importedAssetId: v.importedAssetId || null,            // user-supplied image/video replaces local drawing
    },
    camera: { move: oneOf(s?.camera?.move, R.CAMERA_MOVES, 'zoom_in'), amount: clamp(s?.camera?.amount, 0, 0.3, 0.06) },
    animationNotes: String(s?.animationNotes || '').slice(0, 1000),
    characterNotes: String(s?.characterNotes || '').slice(0, 1000),
    audio: {
      music: oneOf(s?.audio?.music, ['main', 'soft', 'none'], 'main'),
      sfx: Array.isArray(s?.audio?.sfx) ? s.audio.sfx.map((x) => ({ at: clamp(x.at, 0, 120, 0), name: oneOf(x.name, R.SFX, 'pop') })).slice(0, 12) : [],
    },
    transition: oneOf(s?.transition, R.TRANSITIONS, 'fade'),
    review: { status: oneOf(s?.review?.status, ['pending', 'approved', 'rejected'], 'pending'), note: String(s?.review?.note || '').slice(0, 500) },
    locked: !!s?.locked,
  };
  // Keep subtitle text in sync with narration when subtitles were not hand-edited.
  if (!s?.subtitles?.length) scene.subtitles = est.subtitles;
  return scene;
}

export function normalizePackage(pkg, defaults = {}) {
  const p = pkg || {};
  const meta = { ...defaults, ...(p.meta || {}) };
  const scenes = (Array.isArray(p.scenes) ? p.scenes : []).map((s, i) => normalizeScene(s, i));
  return {
    schemaVersion: 1,
    meta,
    objective: String(p.objective || ''),
    outcomes: Array.isArray(p.outcomes) ? p.outcomes.map(String) : [],
    factCheck: Array.isArray(p.factCheck) ? p.factCheck.map((f) => ({ claim: String(f.claim || ''), status: oneOf(f.status, ['unverified', 'verified', 'disputed'], 'unverified'), source: String(f.source || '') })) : [],
    characters: Array.isArray(p.characters) ? p.characters.filter((c) => typeof c === 'string') : ['rayyan'],
    scenes,
    music: { style: String(p.music?.style || 'gentle pentatonic, 90–100 BPM, soft marimba/bell timbre'), notes: String(p.music?.notes || ''), assetId: p.music?.assetId || null, volume: clamp(p.music?.volume, 0, 0.5, 0.16) },
    metadata: {
      title: String(p.metadata?.title || meta.title || ''),
      description: String(p.metadata?.description || ''),
      tags: Array.isArray(p.metadata?.tags) ? p.metadata.tags.map(String) : [],
      chapters: Array.isArray(p.metadata?.chapters) ? p.metadata.chapters : [],
      language: p.metadata?.language || meta.language || 'ar',
      playlist: String(p.metadata?.playlist || ''),
      thumbnailFilename: String(p.metadata?.thumbnailFilename || ''),
    },
    thumbnail: {
      concept: String(p.thumbnail?.concept || ''), template: p.thumbnail?.template || 'general', variant: p.thumbnail?.variant || 'A',
      title: String(p.thumbnail?.title || ''), glyph: p.thumbnail?.glyph || '', accent: p.thumbnail?.accent || '',
      characters: Array.isArray(p.thumbnail?.characters) ? p.thumbnail.characters : [{ slug: 'rayyan', emotion: 'happy' }],
      selectedAssetId: p.thumbnail?.selectedAssetId || null,
    },
    reviewChecklist: Array.isArray(p.reviewChecklist) ? p.reviewChecklist.map((c) => ({ id: c.id || newId('rc_'), text: String(c.text), done: !!c.done })) : [],
  };
}

export const totalDuration = (pkg) => (pkg.scenes || []).reduce((a, s) => a + s.durationSec, 0);
export const scriptText = (pkg) => (pkg.scenes || []).map((s) => s.narration).filter(Boolean).join('\n');
export { splitCues };

/** Structural validation used before rendering; returns a list of blocking problems. */
export function validateForRender(pkg) {
  const problems = [];
  if (!pkg.scenes?.length) problems.push('The project has no scenes.');
  pkg.scenes?.forEach((s, i) => {
    if (!s.narration && s.kind !== 'intro' && s.kind !== 'outro') problems.push(`Scene ${i + 1} ("${s.title}") has no narration.`);
    if (s.review.status === 'rejected') problems.push(`Scene ${i + 1} ("${s.title}") is rejected — revise or approve it first.`);
    if (s.visual.mediaType === 'ai_video_clip' && !s.visual.importedAssetId) problems.push(`Scene ${i + 1} is marked "ai_video_clip" but no clip is attached. Generate/import one, or switch the media type.`);
    if (s.visual.mediaType === 'imported_video' && !s.visual.importedAssetId) problems.push(`Scene ${i + 1} is marked "imported_video" but no clip is attached.`);
  });
  return problems;
}
