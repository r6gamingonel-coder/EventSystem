// EA KIDS brand asset composers: logos, profile image, YouTube banner. All output is original.
import { sharp, svgToPng, wrapSvg } from '../lib/imaging.js';
import { PALETTE as P } from './palette.js';
import { characterSvg } from './characters.js';
import { renderText } from './text.js';
import { backgroundSvg } from './backgrounds.js';

const WORD = [
  { text: 'E', color: P.coral }, { text: 'A', color: P.sky }, { text: ' ', color: P.navy },
  { text: 'K', color: P.leaf }, { text: 'I', color: P.berry }, { text: 'D', color: P.grape }, { text: 'S', color: P.sun },
];

/** "EA KIDS" wordmark as a transparent PNG with outline + drop shadow. */
export async function wordmark({ width = 1100, mono = null } = {}) {
  const spans = mono ? [{ text: 'EA KIDS', color: mono }] : WORD;
  return renderText('EA KIDS', { font: 'latin', weight: 700, outline: 7, outlineColor: P.navy, shadow: 5, shadowColor: P.navy, maxW: width, maxH: width, spans, color: P.navy });
}
export const tagline = (text = 'تعلّم وامرح مع أصدقائك', { width = 700, color = P.navy, weight = 700 } = {}) =>
  renderText(text, { font: 'body', weight, color, maxW: width, maxH: 140 });

const place = (buf, left, top) => ({ input: buf, left: Math.round(left), top: Math.round(top) });

/** Main logo: Rayyan above the wordmark, tagline in a pill. 1600×1100 transparent PNG. */
export async function logoMain() {
  const W = 1600; const H = 1320;
  const mascot = await svgToPng(wrapSvg(400, 400, characterSvg('rayyan', 'happy')), 560, 560);
  const wm = await wordmark({ width: 1300 });
  const tg = await tagline('تعلّم وامرح مع أصدقائك', { width: 760 });
  const pillW = tg.width + 110; const pillH = tg.height + 56;
  const pill = await svgToPng(wrapSvg(pillW, pillH, `<rect x="4" y="4" width="${pillW - 8}" height="${pillH - 8}" rx="${pillH / 2}" fill="#fff" stroke="${P.navy}" stroke-width="7"/>`), pillW, pillH);
  const halo = await svgToPng(wrapSvg(700, 700, `<circle cx="350" cy="350" r="330" fill="${P.sun}" stroke="${P.navy}" stroke-width="8"/><circle cx="350" cy="350" r="330" fill="none" stroke="#fff" stroke-width="14" stroke-dasharray="2 34" stroke-linecap="round" opacity=".7"/>`), 700, 700);
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      place(halo, (W - 700) / 2, 0), place(mascot, (W - 560) / 2, 70),
      place(wm.buf, (W - wm.width) / 2, 640),
      place(pill, (W - pillW) / 2, 640 + wm.height + 40), place(tg.buf, (W - tg.width) / 2, 640 + wm.height + 40 + 28),
    ]).png().toBuffer();
}

/** Alternate (horizontal) logo for watermarks and dark/light overlays. 1800×600. */
export async function logoHorizontal() {
  const W = 1800; const H = 600;
  const badge = await svgToPng(wrapSvg(560, 560, `<circle cx="280" cy="280" r="262" fill="${P.sun}" stroke="${P.navy}" stroke-width="9"/><g transform="translate(40 50) scale(1.2)">${characterSvg('rayyan', 'wink')}</g>`), 560, 560);
  const wm = await wordmark({ width: 1100 });
  const tg = await tagline('تعلّم وامرح', { width: 520 });
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([place(badge, 20, 20), place(wm.buf, 640, 130), place(tg.buf, 640 + (wm.width - tg.width) / 2, 130 + wm.height + 50)]).png().toBuffer();
}

/** Single-colour wordmark for watermarks / one-colour print. */
export async function logoMono(color = P.navy) {
  const wm = await wordmark({ width: 1200, mono: color });
  return sharp(wm.buf).extend({ top: 40, bottom: 40, left: 40, right: 40, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

/** 800×800 avatar. Subject kept inside the central circle so YouTube's circular crop never clips it. */
export async function profileImage() {
  const S = 800;
  const rays = Array.from({ length: 20 }, (_, i) => { const a0 = (i / 20) * Math.PI * 2; const a1 = a0 + Math.PI / 20; return `<path d="M400 400 L${400 + Math.cos(a0) * 700} ${400 + Math.sin(a0) * 700} L${400 + Math.cos(a1) * 700} ${400 + Math.sin(a1) * 700} Z" fill="#fff" opacity=".18"/>`; }).join('');
  const bg = await svgToPng(wrapSvg(S, S, `<rect width="${S}" height="${S}" fill="${P.sun}"/>${rays}<circle cx="400" cy="400" r="380" fill="none" stroke="${P.coral}" stroke-width="16"/>`), S, S);
  const head = await svgToPng(wrapSvg(400, 400, characterSvg('rayyan', 'happy')), 640, 640);
  const ea = await renderText('EA', { font: 'latin', weight: 700, outline: 8, outlineColor: P.navy, color: '#fff', shadow: 4, maxW: 250, maxH: 160 });
  return sharp(bg).composite([place(head, 80, 40), place(ea.buf, (S - ea.width) / 2, 620)]).png().toBuffer();
}

/** 2560×1440 channel banner. Text/primary art stays inside the 1546×423 "all devices" safe area. */
export async function banner() {
  const W = 2560; const H = 1440;
  const bg = await svgToPng(wrapSvg(W, H, backgroundSvg('meadow', W, H, { uid: 'bn' })), W, H);
  const wm = await wordmark({ width: 760 });
  const tg = await tagline('قصص • ألوان • أرقام • أغانٍ', { width: 700 });
  const draw = async (slug, emo, size) => svgToPng(wrapSvg(400, 400, characterSvg(slug, emo)), size, size);
  const rayyan = await draw('rayyan', 'happy', 430); const nunu = await draw('nunu', 'wink', 430);
  const zaq = await draw('zaqzaq', 'wow', 380); const sal = await draw('sallouma', 'happy', 380);
  const cx = W / 2; const sy = 508; // safe-area top
  return sharp(bg).composite([
    place(zaq, 90, 880), place(sal, 2090, 900),                       // outer, may be cropped on small screens
    place(rayyan, 530, sy - 20), place(nunu, 2040 - 430 + 0, sy - 20),  // inside safe area (x 507–2053)
    place(wm.buf, cx - wm.width / 2, sy + 40), place(tg.buf, cx - tg.width / 2, sy + 40 + wm.height + 36),
  ]).png().toBuffer();
}
