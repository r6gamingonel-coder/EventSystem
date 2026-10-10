// Offline package generator: kit + brief → complete production package (no API cost, deterministic).
import { KITS } from './kits.js';
import { CHARACTERS } from '../art/characters.js';
import { normalizePackage } from './schema.js';
import { estimateScene } from './timing.js';
import { newId } from '../lib/security.js';

export const REVIEW_CHECKLIST = [
  'Every educational claim is correct and appropriate for the age group (see "Facts to verify").',
  'Arabic text is simple, grammatically correct and uses consistent diacritics where needed.',
  'I listened to the full narration: pronunciation is clear and pacing is calm.',
  'Characters look the same in every scene (no distorted or off-model frames).',
  'Nothing scary, violent, unsafe to imitate, or inappropriate for young children.',
  'Captions are readable on a phone and match what is said.',
  'Audio is balanced: voice is clear over music, no clipping or sudden loud sounds.',
  'All music, sound effects, voices and images are original or licensed for commercial use (licence recorded).',
  'No personal information is requested from children; no manipulative calls to action.',
  'The thumbnail honestly represents the video (no misleading imagery).',
  'Title, description and tags are truthful and not keyword-stuffed.',
  'Audience setting (made for kids) was reviewed by the owner.',
];

// Layout leaves a caption zone: landscape ≈ bottom 14 %, Shorts ≈ a band at 57–64 % height (above the host, clear of Shorts UI).
const posLandscape = { host: [0.24, 0.54, 0.58], prop: [0.73, 0.5, 0.48], title: [0.5, 0.13, 0.17] };
const posPortrait = { host: [0.5, 0.8, 0.6], prop: [0.5, 0.36, 0.5], title: [0.5, 0.12, 0.12] };
const P = (format) => (format === 'shorts' ? posPortrait : posLandscape);

/** Convert a landscape-composed layer list to a sensible portrait arrangement. */
function toPortrait(layers) {
  const chars = layers.filter((l) => l.type === 'character' || l.type === 'animal').sort((a, b) => a.x - b.x);
  const props = layers.filter((l) => l.type === 'prop');
  const texts = layers.filter((l) => l.type === 'text' || l.type === 'logo');
  chars.forEach((c, i) => { c.x = chars.length === 1 ? 0.5 : 0.3 + (0.4 * i) / (chars.length - 1); c.y = chars.length === 1 ? 0.8 : 0.82; c.size = chars.length === 1 ? Math.min(c.size, 0.6) : 0.44; });
  props.forEach((p, i) => { p.x = props.length === 1 ? 0.5 : 0.25 + (0.5 * i) / (props.length - 1); p.y = 0.36; p.size = Math.min(p.size, props.length > 1 ? 0.26 : 0.5); });
  texts.forEach((t) => { t.x = 0.5; t.y = t.type === 'logo' ? 0.3 : 0.13; t.size = Math.min(t.size, 0.14); });
  return layers;
}

const L = (type, ref, [x, y, size], anim = 'none', extra = {}) => ({ type, ref, x, y, size, anim, ...extra });

function sceneFrom({ title, kind = 'lesson', narration, bg, tint, layers, sfx = [], transition = 'fade', camera, format, notes }) {
  const est = estimateScene(narration);
  return {
    id: newId('sc_'), title, kind, narration, durationSec: est.durationSec,
    visual: {
      mediaType: 'motion_graphics',
      background: { preset: bg, ...(tint ? { color: tint } : {}) },
      layers: format === 'shorts' ? toPortrait(layers) : layers,
      prompt: notes?.prompt || `Flat, friendly children's illustration in the EA KIDS style (thick navy outlines, soft pastel background): ${title}.`,
    },
    camera: camera || { move: kind === 'intro' ? 'zoom_in' : ['zoom_in', 'pan_left', 'zoom_out'][(title.length) % 3], amount: 0.05 },
    animationNotes: notes?.animation || 'Characters bob gently; props float; the key word pops in. Keep motion slow and calm.',
    characterNotes: notes?.characters || 'Use the locked EA KIDS character designs. Do not change colours or proportions.',
    audio: { music: 'main', sfx },
    transition,
  };
}

function itemScene(item, format, idx) {
  const pos = P(format);
  const layers = [];
  if (item.animal) layers.push(L('animal', item.animal, pos.prop, 'bob', { emotion: 'happy' }));
  if (item.prop) {
    if (item.copies && item.copies > 1) layers.push(L('prop', item.prop, [format === 'shorts' ? 0.5 : 0.7, format === 'shorts' ? 0.42 : 0.58, Math.max(0.16, 0.5 / Math.sqrt(item.copies))], 'float', { copies: item.copies }));
    else layers.push(L('prop', item.prop, pos.prop, 'float', { delay: 0.3 }));
  }
  if (item.prop2) layers.push(L('prop', item.prop2, [pos.prop[0] + (format === 'shorts' ? 0.22 : 0.17), pos.prop[1] - 0.12, 0.2], 'pulse', { delay: 0.8 }));
  if (item.host) layers.push(L('character', item.host, pos.host, 'bob', { emotion: item.emotion || 'happy' }));
  if (item.char2) layers.push(L('character', item.char2, [pos.host[0] + 0.2, pos.host[1] + 0.06, 0.4], 'wiggle', { emotion: 'wow', delay: 0.5 }));
  layers.push(L('text', '', pos.title, 'pop', { text: item.word, color: item.wordColor || '#FFFFFF', delay: 0.5 }));
  return sceneFrom({
    title: item.title, narration: item.narration, bg: item.bg || 'meadow', tint: item.tint, layers, format,
    sfx: [{ at: 0.4, name: item.sfx || 'pop' }], transition: idx % 3 === 2 ? 'circleopen' : 'slideright',
    notes: { prompt: `Flat children's illustration, EA KIDS style: ${item.host ? CHARACTERS[item.host].nameEn + ' (' + CHARACTERS[item.host].species + ')' : 'friendly animal'} with ${item.prop || item.animal || 'the lesson object'}, bright ${item.bg || 'meadow'} backdrop, big readable word "${item.word}".` },
  });
}

function bookends(kit, lang, format, items) {
  const host = kit.items ? (items[0]?.host || 'rayyan') : 'rayyan';
  const introText = format === 'shorts' ? (kit.intro[lang] || kit.intro.ar).split(/(?<=[.!؟])\s/)[0] : (kit.intro[lang] || kit.intro.ar);
  const intro = sceneFrom({
    title: 'Intro', kind: 'intro', narration: introText, bg: 'stage', format, sfx: [{ at: 0.3, name: 'tada' }],
    layers: [L('logo', 'wordmark', [0.5, format === 'shorts' ? 0.3 : 0.26, format === 'shorts' ? 0.12 : 0.2], 'pop', { delay: 0.2 }), L('character', host, [0.5, format === 'shorts' ? 0.8 : 0.56, format === 'shorts' ? 0.6 : 0.48], 'bob', { emotion: 'wink' })],
    notes: { prompt: 'Stage with warm spotlight; the EA KIDS wordmark pops in above the host character who waves hello.' },
  });
  const recapProps = items.filter((i) => i.prop).slice(0, 6);
  const recapLayers = recapProps.map((it, i) => L('prop', it.prop, [format === 'shorts' ? 0.25 + (i % 2) * 0.5 : 0.16 + (i * 0.68) / Math.max(1, recapProps.length - 1), format === 'shorts' ? 0.22 + Math.floor(i / 2) * 0.13 : 0.3, format === 'shorts' ? 0.22 : 0.2], 'pulse', { delay: 0.2 + i * 0.25 }));
  recapLayers.push(L('character', host, [0.5, format === 'shorts' ? 0.82 : 0.63, format === 'shorts' ? 0.5 : 0.46], 'bob', { emotion: 'proud' }));
  const recap = sceneFrom({ title: 'Recap', kind: 'recap', narration: kit.recap(items, lang), bg: 'meadow', layers: recapLayers, format, sfx: [{ at: 0.3, name: 'sparkle' }], notes: { prompt: 'All lesson objects in a row; the host looks proud and celebrates.' } });
  const outro = sceneFrom({
    title: 'Outro', kind: 'outro', narration: kit.outro[lang] || kit.outro.ar, bg: 'sunrise', format, sfx: [{ at: 0.4, name: 'chime' }], transition: 'fade',
    layers: ['rayyan', 'nunu', 'zaqzaq', 'sallouma'].map((c, i) => L('character', c, format === 'shorts' ? [0.3 + (i % 2) * 0.4, 0.6 + Math.floor(i / 2) * 0.2, 0.4] : [0.16 + i * 0.226, 0.58, 0.38], 'wiggle', { emotion: 'happy', delay: i * 0.2 })),
    notes: { prompt: 'All four friends wave goodbye in front of a sunrise meadow. Leave empty space at the bottom for end-screen elements.' },
  });
  return { intro, recap, outro };
}

const textLayer = (t) => L('text', '', [t[2], t[3], t[4]], t[5] || 'pop', { text: t[7], color: /^#[0-9a-f]{6}$/i.test(t[6]) ? t[6] : '#FFFFFF', delay: 0.4 });

function scriptedScenes(kit, format) {
  return kit.scenes.map((s, i) => {
    const layers = s.layers.map((t) => {
      if (t[0] === 'text') return textLayer(t);
      const isChar = ['character', 'animal'].includes(t[0]);
      return L(t[0], t[1], isChar ? [t[2], t[3] - 0.07, t[4] * 0.9] : [t[2], t[3] - 0.05, t[4]], t[5] || 'none', isChar ? { emotion: t[6] || 'happy' } : {});
    });
    return sceneFrom({ title: s.title, kind: s.kind || 'story', narration: s.text, bg: s.bg, tint: s.tint, layers, format, sfx: [{ at: 0.4, name: kit.song ? 'chime' : 'pop' }], transition: i % 2 ? 'fade' : 'slideright',
      notes: { prompt: `Flat children's story illustration in the EA KIDS style: ${s.title}.` } });
  });
}

// ≤ 3 words for thumbnails, never ending on a dangling particle ("مع", "في", "with"…)
const DANGLING = new Set(['مع', 'في', 'من', 'على', 'إلى', 'و', 'عن', 'with', 'and', 'of', 'the', 'to']);
const shortTitle = (t) => { const w = t.split(/\s+/).slice(0, 3); while (w.length > 1 && DANGLING.has(w.at(-1))) w.pop(); return w.join(' '); };

/**
 * @param {object} brief {kit, language, ageMin, ageMax, targetDurationSec, format, title?, characters?, itemCount?, syntheticVoice?}
 */
export function generateOffline(brief) {
  const kit = KITS[brief.kit];
  if (!kit) throw Object.assign(new Error(`Unknown lesson kit: ${brief.kit}`), { status: 400, code: 'BAD_KIT' });
  const format = brief.format || 'landscape';
  const lang = kit.languages.includes(brief.language) ? brief.language : 'ar';
  const target = brief.targetDurationSec || (format === 'shorts' ? 45 : 90);

  let scenes; let items = [];
  if (kit.scenes) {
    scenes = scriptedScenes(kit, format);
    if (format === 'shorts' && scenes.length > 3) scenes = scenes.slice(0, 3);
    items = scenes.map((s) => ({ word: s.title, prop: s.visual.layers.find((l) => l.type === 'prop')?.ref, host: s.visual.layers.find((l) => l.type === 'character')?.ref }));
  } else {
    const max = kit.items(lang, 99).length;
    let n = brief.itemCount || 0;
    if (!n) { // smallest count whose total reaches ~the target duration
      for (n = 2; n < max; n++) {
        const probe = kit.items(lang, n);
        const total = probe.reduce((a, i) => a + estimateScene(i.narration).durationSec, 0) + 14;
        if (total >= target * 0.92) break;
      }
    }
    items = kit.items(lang, Math.max(1, Math.min(n, max)));
    if (brief.characters?.length) items = items.map((it, i) => (it.host && !it.animal ? { ...it, host: brief.characters[i % brief.characters.length] } : it));
    const { intro, recap, outro } = bookends(kit, lang, format, items);
    scenes = format === 'shorts' ? [intro, ...items.map((it, i) => itemScene(it, format, i)), outro] : [intro, ...items.map((it, i) => itemScene(it, format, i)), recap, outro];
  }
  if (kit.scenes) { // story/song: add bookends too
    const { intro, outro } = bookends({ ...kit, intro: kit.intro || { ar: 'أهلًا يا أصدقائي! أنا ريّان.' }, outro: kit.outro || { ar: 'إلى اللقاء يا أصدقائي!' }, recap: () => '' }, lang, format, items);
    const introKit = kit.song ? 'أهلًا يا أصدقائي! هيا نغنّي معًا أغنية الألوان.' : 'أهلًا يا أصدقائي! أنا ريّان. هل تحبون سماع قصة جميلة؟ هيا نبدأ.';
    intro.narration = introKit; intro.durationSec = estimateScene(introKit).durationSec;
    const outroText = kit.song ? 'ما أجمل أن نغنّي معًا! إلى اللقاء يا أصدقائي!' : 'وهكذا انتهت قصتنا. إلى اللقاء يا أصدقائي!';
    outro.narration = outroText; outro.durationSec = estimateScene(outroText).durationSec;
    scenes = format === 'shorts' ? [...scenes, outro] : [intro, ...scenes, outro];
  }
  if (brief.noBookends) scenes = scenes.filter((s) => s.kind !== 'intro' && s.kind !== 'outro');

  // ---- metadata, chapters, thumbnail ----
  const title = brief.title || `${kit.title[lang] || kit.title.ar}${lang === 'ar' ? '' : ''} | EA KIDS`;
  const ageMin = brief.ageMin ?? 3; const ageMax = brief.ageMax ?? 6;
  let t = 0;
  const chapters = scenes.map((s) => { const c = { time: t, title: s.title }; t += s.durationSec; return c; });
  const total = Math.round(t);
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const chapterLines = format === 'landscape' && total >= 60 ? chapters.filter((c, i) => i === 0 || c.time - chapters[i - 1].time >= 10).map((c) => `${fmt(c.time)} ${c.title === 'Intro' ? 'المقدمة' : c.title === 'Recap' ? 'مراجعة' : c.title === 'Outro' ? 'الخاتمة' : c.title}`) : [];
  const synthetic = brief.syntheticVoice !== false;
  const description = [
    kit.objective[lang] || kit.objective.ar, '',
    `العمر المناسب: ${ageMin}–${ageMax} سنوات.`,
    ...(chapterLines.length >= 3 ? ['', 'محتوى الفيديو:', ...chapterLines] : []), '',
    'فيديو تعليمي أصلي من إنتاج EA KIDS: الرسوم والشخصيات من تصميمنا.',
    synthetic ? 'الصوت في هذا الفيديو مُولَّد بالحاسوب.' : '',
    'يُنصح بمشاهدة الأطفال برفقة أحد الوالدين أو المربّين.',
  ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');

  const host = items.find((i) => i.host)?.host || 'rayyan';
  const pkg = normalizePackage({
    meta: { title, language: lang, ageMin, ageMax, format, category: kit.category, kit: kit.id, targetDurationSec: target, visualStyle: brief.visualStyle || 'flat-friendly', narrationStyle: brief.narrationStyle || 'warm-teacher', difficulty: brief.difficulty || 'easy', generator: { provider: 'offline_templates', model: kit.id, at: new Date().toISOString() } },
    objective: kit.objective[lang] || kit.objective.ar,
    outcomes: kit.outcomes[lang] || kit.outcomes.ar,
    factCheck: kit.facts.map((claim) => ({ claim, status: 'unverified', source: '' })),
    characters: [...new Set(scenes.flatMap((s) => s.visual.layers.filter((l) => l.type === 'character').map((l) => l.ref)))],
    scenes,
    music: { style: kit.song ? 'cheerful pentatonic tune, 110 BPM, bell + marimba timbre' : 'gentle pentatonic loop, 92 BPM, soft bell/marimba', notes: 'Original in-house synth music (no licensing obligations). Replace with a licensed track if desired and record its licence.' },
    metadata: { title, description, tags: kit.tags.slice(0, 12), chapters: chapterLines.length >= 3 ? chapters : [], language: lang, playlist: kit.playlist, thumbnailFilename: `${kit.id}-thumbnail.png` },
    thumbnail: { concept: `${CHARACTERS[host].nameAr} (${CHARACTERS[host].species}) next to the lesson objects with the big headline "${shortTitle(kit.title[lang] || kit.title.ar)}". One focal subject, ≤3 words, no misleading imagery.`, template: kit.thumbnail, variant: 'A', title: shortTitle(kit.title.ar), glyph: kit.id === 'alphabet_ar' ? 'أ' : kit.id === 'numbers' ? '٣' : '', accent: kit.id === 'colors' ? 'red' : '', characters: [{ slug: host, emotion: 'happy' }] },
    reviewChecklist: REVIEW_CHECKLIST.map((text) => ({ text, done: false })),
  });
  return pkg;
}
