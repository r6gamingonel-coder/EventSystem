// Original EA KIDS mascots, drawn as parametric SVG (400×400 design grid, flat friendly style,
// navy outlines). Not derived from any existing cartoon character. Each character has a fixed
// colour set and silhouette so they stay consistent across every scene, thumbnail and logo.
import { PALETTE as P } from './palette.js';

const OUT = P.navy;
export const stroke = (w = 5) => `stroke="${OUT}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

/** Facial expressions shared by all characters (eye + mouth + cheeks), positioned per character. */
export function face({ ex = 34, ey = 160, cx = 200, my = 205, eyeR = 13, cheek = '#FF8FA3', cheekY, noMouth = false }, emotion = 'happy') {
  const L = cx - ex; const R = cx + ex;
  const eye = (x, style) => {
    if (style === 'closed') return `<path d="M${x - eyeR} ${ey + 2} Q${x} ${ey - eyeR} ${x + eyeR} ${ey + 2}" fill="none" ${stroke(5)}/>`;
    if (style === 'wink') return `<path d="M${x - eyeR} ${ey} Q${x} ${ey + eyeR * 0.9} ${x + eyeR} ${ey}" fill="none" ${stroke(5)}/>`;
    const r = style === 'wide' ? eyeR * 1.3 : eyeR;
    return `<circle cx="${x}" cy="${ey}" r="${r}" fill="#fff" ${stroke(4)}/><circle cx="${x + 1}" cy="${ey + 1}" r="${r * 0.58}" fill="${OUT}"/><circle cx="${x + r * 0.28}" cy="${ey - r * 0.25}" r="${r * 0.2}" fill="#fff"/>`;
  };
  const style = { happy: ['open', 'open'], smile: ['open', 'open'], wow: ['wide', 'wide'], wink: ['open', 'wink'], proud: ['closed', 'closed'], love: ['closed', 'closed'] }[emotion] || ['open', 'open'];
  const mouths = {
    happy: `<path d="M${cx - 22} ${my} Q${cx} ${my + 34} ${cx + 22} ${my} Z" fill="#B3263E" ${stroke(4)}/><path d="M${cx - 11} ${my + 16} Q${cx} ${my + 8} ${cx + 11} ${my + 16} Q${cx} ${my + 26} ${cx - 11} ${my + 16}" fill="#FF8FA3"/>`,
    smile: `<path d="M${cx - 20} ${my} Q${cx} ${my + 22} ${cx + 20} ${my}" fill="none" ${stroke(5)}/>`,
    wow: `<ellipse cx="${cx}" cy="${my + 8}" rx="11" ry="14" fill="#B3263E" ${stroke(4)}/>`,
    wink: `<path d="M${cx - 20} ${my} Q${cx} ${my + 26} ${cx + 20} ${my}" fill="none" ${stroke(5)}/>`,
    proud: `<path d="M${cx - 22} ${my} Q${cx} ${my + 30} ${cx + 22} ${my} Z" fill="#B3263E" ${stroke(4)}/>`,
    love: `<path d="M${cx - 20} ${my} Q${cx} ${my + 24} ${cx + 20} ${my}" fill="none" ${stroke(5)}/>`,
  };
  const cy = cheekY ?? my - 6;
  return `${eye(L, style[0])}${eye(R, style[1])}
    <ellipse cx="${L - 14}" cy="${cy}" rx="13" ry="8" fill="${cheek}" opacity=".75"/><ellipse cx="${R + 14}" cy="${cy}" rx="13" ry="8" fill="${cheek}" opacity=".75"/>
    ${noMouth ? '' : mouths[emotion] || mouths.happy}`;
}

// ---------------------------------------------------------------- Rayyan — lion cub (leader, curious guide)
function rayyan(emotion) {
  const mane = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return `<circle cx="${200 + Math.cos(a) * 92}" cy="${172 + Math.sin(a) * 88}" r="34" fill="#E07B2A" ${stroke(5)}/>`;
  }).join('');
  return `
  <path d="M268 330 Q335 320 332 262" fill="none" stroke="${OUT}" stroke-width="22" stroke-linecap="round"/><path d="M268 330 Q335 320 332 262" fill="none" stroke="#FFB84D" stroke-width="12" stroke-linecap="round"/>
  <circle cx="332" cy="254" r="17" fill="#E07B2A" ${stroke(5)}/>
  <ellipse cx="200" cy="322" rx="76" ry="66" fill="#FFB84D" ${stroke()}/>
  <ellipse cx="200" cy="338" rx="46" ry="44" fill="${P.cream}"/>
  <ellipse cx="150" cy="384" rx="30" ry="15" fill="#FFB84D" ${stroke()}/><ellipse cx="250" cy="384" rx="30" ry="15" fill="#FFB84D" ${stroke()}/>
  <path d="M122 300 q-34 14 -24 52" fill="none" stroke="${OUT}" stroke-width="20" stroke-linecap="round"/><path d="M122 300 q-34 14 -24 52" fill="none" stroke="#FFB84D" stroke-width="11" stroke-linecap="round"/>
  <path d="M278 300 q34 14 24 52" fill="none" stroke="${OUT}" stroke-width="20" stroke-linecap="round"/><path d="M278 300 q34 14 24 52" fill="none" stroke="#FFB84D" stroke-width="11" stroke-linecap="round"/>
  <path d="M138 262 Q200 296 262 262 L268 288 Q200 322 132 288 Z" fill="${P.sky}" ${stroke()}/>
  <path d="M236 292 l16 44 l22 -10 l-10 -40 Z" fill="${P.sky}" ${stroke()}/>
  ${mane}
  <circle cx="200" cy="172" r="82" fill="#FFB84D" ${stroke()}/>
  <circle cx="132" cy="104" r="27" fill="#FFB84D" ${stroke()}/><circle cx="132" cy="106" r="14" fill="#FF9A8B"/>
  <circle cx="268" cy="104" r="27" fill="#FFB84D" ${stroke()}/><circle cx="268" cy="106" r="14" fill="#FF9A8B"/>
  <ellipse cx="200" cy="208" rx="44" ry="32" fill="${P.cream}" ${stroke(4)}/>
  <path d="M184 186 Q200 178 216 186 Q214 200 200 204 Q186 200 184 186 Z" fill="#8A3B2B" ${stroke(3)}/>
  ${face({ ex: 36, ey: 150, my: 212, eyeR: 14, cheekY: 196, noMouth: false }, emotion)}`;
}

// ---------------------------------------------------------------- Nunu — bunny (gentle, loves counting)
function nunu(emotion) {
  return `
  <circle cx="318" cy="332" r="20" fill="#fff" ${stroke(5)}/>
  <ellipse cx="200" cy="322" rx="70" ry="64" fill="#EADFFF" ${stroke()}/>
  <ellipse cx="200" cy="338" rx="42" ry="40" fill="#fff"/>
  <ellipse cx="152" cy="385" rx="32" ry="15" fill="#EADFFF" ${stroke()}/><ellipse cx="248" cy="385" rx="32" ry="15" fill="#EADFFF" ${stroke()}/>
  <ellipse cx="156" cy="388" rx="14" ry="7" fill="#FFB3C7"/><ellipse cx="244" cy="388" rx="14" ry="7" fill="#FFB3C7"/>
  <path d="M128 300 q-30 14 -22 50" fill="none" stroke="${OUT}" stroke-width="20" stroke-linecap="round"/><path d="M128 300 q-30 14 -22 50" fill="none" stroke="#EADFFF" stroke-width="11" stroke-linecap="round"/>
  <path d="M272 300 q30 14 22 50" fill="none" stroke="${OUT}" stroke-width="20" stroke-linecap="round"/><path d="M272 300 q30 14 22 50" fill="none" stroke="#EADFFF" stroke-width="11" stroke-linecap="round"/>
  <g transform="rotate(-10 150 110)"><ellipse cx="150" cy="82" rx="27" ry="72" fill="#EADFFF" ${stroke()}/><ellipse cx="150" cy="86" rx="13" ry="52" fill="#FFB3C7"/></g>
  <g transform="rotate(10 250 110)"><ellipse cx="250" cy="82" rx="27" ry="72" fill="#EADFFF" ${stroke()}/><ellipse cx="250" cy="86" rx="13" ry="52" fill="#FFB3C7"/></g>
  <ellipse cx="200" cy="188" rx="78" ry="70" fill="#EADFFF" ${stroke()}/>
  <ellipse cx="200" cy="208" rx="38" ry="28" fill="#fff"/>
  <path d="M188 190 Q200 183 212 190 Q210 200 200 203 Q190 200 188 190 Z" fill="#FF5C8A" ${stroke(3)}/>
  ${face({ ex: 34, ey: 165, my: 214, eyeR: 13, cheekY: 200 }, emotion)}
  <rect x="193" y="228" width="14" height="14" rx="3" fill="#fff" ${stroke(3)}/>
  <path d="M236 128 l-26 -14 l0 30 Z M236 128 l26 -14 l0 30 Z" fill="${P.berry}" ${stroke(4)}/><circle cx="236" cy="130" r="8" fill="${P.berry}" ${stroke(4)}/>`;
}

// ---------------------------------------------------------------- Sallouma — turtle (calm, wise, loves nature)
function sallouma(emotion) {
  const hexes = [[200, 190], [150, 215], [250, 215], [175, 255], [225, 255], [124, 258], [276, 258]]
    .map(([x, y]) => `<path d="M${x} ${y - 24} l22 12 l0 24 l-22 12 l-22 -12 l0 -24 Z" fill="#2E9E63" ${stroke(3)}/>`).join('');
  return `
  <ellipse cx="200" cy="380" rx="120" ry="14" fill="${OUT}" opacity=".08"/>
  <ellipse cx="110" cy="352" rx="30" ry="22" fill="#A8E063" ${stroke()}/><ellipse cx="290" cy="352" rx="30" ry="22" fill="#A8E063" ${stroke()}/>
  <path d="M60 300 Q200 -20 340 300 Z" fill="#3CB371" ${stroke(6)}/>
  <path d="M60 300 Q200 330 340 300" fill="#F3D98B" ${stroke(6)}/>
  ${hexes}
  <circle cx="200" cy="278" r="68" fill="#A8E063" ${stroke()}/>
  ${face({ ex: 30, ey: 262, my: 300, eyeR: 12, cheekY: 290, cheek: '#FF9FB0' }, emotion)}
  <g fill="none" ${stroke(4)}><circle cx="170" cy="262" r="22"/><circle cx="230" cy="262" r="22"/><path d="M192 262 h16"/></g>`;
}

// ---------------------------------------------------------------- Zaqzaq — chick (cheerful, loves sounds & songs)
function zaqzaq(emotion) {
  return `
  <g stroke="#FF8A1F" stroke-width="9" stroke-linecap="round" fill="none"><path d="M172 340 v36 M172 376 l-16 8 M172 376 l16 8 M172 376 v10"/><path d="M228 340 v36 M228 376 l-16 8 M228 376 l16 8 M228 376 v10"/></g>
  <circle cx="200" cy="230" r="112" fill="#FFD23F" ${stroke()}/>
  <path d="M184 120 Q176 88 160 82 Q184 80 194 104 Q196 78 214 70 Q212 96 208 120 Z" fill="#FFD23F" ${stroke(5)}/>
  <g transform="rotate(-24 100 250)"><ellipse cx="100" cy="250" rx="26" ry="46" fill="#FFC21A" ${stroke()}/></g>
  <g transform="rotate(24 300 250)"><ellipse cx="300" cy="250" rx="26" ry="46" fill="#FFC21A" ${stroke()}/></g>
  <ellipse cx="200" cy="268" rx="62" ry="50" fill="#FFF0A8"/>
  ${face({ ex: 38, ey: 200, my: 262, eyeR: 14, cheekY: 238, noMouth: true }, emotion)}
  <path d="M176 232 Q200 222 224 232 Q216 258 200 262 Q184 258 176 232 Z" fill="#FF8A1F" ${stroke(4)}/>
  <path d="M184 246 Q200 252 216 246" fill="none" stroke="${OUT}" stroke-width="3"/>`;
}

export const CHARACTERS = {
  rayyan: {
    slug: 'rayyan', nameAr: 'ريّان', nameEn: 'Rayyan', species: 'Lion cub',
    description: 'A brave, curious lion cub with a golden mane and a teal scarf. Rayyan is the friendly guide who introduces every lesson.',
    colors: { body: '#FFB84D', mane: '#E07B2A', scarf: P.sky, muzzle: P.cream },
    features: 'Round golden head with a scalloped orange mane, small round ears with pink inside, cream muzzle, brown heart-shaped nose, teal scarf tied at the neck, tail with an orange tuft.',
    personality: 'Brave, curious, encouraging. Always asks the audience a question and celebrates answers.',
    eduRole: 'Host / guide — introduces the topic and recaps what was learned.',
    voice: { gender: 'neutral', age: 'young', style: 'warm and upbeat', note: 'Use a licensed TTS voice or a voice actor you have a written agreement with. Do not clone a real person.' },
    draw: rayyan,
  },
  nunu: {
    slug: 'nunu', nameAr: 'نونو', nameEn: 'Nunu', species: 'Bunny',
    description: 'A gentle lavender bunny with a pink bow. Nunu loves counting and always shares.',
    colors: { body: '#EADFFF', inner: '#FFB3C7', bow: P.berry },
    features: 'Lavender body, very tall ears with pink inner, round face, pink bow on the right ear, two small front teeth, white pom-pom tail.',
    personality: 'Gentle, kind, a little shy but loves to share and help.',
    eduRole: 'Counting, numbers and kindness lessons.',
    voice: { gender: 'female-presenting', age: 'young', style: 'soft and kind', note: 'Licensed TTS voice or consenting voice actor only.' },
    draw: nunu,
  },
  sallouma: {
    slug: 'sallouma', nameAr: 'سلّومة', nameEn: 'Sallouma', species: 'Turtle',
    description: 'A calm, wise little turtle with round glasses and a green hexagon-patterned shell.',
    colors: { body: '#A8E063', shell: '#3CB371', belly: '#F3D98B' },
    features: 'Dome-shaped green shell with darker hexagon pattern, light-green round head, small round glasses, stubby feet.',
    personality: 'Calm, patient, loves nature facts. Speaks slowly and clearly.',
    eduRole: 'Nature, science and good-habits lessons.',
    voice: { gender: 'neutral', age: 'adult-friendly', style: 'slow and calm', note: 'Licensed TTS voice or consenting voice actor only.' },
    draw: sallouma,
  },
  zaqzaq: {
    slug: 'zaqzaq', nameAr: 'زقزق', nameEn: 'Zaqzaq', species: 'Chick',
    description: 'A tiny round yellow chick who loves songs, sounds and surprises.',
    colors: { body: '#FFD23F', beak: '#FF8A1F', belly: '#FFF0A8' },
    features: 'Perfectly round yellow body, three-feather head tuft, small orange beak, tiny wings, thin orange legs with three toes.',
    personality: 'Cheerful, energetic, giggles a lot. Loves animal sounds and songs.',
    eduRole: 'Songs, animal sounds and alphabet sounds.',
    voice: { gender: 'neutral', age: 'child-like', style: 'bubbly', note: 'Licensed TTS voice or consenting voice actor only.' },
    draw: zaqzaq,
  },
};

/** SVG fragment (400×400 design grid) for a character. `uid` is accepted for API symmetry. */
export function characterSvg(slug, emotion = 'happy') {
  const c = CHARACTERS[slug];
  if (!c) throw new Error(`Unknown character: ${slug}`);
  return `<g>${c.draw(emotion)}</g>`;
}
export const EMOTIONS = ['happy', 'smile', 'wow', 'wink', 'proud', 'love'];
