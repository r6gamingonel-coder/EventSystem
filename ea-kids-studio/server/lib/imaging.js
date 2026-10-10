// Single place that imports sharp (after the font environment is ready) plus text helpers.
import './fonts-env.js';
import sharp from 'sharp';

export { sharp };

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Rasterise an SVG string to PNG at an exact pixel size. */
export async function svgToPng(svg, width, height, { background } = {}) {
  let img = sharp(Buffer.from(svg), { density: 96 }).resize(width, height, { fit: 'fill' });
  if (background) img = img.flatten({ background });
  return img.png({ compressionLevel: 6 }).toBuffer();
}

/** Resize an SVG's declared canvas: caller supplies viewBox; we render at target pixels. */
export const wrapSvg = (w, h, inner, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}</defs>${inner}</svg>`;
