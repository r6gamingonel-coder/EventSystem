// Rasterises a scene's drawn layers to transparent PNGs at the exact output resolution.
// Results are cached by content hash, so re-renders and retries only redo what changed.
import fs from 'node:fs';
import path from 'node:path';
import { sharp, svgToPng, wrapSvg } from '../lib/imaging.js';
import { sha256 } from '../lib/security.js';
import { characterSvg } from '../art/characters.js';
import { animalSvg } from '../art/animals.js';
import { propSvg } from '../art/props.js';
import { backgroundSvg } from '../art/backgrounds.js';
import { renderText } from '../art/text.js';
import { wordmark } from '../art/brand.js';
import { COLOR_WORDS } from '../art/palette.js';

const ART_VERSION = 'v1'; // bump to invalidate every cached layer when the art code changes

async function cached(dir, key, make) {
  const file = path.join(dir, `${sha256(`${ART_VERSION}|${key}`).slice(0, 24)}.png`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, await make());
  const m = await sharp(file).metadata();
  return { file, width: m.width, height: m.height };
}

export async function renderBackground(scene, W, H, dir) {
  const bg = scene.visual.background;
  return cached(dir, `bg|${bg.preset}|${bg.color || ''}|${W}x${H}`, async () => {
    const svg = wrapSvg(W, H, backgroundSvg(bg.preset, W, H, { uid: 'bg', color: bg.color, accent: '#ffffff' }));
    return svgToPng(svg, W, H);
  });
}

/** @returns {{file,width,height}} PNG for a layer. Sizes follow the "shorter side" convention. */
export async function renderLayer(layer, W, H, dir) {
  const short = Math.min(W, H);
  const px = Math.max(8, Math.round(layer.size * short));
  const key = JSON.stringify([layer.type, layer.ref, layer.emotion, layer.text, layer.color, layer.copies, layer.flip, px, W]);
  return cached(dir, `layer|${key}`, async () => {
    if (layer.type === 'text') {
      const t = await renderText(layer.text || '', { font: 'display', weight: 800, color: layer.color || '#FFFFFF', outline: 11, outlineColor: '#23285B', shadow: 4, maxW: Math.round(W * 0.9), maxH: px });
      return t.buf;
    }
    if (layer.type === 'logo') {
      const t = await wordmark({ width: Math.round(Math.min(W * 0.9, px * 4.6)) });
      return sharp(t.buf).resize({ height: px, fit: 'inside' }).png().toBuffer();
    }
    if (layer.type === 'shape') {
      return svgToPng(wrapSvg(200, 200, `<circle cx="100" cy="100" r="90" fill="${layer.color || '#FFC93C'}" stroke="#23285B" stroke-width="5"/>`), px, px);
    }
    const draw = () => (layer.type === 'character' ? wrapSvg(400, 400, characterSvg(layer.ref, layer.emotion || 'happy'))
      : layer.type === 'animal' ? wrapSvg(400, 400, animalSvg(layer.ref, layer.emotion || 'happy'))
      : wrapSvg(200, 200, propSvg(layer.ref)));
    let one = await svgToPng(draw(), px, px);
    if (layer.flip) one = await sharp(one).flop().png().toBuffer();
    const n = layer.copies || 1;
    if (n === 1) return one;
    // grid of copies centred as one image
    const cols = Math.ceil(Math.sqrt(n * 1.6)); const rows = Math.ceil(n / cols);
    const gap = Math.round(px * 0.08);
    const comp = Array.from({ length: n }, (_, i) => {
      const r = Math.floor(i / cols); const inRow = r === rows - 1 ? n - r * cols : cols;
      const offset = Math.round(((cols - inRow) * (px + gap)) / 2);
      return { input: one, left: offset + (i % cols) * (px + gap), top: r * (px + gap) };
    });
    return sharp({ create: { width: cols * px + (cols - 1) * gap, height: rows * px + (rows - 1) * gap, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(comp).png().toBuffer();
  });
}

/** Fit an imported still to the canvas (cover) → PNG used as the background of an "animated_still" scene. */
export async function renderImportedStill(srcFile, W, H, dir, sha) {
  return cached(dir, `still|${sha}|${W}x${H}`, () => sharp(srcFile).resize(W, H, { fit: 'cover', position: 'centre' }).png().toBuffer());
}
export { COLOR_WORDS };
