// Original prop illustrations on a 200×200 grid (flat style, navy outline).
import { PALETTE as P } from './palette.js';

const S = (w = 4) => `stroke="${P.navy}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const shine = (x, y, rx = 10, ry = 16, rot = -30) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".55" transform="rotate(${rot} ${x} ${y})"/>`;

export const PROPS = {
  apple: () => `
    <path d="M100 56 C70 34 22 54 28 110 C34 160 70 184 100 172 C130 184 166 160 172 110 C178 54 130 34 100 56 Z" fill="#E5383B" ${S()}/>
    <path d="M100 56 Q98 34 108 20" fill="none" ${S(6)}/>
    <path d="M108 40 Q138 14 160 30 Q140 56 108 40 Z" fill="#3CC47C" ${S()}/>${shine(60, 90)}`,
  orange: () => `
    <circle cx="100" cy="106" r="70" fill="#FF8A1F" ${S()}/>
    <path d="M100 38 Q96 24 104 14" fill="none" ${S(5)}/><path d="M102 40 Q132 12 158 30 Q140 56 102 40 Z" fill="#3CC47C" ${S()}/>
    <g fill="#E8710A" opacity=".5"><circle cx="70" cy="110" r="3"/><circle cx="100" cy="128" r="3"/><circle cx="128" cy="100" r="3"/><circle cx="90" cy="86" r="3"/><circle cx="120" cy="136" r="3"/></g>${shine(66, 84)}`,
  banana: () => `
    <path d="M30 60 C40 150 120 190 176 120 C150 140 96 130 76 54 C62 50 40 48 30 60 Z" fill="#FFD23F" ${S()}/>
    <path d="M30 60 L24 44 L42 40 L48 54" fill="#8D6E3F" ${S(4)}/><path d="M176 120 l10 -4" ${S(6)}/>
    <path d="M60 90 Q90 150 150 140" fill="none" stroke="#E5B400" stroke-width="3" opacity=".6"/>`,
  sun: () => {
    const rays = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M${100 + Math.cos(a) * 62} ${100 + Math.sin(a) * 62} L${100 + Math.cos(a) * 88} ${100 + Math.sin(a) * 88}" stroke="#FF9F1C" stroke-width="10" stroke-linecap="round"/>`; }).join('');
    return `${rays}<circle cx="100" cy="100" r="50" fill="#FFD23F" ${S()}/>
      <circle cx="84" cy="94" r="5" fill="${P.navy}"/><circle cx="116" cy="94" r="5" fill="${P.navy}"/><path d="M82 112 Q100 130 118 112" fill="none" ${S(4)}/>
      <ellipse cx="72" cy="108" rx="8" ry="5" fill="#FF8FA3" opacity=".7"/><ellipse cx="128" cy="108" rx="8" ry="5" fill="#FF8FA3" opacity=".7"/>`;
  },
  leaf: () => `
    <path d="M24 176 C20 80 90 24 176 24 C180 110 130 176 24 176 Z" fill="#3CC47C" ${S()}/>
    <path d="M24 176 Q90 110 150 50" fill="none" stroke="#1F8F55" stroke-width="5" stroke-linecap="round"/>
    <g stroke="#1F8F55" stroke-width="4" stroke-linecap="round" fill="none"><path d="M70 130 l10 -26"/><path d="M96 104 l10 -26"/><path d="M60 150 l30 -8"/><path d="M96 124 l28 -10"/></g>${shine(120, 70, 8, 14, 40)}`,
  drop: () => `
    <path d="M100 20 C100 20 40 90 40 126 A60 60 0 0 0 160 126 C160 90 100 20 100 20 Z" fill="#2F80ED" ${S()}/>
    <path d="M66 128 A34 34 0 0 0 92 164" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".6"/>`,
  cloud: () => `
    <path d="M52 150 C20 150 18 108 52 104 C54 70 100 56 122 86 C150 66 188 90 176 124 C198 130 190 150 168 150 Z" fill="#fff" ${S()}/>
    <circle cx="86" cy="118" r="4" fill="${P.navy}"/><circle cx="118" cy="118" r="4" fill="${P.navy}"/><path d="M92 128 Q102 138 112 128" fill="none" ${S(3)}/>`,
  flower: () => {
    const petals = Array.from({ length: 6 }, (_, i) => `<ellipse cx="100" cy="52" rx="24" ry="36" fill="#FF6FA5" ${S(4)} transform="rotate(${i * 60} 100 90)"/>`).join('');
    return `<path d="M100 120 L100 190" stroke="#2EAD5B" stroke-width="9" stroke-linecap="round"/><path d="M100 160 Q132 140 150 150 Q132 176 100 168 Z" fill="#3CC47C" ${S(3)}/>
      ${petals}<circle cx="100" cy="90" r="22" fill="#FFD23F" ${S()}/>`;
  },
  grapes: () => {
    const pts = [[70, 80], [100, 78], [130, 80], [58, 108], [85, 108], [115, 108], [142, 108], [72, 136], [100, 136], [128, 136], [86, 162], [114, 162], [100, 184]];
    return `<path d="M100 60 Q100 36 112 24" fill="none" ${S(6)}/><path d="M104 40 Q138 14 164 32 Q146 60 104 40 Z" fill="#3CC47C" ${S(3)}/>
      ${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="17" fill="#8E5CF5" ${S(3.5)}/><circle cx="${x - 5}" cy="${y - 6}" r="4" fill="#fff" opacity=".55"/>`).join('')}`;
  },
  strawberry: () => `
    <path d="M100 176 C40 150 24 90 40 70 C60 48 140 48 160 70 C176 90 160 150 100 176 Z" fill="#E5383B" ${S()}/>
    <path d="M60 66 L80 46 L100 62 L120 46 L140 66 Q100 78 60 66 Z" fill="#3CC47C" ${S(3.5)}/>
    <g fill="#FFE29A"><ellipse cx="76" cy="98" rx="3" ry="5"/><ellipse cx="104" cy="92" rx="3" ry="5"/><ellipse cx="128" cy="104" rx="3" ry="5"/><ellipse cx="90" cy="124" rx="3" ry="5"/><ellipse cx="118" cy="130" rx="3" ry="5"/><ellipse cx="100" cy="150" rx="3" ry="5"/></g>`,
  star: () => `<path d="M100 18 L124 76 L186 80 L138 120 L154 182 L100 148 L46 182 L62 120 L14 80 L76 76 Z" fill="#FFD23F" ${S()}/>${shine(80, 66, 7, 12, 25)}`,
  heart: () => `<path d="M100 176 C20 120 18 56 62 44 C86 38 100 58 100 66 C100 58 114 38 138 44 C182 56 180 120 100 176 Z" fill="#FF5C8A" ${S()}/>${shine(60, 70, 8, 14, 30)}`,
  balloon: () => `<path d="M100 20 C48 20 36 76 62 112 C76 130 90 138 100 140 C110 138 124 130 138 112 C164 76 152 20 100 20 Z" fill="#E5383B" ${S()}/>
    <path d="M92 140 l8 12 l8 -12 Z" fill="#E5383B" ${S(3.5)}/><path d="M100 152 Q84 168 102 178 Q118 188 100 198" fill="none" stroke="${P.navy}" stroke-width="3"/>${shine(70, 62, 8, 18, 25)}`,
  ball: () => `<circle cx="100" cy="100" r="76" fill="#3FA9F5" ${S()}/><path d="M24 100 Q100 60 176 100" fill="none" stroke="#fff" stroke-width="12" opacity=".85"/><path d="M60 40 Q120 100 70 164" fill="none" stroke="#FFD23F" stroke-width="12" opacity=".95"/>${shine(70, 62, 9, 14, 30)}`,
  fish: () => `<path d="M30 100 C60 40 130 40 160 100 C130 160 60 160 30 100 Z" fill="#3FA9F5" ${S()}/><path d="M156 100 L192 66 L192 134 Z" fill="#FF8A1F" ${S()}/>
    <circle cx="68" cy="90" r="9" fill="#fff" ${S(3)}/><circle cx="70" cy="91" r="4" fill="${P.navy}"/><path d="M96 70 Q112 100 96 130" fill="none" stroke="#fff" stroke-width="5" opacity=".7"/>`,
  carrot: () => `<path d="M100 54 L132 54 L108 186 Q104 192 100 186 L68 54 Z" transform="rotate(25 100 110)" fill="#FF8A1F" ${S()}/>
    <g transform="rotate(25 100 110)"><path d="M84 54 Q76 22 92 12 Q96 34 100 54 Z M100 54 Q104 18 120 10 Q122 36 112 54 Z" fill="#3CC47C" ${S(3.5)}/><path d="M80 80 h20 M92 112 h20 M98 144 h14" stroke="#D96C00" stroke-width="4" stroke-linecap="round"/></g>`,
  tree: () => `<rect x="86" y="120" width="28" height="70" rx="6" fill="#8D5A3B" ${S()}/><circle cx="100" cy="80" r="56" fill="#3CC47C" ${S()}/><circle cx="64" cy="100" r="30" fill="#3CC47C" ${S()}/><circle cx="138" cy="100" r="30" fill="#3CC47C" ${S()}/><circle cx="100" cy="76" r="50" fill="#3CC47C"/><circle cx="84" cy="62" r="6" fill="#E5383B"/><circle cx="116" cy="88" r="6" fill="#E5383B"/>`,
  house: () => `<rect x="36" y="88" width="128" height="94" rx="6" fill="#FFE2C2" ${S()}/><path d="M24 92 L100 28 L176 92 Z" fill="#E5383B" ${S()}/><rect x="84" y="126" width="32" height="56" rx="4" fill="#8D5A3B" ${S(3.5)}/><rect x="48" y="104" width="28" height="26" rx="3" fill="#BDE3FF" ${S(3.5)}/><rect x="124" y="104" width="28" height="26" rx="3" fill="#BDE3FF" ${S(3.5)}/>`,
  // ----- shapes
  circle: () => `<circle cx="100" cy="100" r="76" fill="#FF8A1F" ${S()}/>${shine(66, 66, 10, 16, 35)}`,
  square: () => `<rect x="26" y="26" width="148" height="148" rx="12" fill="#3FA9F5" ${S()}/>${shine(52, 56, 8, 18, 0)}`,
  triangle: () => `<path d="M100 24 L180 172 L20 172 Z" fill="#3CC47C" ${S()}/>${shine(92, 76, 7, 16, 25)}`,
  rectangle: () => `<rect x="14" y="48" width="172" height="104" rx="12" fill="#8E5CF5" ${S()}/>${shine(40, 78, 8, 14, 0)}`,
  diamond: () => `<path d="M100 14 L180 100 L100 186 L20 100 Z" fill="#FF5C8A" ${S()}/>${shine(70, 80, 7, 14, 40)}`,
  // ----- hygiene
  bubble: () => `<circle cx="100" cy="100" r="66" fill="#D6E9FF" fill-opacity=".55" ${S(4)}/><path d="M60 80 A44 44 0 0 1 96 54" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/><circle cx="136" cy="130" r="8" fill="#fff" opacity=".8"/>`,
  soap: () => `<rect x="30" y="80" width="140" height="82" rx="26" fill="#FF8FB8" ${S()}/><rect x="40" y="88" width="120" height="30" rx="14" fill="#fff" opacity=".35"/><circle cx="62" cy="52" r="18" fill="#D6E9FF" ${S(3.5)}/><circle cx="104" cy="38" r="12" fill="#D6E9FF" ${S(3.5)}/><circle cx="140" cy="56" r="20" fill="#D6E9FF" ${S(3.5)}/>`,
  toothbrush: () => `<rect x="20" y="124" width="150" height="26" rx="13" fill="#3FA9F5" ${S()} transform="rotate(-30 100 100)"/><rect x="128" y="62" width="40" height="22" rx="6" fill="#fff" ${S()} transform="rotate(-30 100 100)"/><g stroke="#3CC47C" stroke-width="5" stroke-linecap="round" transform="rotate(-30 100 100)"><path d="M136 56 v-12 M148 56 v-12 M160 56 v-12"/></g>`,
  tooth: () => `<path d="M60 40 C80 30 90 44 100 44 C110 44 120 30 140 40 C166 54 156 96 148 124 C142 150 136 176 122 176 C108 176 112 138 100 138 C88 138 92 176 78 176 C64 176 58 150 52 124 C44 96 34 54 60 40 Z" fill="#fff" ${S()}/>${shine(70, 66, 8, 14, 30)}`,
  water: () => `<path d="M20 120 Q50 90 80 120 T140 120 T200 120 V180 H20 Z" fill="#3FA9F5" ${S()}/><path d="M20 140 Q50 112 80 140 T140 140 T200 140" fill="none" stroke="#fff" stroke-width="5" opacity=".6"/>`,
  // ----- kindness
  gift: () => `<rect x="30" y="86" width="140" height="92" rx="8" fill="#8E5CF5" ${S()}/><rect x="22" y="64" width="156" height="30" rx="8" fill="#B79CFF" ${S()}/><rect x="90" y="64" width="20" height="114" fill="#FFD23F" ${S(3.5)}/><path d="M100 64 C60 20 40 56 100 64 C160 56 140 20 100 64 Z" fill="#FFD23F" ${S(3.5)}/>`,
  book: () => `<path d="M20 50 Q60 36 100 56 Q140 36 180 50 V160 Q140 146 100 166 Q60 146 20 160 Z" fill="#fff" ${S()}/><path d="M100 56 V166" stroke="${P.navy}" stroke-width="4"/><g stroke="#3FA9F5" stroke-width="5" stroke-linecap="round"><path d="M36 80 Q60 72 84 84"/><path d="M36 104 Q60 96 84 108"/><path d="M116 84 Q140 72 164 80"/><path d="M116 108 Q140 96 164 104"/></g>`,
};

export const PROP_KEYS = Object.keys(PROPS);
export function propSvg(key) {
  const f = PROPS[key];
  if (!f) throw new Error(`Unknown prop: ${key}`);
  return `<g>${f()}</g>`;
}
