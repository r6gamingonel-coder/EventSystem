// Supporting animals (original drawings, same style as the mascots) used by the animals & sounds kit.
import { PALETTE as P } from './palette.js';
import { face, stroke } from './characters.js';

const O = P.navy;
const dog = (e) => `
  <path d="M290 330 Q340 310 336 262" fill="none" stroke="${O}" stroke-width="22" stroke-linecap="round"/><path d="M290 330 Q340 310 336 262" fill="none" stroke="#C98B5A" stroke-width="12" stroke-linecap="round"/>
  <ellipse cx="200" cy="318" rx="74" ry="66" fill="#C98B5A" ${stroke()}/><ellipse cx="200" cy="336" rx="44" ry="42" fill="${P.cream}"/>
  <ellipse cx="152" cy="382" rx="30" ry="15" fill="#C98B5A" ${stroke()}/><ellipse cx="248" cy="382" rx="30" ry="15" fill="#C98B5A" ${stroke()}/>
  <path d="M104 118 Q70 130 78 220 Q112 226 134 168 Z" fill="#8D5A3B" ${stroke()}/><path d="M296 118 Q330 130 322 220 Q288 226 266 168 Z" fill="#8D5A3B" ${stroke()}/>
  <ellipse cx="200" cy="180" rx="90" ry="82" fill="#C98B5A" ${stroke()}/>
  <ellipse cx="200" cy="212" rx="46" ry="34" fill="${P.cream}" ${stroke(4)}/><ellipse cx="200" cy="194" rx="18" ry="12" fill="${O}"/>
  ${face({ ex: 38, ey: 158, my: 224, eyeR: 13, cheekY: 206 }, e)}`;
const cat = (e) => `
  <path d="M278 330 Q350 330 340 250 Q336 226 316 236" fill="none" stroke="${O}" stroke-width="22" stroke-linecap="round"/><path d="M278 330 Q350 330 340 250 Q336 226 316 236" fill="none" stroke="#9FB4C7" stroke-width="12" stroke-linecap="round"/>
  <ellipse cx="200" cy="320" rx="70" ry="64" fill="#9FB4C7" ${stroke()}/><ellipse cx="200" cy="338" rx="40" ry="40" fill="#fff"/>
  <ellipse cx="156" cy="382" rx="28" ry="14" fill="#9FB4C7" ${stroke()}/><ellipse cx="244" cy="382" rx="28" ry="14" fill="#9FB4C7" ${stroke()}/>
  <path d="M118 150 L112 66 L176 112 Z" fill="#9FB4C7" ${stroke()}/><path d="M282 150 L288 66 L224 112 Z" fill="#9FB4C7" ${stroke()}/>
  <path d="M124 130 L122 90 L156 114 Z" fill="#FFB3C7"/><path d="M276 130 L278 90 L244 114 Z" fill="#FFB3C7"/>
  <ellipse cx="200" cy="182" rx="88" ry="76" fill="#9FB4C7" ${stroke()}/>
  <g stroke="#7E94A8" stroke-width="5" stroke-linecap="round"><path d="M196 110 v22 M178 114 v16 M214 114 v16"/></g>
  <ellipse cx="200" cy="206" rx="34" ry="24" fill="#fff"/><path d="M190 190 h20 l-10 10 Z" fill="#FF7A9C" ${stroke(3)}/>
  <g stroke="${O}" stroke-width="3" stroke-linecap="round"><path d="M150 206 l-44 -8 M150 214 l-44 8 M250 206 l44 -8 M250 214 l44 8"/></g>
  ${face({ ex: 38, ey: 160, my: 212, eyeR: 13, cheekY: 200 }, e)}`;
const cow = (e) => `
  <path d="M290 320 Q330 330 326 372" fill="none" stroke="${O}" stroke-width="12" stroke-linecap="round"/><circle cx="326" cy="378" r="12" fill="${O}"/>
  <ellipse cx="200" cy="318" rx="86" ry="68" fill="#fff" ${stroke()}/><ellipse cx="248" cy="310" rx="30" ry="26" fill="#3A3A4A"/><ellipse cx="150" cy="340" rx="22" ry="18" fill="#3A3A4A"/>
  <rect x="136" y="360" width="30" height="30" rx="10" fill="#fff" ${stroke()}/><rect x="234" y="360" width="30" height="30" rx="10" fill="#fff" ${stroke()}/>
  <path d="M130 112 Q112 70 138 62 Q140 90 150 108 Z" fill="#FFE9A8" ${stroke()}/><path d="M270 112 Q288 70 262 62 Q260 90 250 108 Z" fill="#FFE9A8" ${stroke()}/>
  <ellipse cx="98" cy="150" rx="34" ry="20" fill="#fff" ${stroke()} transform="rotate(-20 98 150)"/><ellipse cx="302" cy="150" rx="34" ry="20" fill="#fff" ${stroke()} transform="rotate(20 302 150)"/>
  <ellipse cx="200" cy="170" rx="84" ry="78" fill="#fff" ${stroke()}/><ellipse cx="248" cy="132" rx="30" ry="24" fill="#3A3A4A"/>
  <ellipse cx="200" cy="214" rx="54" ry="36" fill="#FFB3C7" ${stroke(4)}/><ellipse cx="182" cy="214" rx="6" ry="9" fill="${O}"/><ellipse cx="218" cy="214" rx="6" ry="9" fill="${O}"/>
  ${face({ ex: 36, ey: 158, my: 240, eyeR: 13, cheekY: 190, noMouth: true }, e)}
  <path d="M184 244 Q200 256 216 244" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`;
const duck = (e) => `
  <g stroke="#FF8A1F" stroke-width="9" stroke-linecap="round" fill="none"><path d="M170 340 v34 M170 374 l-18 8 M170 374 l18 8"/><path d="M230 340 v34 M230 374 l-18 8 M230 374 l18 8"/></g>
  <ellipse cx="200" cy="290" rx="110" ry="84" fill="#fff" ${stroke()}/>
  <path d="M96 270 Q70 300 110 330 Q130 300 130 270 Z" fill="#E7F0FF" ${stroke()}/><path d="M304 270 Q330 300 290 330 Q270 300 270 270 Z" fill="#E7F0FF" ${stroke()}/>
  <circle cx="200" cy="176" r="84" fill="#fff" ${stroke()}/>
  <path d="M186 96 Q196 70 214 84 Q206 96 210 104 Z" fill="#fff" ${stroke(4)}/>
  <path d="M150 208 Q200 190 250 208 Q250 244 200 248 Q150 244 150 208 Z" fill="#FF8A1F" ${stroke()}/><path d="M168 224 h64" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
  ${face({ ex: 40, ey: 152, my: 230, eyeR: 14, cheekY: 196, noMouth: true }, e)}`;
const sheep = (e) => {
  const puffs = [[110, 290], [150, 262], [200, 252], [250, 262], [292, 290], [120, 330], [200, 340], [280, 330], [160, 310], [240, 310]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="48" fill="#fff" ${stroke(5)}/>`).join('');
  return `
  <rect x="148" y="350" width="22" height="38" rx="8" fill="#4A4A5A" ${stroke()}/><rect x="230" y="350" width="22" height="38" rx="8" fill="#4A4A5A" ${stroke()}/>
  ${puffs}${[[110, 290], [150, 262], [200, 252], [250, 262], [292, 290]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="42" fill="#fff"/>`).join('')}
  <ellipse cx="116" cy="170" rx="34" ry="20" fill="#5A5A6E" ${stroke()} transform="rotate(-25 116 170)"/><ellipse cx="284" cy="170" rx="34" ry="20" fill="#5A5A6E" ${stroke()} transform="rotate(25 284 170)"/>
  <circle cx="200" cy="130" r="40" fill="#fff" ${stroke()}/><circle cx="160" cy="146" r="30" fill="#fff" ${stroke()}/><circle cx="240" cy="146" r="30" fill="#fff" ${stroke()}/>
  <ellipse cx="200" cy="196" rx="70" ry="68" fill="#5A5A6E" ${stroke()}/>
  ${face({ ex: 32, ey: 182, my: 224, eyeR: 13, cheekY: 212, cheek: '#FF9FB0' }, e)}`;
};
const frog = (e) => `
  <ellipse cx="120" cy="364" rx="46" ry="20" fill="#5CCB5F" ${stroke()}/><ellipse cx="280" cy="364" rx="46" ry="20" fill="#5CCB5F" ${stroke()}/>
  <ellipse cx="200" cy="300" rx="104" ry="84" fill="#5CCB5F" ${stroke()}/><ellipse cx="200" cy="326" rx="64" ry="48" fill="#C9F5B8"/>
  <path d="M110 290 q-34 22 -10 64" fill="none" stroke="${O}" stroke-width="20" stroke-linecap="round"/><path d="M110 290 q-34 22 -10 64" fill="none" stroke="#5CCB5F" stroke-width="11" stroke-linecap="round"/>
  <path d="M290 290 q34 22 10 64" fill="none" stroke="${O}" stroke-width="20" stroke-linecap="round"/><path d="M290 290 q34 22 10 64" fill="none" stroke="#5CCB5F" stroke-width="11" stroke-linecap="round"/>
  <ellipse cx="200" cy="206" rx="104" ry="72" fill="#5CCB5F" ${stroke()}/>
  <circle cx="142" cy="140" r="38" fill="#5CCB5F" ${stroke()}/><circle cx="258" cy="140" r="38" fill="#5CCB5F" ${stroke()}/>
  ${face({ ex: 58, ey: 140, my: 232, eyeR: 18, cheekY: 214, cheek: '#FF9FB0', noMouth: true }, e)}
  <path d="M130 228 Q200 282 270 228" fill="none" ${stroke(5)}/>`;

export const ANIMALS_DEF = {
  cat:   { nameAr: 'القطة',   soundAr: 'مياو', verbAr: 'تموء', draw: cat },
  dog:   { nameAr: 'الكلب',   soundAr: 'هاو هاو', verbAr: 'ينبح', draw: dog },
  cow:   { nameAr: 'البقرة',  soundAr: 'موو', verbAr: 'تخور', draw: cow },
  duck:  { nameAr: 'البطة',   soundAr: 'بط بط', verbAr: 'تقول', draw: duck },
  sheep: { nameAr: 'الخروف',  soundAr: 'ماع', verbAr: 'يثغو', draw: sheep },
  frog:  { nameAr: 'الضفدع',  soundAr: 'نق نق', verbAr: 'ينقّ', draw: frog },
};
export const ANIMAL_KEYS = Object.keys(ANIMALS_DEF);
export const animalSvg = (key, emotion = 'happy') => {
  const a = ANIMALS_DEF[key];
  if (!a) throw new Error(`Unknown animal: ${key}`);
  return `<g>${a.draw(emotion)}</g>`;
};
