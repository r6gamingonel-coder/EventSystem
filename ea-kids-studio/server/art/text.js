// Text-to-PNG with correct Arabic shaping (HarfBuzz via librsvg/Pango) and bundled fonts.
// Renders large, trims to the ink bounds, then scales to fit a box so layouts never overflow.
import { sharp, esc } from '../lib/imaging.js';
import { PALETTE as P, FONT } from './palette.js';

const FONT_FOR = { latin: FONT.latin, display: FONT.arabicDisplay, body: FONT.arabicBody };
export const hasArabic = (s) => /[؀-ۿ]/.test(s);

/**
 * @returns {{buf: Buffer, width: number, height: number}} transparent PNG of the text.
 * opts: font ('latin'|'display'|'body'), weight, color, outline (percent of font size, drawn outside the glyphs), outlineColor, maxW, maxH, size (if no maxW)
 */
export async function renderText(text, opts = {}) {
  const { font = hasArabic(text) ? 'display' : 'latin', weight = 700, color = P.navy, outline = 0, outlineColor = P.navy, maxW = 1200, maxH = 400, shadow = 0, shadowColor = P.navy, spans } = opts;
  const family = FONT_FOR[font] || font;
  const base = 240;                      // render size; scaled down afterwards for crispness
  const pad = Math.ceil(base * 0.35);
  const W = 4200; const H = base * 2 + pad * 2;
  const rtl = hasArabic(text);
  const body = spans
    ? spans.map((s) => `<tspan fill="${s.color}">${esc(s.text)}</tspan>`).join('')
    : esc(text);
  const t = (extra) => `<text x="${W / 2}" y="${H / 2 + base * 0.32}" xml:space="preserve" text-anchor="middle" direction="${rtl ? 'rtl' : 'ltr'}" font-family="${family}" font-weight="${weight}" font-size="${base}" ${extra}>${body}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${
    shadow ? `<g transform="translate(0 ${shadow * (base / 100)})">${t(`fill="${shadowColor}" stroke="${shadowColor}" stroke-width="${outline * (base / 100) * 2}" stroke-linejoin="round"`)}</g>` : ''}${
    outline ? t(`fill="${outlineColor}" stroke="${outlineColor}" stroke-width="${outline * (base / 100) * 2}" stroke-linejoin="round"`) : ''}${
    t(`fill="${color}"`)}</svg>`;
  const raw = await sharp(Buffer.from(svg)).png().toBuffer();
  const trimmed = await sharp(raw).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
  const { width: tw, height: th } = trimmed.info;
  const scale = Math.min(maxW / tw, maxH / th, opts.size ? opts.size / base : Infinity);
  const w = Math.max(1, Math.round(tw * scale)); const h = Math.max(1, Math.round(th * scale));
  const buf = await sharp(trimmed.data).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  return { buf, width: w, height: h };
}
