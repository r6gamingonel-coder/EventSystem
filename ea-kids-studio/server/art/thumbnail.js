// Thumbnail composer: 1280×720 (16:9) for videos, 1080×1920 cover for Shorts.
// Design rules baked in: one focal subject, ≤ 3 words of big outlined text, safe margins for the
// timestamp overlay (bottom-right), consistent EA KIDS badge, bright-but-balanced palette.
import { sharp, svgToPng, wrapSvg } from '../lib/imaging.js';
import { PALETTE as P, COLOR_WORDS } from './palette.js';
import { characterSvg } from './characters.js';
import { propSvg } from './props.js';
import { backgroundSvg } from './backgrounds.js';
import { renderText } from './text.js';
import { wordmark } from './brand.js';

export const THUMB_TEMPLATES = {
  colors:   { bg: 'tint',    props: ['apple', 'drop', 'sun', 'leaf', 'flower'], label: 'Colours' },
  numbers:  { bg: 'stage',   props: ['star', 'apple', 'balloon'], label: 'Numbers & counting' },
  alphabet: { bg: 'tint',    props: ['star', 'book', 'balloon'], label: 'Alphabet' },
  animals:  { bg: 'meadow',  props: ['tree', 'flower', 'cloud'], label: 'Animals & sounds' },
  nature:   { bg: 'forest',  props: ['leaf', 'drop', 'sun', 'flower'], label: 'Nature & science' },
  story:    { bg: 'night',   props: ['star', 'cloud', 'heart'], label: 'Stories' },
  habits:   { bg: 'classroom', props: ['soap', 'tooth', 'bubble', 'toothbrush'], label: 'Good habits' },
  shapes:   { bg: 'tint',    props: ['circle', 'square', 'triangle', 'star', 'diamond'], label: 'Shapes' },
  songs:    { bg: 'stage',   props: ['star', 'heart', 'balloon'], label: 'Songs' },
  general:  { bg: 'meadow',  props: ['star', 'cloud', 'sun'], label: 'General knowledge' },
};

const splitTitle = (t) => {
  const words = t.trim().split(/\s+/);
  if (words.length <= 2) return [t.trim()];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
};

/**
 * @param {object} o {template, title, accent (colour key or hex), characters:[{slug,emotion}], glyph, variant 'A'|'B'|'C', format}
 * @returns {Promise<Buffer>} PNG
 */
export async function composeThumbnail(o) {
  const tpl = THUMB_TEMPLATES[o.template] || THUMB_TEMPLATES.general;
  const shorts = o.format === 'shorts';
  const W = shorts ? 1080 : 1280; const H = shorts ? 1920 : 720;
  const variant = o.variant || 'A';
  const mirror = variant === 'C' && !shorts; // C: headline on the left, characters on the right
  const accent = COLOR_WORDS[o.accent] || (o.accent ? { hex: o.accent, light: o.accent } : null);
  const chars = (o.characters?.length ? o.characters : [{ slug: 'rayyan', emotion: 'happy' }]).slice(0, 3);
  const propKeys = (o.props?.length ? o.props : tpl.props).slice(0, 5);

  // ---- art layer (SVG) ----
  let art = backgroundSvg(tpl.bg, W, H, { uid: 'th', color: accent?.light, accent: '#fff' });
  const pSize = shorts ? 260 : 150;
  // Props live in slots that never overlap the title block (keeps text readable on phones).
  const slots = shorts
    ? [[60, 1450], [820, 1480], [430, 1680]]
    : o.glyph ? [[330, 120], [470, 40]]
    : variant === 'B' ? [[30, 250], [1100, 250], [1110, 470]]
    : [[640, 500], [800, 540], [960, 510], [1100, 470]];
  propKeys.slice(0, slots.length).forEach((k, i) => {
    const [px0, py] = slots[i]; const px = mirror ? W - px0 - pSize : px0;
    art += `<g transform="translate(${px} ${py}) scale(${pSize / 200}) rotate(${(i % 2 ? 1 : -1) * 8} 100 100)" opacity=".96">${propSvg(k)}</g>`;
  });
  const cSize = shorts ? 760 : (variant === 'B' ? 430 : 560);
  const cx0 = shorts ? 60 : (variant === 'B' ? 140 : 20);
  const cy0 = shorts ? H - cSize - 90 : H - cSize + 40;
  chars.forEach((c, i) => {
    const s = (cSize * (i === 0 ? 1 : 0.72)) / 400;
    const x = mirror ? W - cx0 - cSize - i * 260 : cx0 + i * (shorts ? 330 : (variant === 'B' ? 340 : 260));
    const y = cy0 + (i === 0 ? 0 : cSize * 0.28);
    art += `<g transform="translate(${x} ${y}) scale(${s})">${characterSvg(c.slug, c.emotion || (i === 0 ? 'happy' : 'wow'))}</g>`;
  });
  const base = await svgToPng(wrapSvg(W, H, art), W, H);

  // ---- text layers ----
  const layers = [];
  const lines = splitTitle(o.title || '');
  const maxW = shorts ? W - 140 : (variant === 'B' ? 1100 : 660);
  const lineH = shorts ? 300 : (variant === 'B' ? 170 : 200);
  let ty = shorts ? 120 : (variant === 'B' ? 36 : 120);
  const fills = [P.white, accent?.hex && o.template === 'colors' ? '#fff' : P.sun];
  for (let i = 0; i < lines.length; i++) {
    const t = await renderText(lines[i], { font: 'display', weight: 800, color: fills[i % 2], outline: 11, outlineColor: P.navy, shadow: 5, maxW, maxH: lineH });
    const lx = shorts || variant === 'B' ? (W - t.width) / 2 : mirror ? 50 : W - t.width - 50;
    layers.push({ input: t.buf, left: Math.round(lx), top: Math.round(ty) });
    ty += t.height + 24;
  }
  if (o.glyph) { // huge letter/number card
    const g = await renderText(String(o.glyph), { font: o.glyphFont || 'display', weight: 800, color: accent?.hex || P.coral, outline: 5, outlineColor: P.navy, shadow: 5, maxW: shorts ? 700 : 420, maxH: shorts ? 700 : 400 });
    layers.push({ input: g.buf, left: Math.round(shorts ? (W - g.width) / 2 : mirror ? 130 : W - g.width - 130), top: Math.round(ty + 10) });
  }
  const wm = await wordmark({ width: shorts ? 330 : 250 });
  layers.push({ input: wm.buf, left: shorts ? 40 : (mirror ? W - wm.width - 28 : 28), top: shorts ? 40 : 24 });
  return sharp(base).composite(layers).png({ compressionLevel: 8 }).toBuffer();
}

/** Three concept variants for the dashboard "pick one" flow. */
export const THUMB_VARIANTS = ['A', 'B', 'C'];
