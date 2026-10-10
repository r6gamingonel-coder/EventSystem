// Scene backgrounds. Each returns SVG inner markup for a W×H canvas; `uid` keeps gradient ids unique.
import { PALETTE as P } from './palette.js';

const cloudAt = (x, y, s = 1, o = 0.95) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${o}"><ellipse cx="0" cy="0" rx="70" ry="28" fill="#fff"/><ellipse cx="-38" cy="-12" rx="34" ry="26" fill="#fff"/><ellipse cx="22" cy="-22" rx="42" ry="32" fill="#fff"/></g>`;
const hill = (W, H, y, color, amp = 60, ph = 0) => `<path d="M0 ${H} L0 ${y} Q${W * 0.25} ${y - amp + ph} ${W * 0.5} ${y} T${W} ${y} L${W} ${H} Z" fill="${color}"/>`;

export const BACKGROUNDS = {
  meadow: (W, H, { uid = 'm' } = {}) => `
    <defs><linearGradient id="${uid}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7CC8FF"/><stop offset="1" stop-color="#DDF3FF"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${uid}sky)"/>
    <circle cx="${W * 0.86}" cy="${H * 0.18}" r="${H * 0.09}" fill="#FFD23F"/><circle cx="${W * 0.86}" cy="${H * 0.18}" r="${H * 0.12}" fill="#FFF6C2" opacity=".55"/>
    ${cloudAt(W * 0.16, H * 0.2, H / 540)}${cloudAt(W * 0.55, H * 0.12, H / 700, 0.9)}${cloudAt(W * 0.72, H * 0.3, H / 800, 0.85)}
    ${hill(W, H, H * 0.62, '#8FDB8A', 70)}${hill(W, H, H * 0.74, '#5BC470', 60, 30)}${hill(W, H, H * 0.88, '#3CAF5E', 40, -20)}
    ${Array.from({ length: 9 }, (_, i) => `<circle cx="${(i + 0.5) * (W / 9) + (i % 2) * 20}" cy="${H * (0.8 + (i % 3) * 0.05)}" r="${H * 0.012}" fill="${['#FF6FA5', '#FFD23F', '#fff'][i % 3]}"/>`).join('')}`,
  sunrise: (W, H, { uid = 's' } = {}) => `
    <defs><linearGradient id="${uid}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB36B"/><stop offset=".55" stop-color="#FFE0A3"/><stop offset="1" stop-color="#FFF6E0"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${uid}sky)"/>
    <circle cx="${W * 0.5}" cy="${H * 0.66}" r="${H * 0.22}" fill="#FFD23F"/>
    ${cloudAt(W * 0.2, H * 0.28, H / 600)}${cloudAt(W * 0.78, H * 0.22, H / 520)}
    ${hill(W, H, H * 0.74, '#7ACB6B', 50)}${hill(W, H, H * 0.88, '#4CB35E', 40, 20)}`,
  classroom: (W, H, { uid = 'c' } = {}) => `
    <rect width="${W}" height="${H}" fill="#FFF0C9"/>
    <rect y="${H * 0.78}" width="${W}" height="${H * 0.22}" fill="#E8B773"/>
    <rect x="${W * 0.1}" y="${H * 0.1}" width="${W * 0.8}" height="${H * 0.5}" rx="18" fill="#2E7D5B" stroke="#8D5A3B" stroke-width="${H * 0.014}"/>
    <rect x="${W * 0.1}" y="${H * 0.6}" width="${W * 0.8}" height="${H * 0.02}" fill="#8D5A3B"/>
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="${W * (0.15 + i * 0.16)}" y="${H * 0.665}" width="${W * 0.04}" height="${H * 0.04}" rx="4" fill="${[P.berry, P.sun, P.sky, P.leaf, P.coral][i]}"/>`).join('')}`,
  ocean: (W, H, { uid = 'o' } = {}) => `
    <defs><linearGradient id="${uid}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BDEBFF"/><stop offset=".35" stop-color="#4FB4F0"/><stop offset="1" stop-color="#1D6FC4"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${uid}w)"/>
    ${Array.from({ length: 8 }, (_, i) => `<circle cx="${(i * 0.14 + 0.08) * W}" cy="${H * (0.3 + (i * 0.37) % 0.6)}" r="${H * (0.01 + (i % 3) * 0.006)}" fill="#fff" opacity=".45"/>`).join('')}
    <path d="M0 ${H} L0 ${H * 0.92} Q${W * 0.2} ${H * 0.86} ${W * 0.4} ${H * 0.93} T${W * 0.8} ${H * 0.92} T${W} ${H * 0.9} L${W} ${H} Z" fill="#F3D98B"/>`,
  forest: (W, H, { uid = 'f' } = {}) => `
    <defs><linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C9F0C0"/><stop offset="1" stop-color="#7FD08A"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${uid}g)"/>
    ${[0.08, 0.28, 0.5, 0.74, 0.92].map((x, i) => `<g transform="translate(${W * x} ${H * 0.55}) scale(${H / 360 * (0.8 + (i % 3) * 0.2)})"><rect x="-12" y="30" width="24" height="120" rx="6" fill="#8D5A3B"/><circle cx="0" cy="0" r="62" fill="${['#2EAD5B', '#3CC47C', '#259C52'][i % 3]}"/><circle cx="-38" cy="24" r="34" fill="${['#2EAD5B', '#3CC47C', '#259C52'][i % 3]}"/><circle cx="38" cy="24" r="34" fill="${['#2EAD5B', '#3CC47C', '#259C52'][i % 3]}"/></g>`).join('')}
    ${hill(W, H, H * 0.82, '#4CB35E', 36)}`,
  night: (W, H, { uid = 'n' } = {}) => `
    <defs><linearGradient id="${uid}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B1F5A"/><stop offset="1" stop-color="#4B3E9E"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${uid}n)"/>
    <circle cx="${W * 0.82}" cy="${H * 0.2}" r="${H * 0.1}" fill="#FFF3B0"/><circle cx="${W * 0.85}" cy="${H * 0.18}" r="${H * 0.085}" fill="#3A3A8C"/>
    ${Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 0.137 % 1) * W}" cy="${(i * 0.29 % 0.6) * H}" r="${H * (0.003 + (i % 3) * 0.002)}" fill="#fff" opacity=".85"/>`).join('')}
    ${hill(W, H, H * 0.84, '#2B2F7A', 40)}`,
  stage: (W, H, { uid = 'st' } = {}) => `
    <defs><radialGradient id="${uid}l" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#FFF6D6"/><stop offset="1" stop-color="#FFB86B"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#${uid}l)"/>
    <path d="M0 0 H${W * 0.16} Q${W * 0.1} ${H * 0.5} ${W * 0.18} ${H} H0 Z" fill="${P.berry}"/><path d="M${W} 0 H${W * 0.84} Q${W * 0.9} ${H * 0.5} ${W * 0.82} ${H} H${W} Z" fill="${P.berry}"/>
    <rect x="0" width="${W}" height="${H * 0.1}" fill="#C8326A"/>
    <rect y="${H * 0.86}" width="${W}" height="${H * 0.14}" fill="#8D5A3B"/>
    ${Array.from({ length: 14 }, (_, i) => `<circle cx="${(i + 0.5) * W / 14}" cy="${H * 0.05}" r="${H * 0.014}" fill="#FFE27A"/>`).join('')}`,
  /** Solid colour-lesson backdrop: a tint of the colour with soft white blobs and confetti. */
  tint: (W, H, { color = '#FFD6D6', accent = '#fff', uid = 't' } = {}) => `
    <rect width="${W}" height="${H}" fill="${color}"/>
    <circle cx="${W * 0.12}" cy="${H * 0.2}" r="${H * 0.34}" fill="${accent}" opacity=".35"/><circle cx="${W * 0.92}" cy="${H * 0.85}" r="${H * 0.42}" fill="${accent}" opacity=".3"/>
    ${Array.from({ length: 16 }, (_, i) => `<circle cx="${((i * 0.371) % 1) * W}" cy="${((i * 0.613) % 1) * H}" r="${H * (0.006 + (i % 4) * 0.003)}" fill="${accent}" opacity=".7"/>`).join('')}`,
  plain: (W, H, { color = P.cream } = {}) => `<rect width="${W}" height="${H}" fill="${color}"/>`,
};

export const BACKGROUND_KEYS = Object.keys(BACKGROUNDS);
export function backgroundSvg(key, W, H, opts = {}) {
  const f = BACKGROUNDS[key];
  if (!f) throw new Error(`Unknown background preset: ${key}`);
  return f(W, H, opts);
}
