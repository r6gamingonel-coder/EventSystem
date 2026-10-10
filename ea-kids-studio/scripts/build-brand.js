// Generates every EA KIDS brand asset into brand/out/ (PNG + SVG) and brand/palette.json.
// Run: npm run build:brand
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../server/config.js';
import * as B from '../server/art/brand.js';
import { PALETTE, FONT, COLOR_WORDS } from '../server/art/palette.js';
import { CHARACTERS, EMOTIONS, characterSvg } from '../server/art/characters.js';
import { PROP_KEYS, propSvg } from '../server/art/props.js';
import { composeThumbnail, THUMB_TEMPLATES } from '../server/art/thumbnail.js';
import { svgToPng, wrapSvg } from '../server/lib/imaging.js';

const out = path.join(ROOT, 'brand', 'out');
const dirs = ['mascots', 'props', 'thumbnail-templates'].map((d) => path.join(out, d));
fs.mkdirSync(out, { recursive: true }); dirs.forEach((d) => fs.mkdirSync(d, { recursive: true }));
const w = (rel, buf) => { fs.writeFileSync(path.join(out, rel), buf); console.log('  ✓', rel); };

console.log('Building EA KIDS brand assets…');
w('logo-main.png', await B.logoMain());
w('logo-horizontal.png', await B.logoHorizontal());
w('logo-mono-navy.png', await B.logoMono(PALETTE.navy));
w('logo-mono-white.png', await B.logoMono('#FFFFFF'));
w('profile-800x800.png', await B.profileImage());
w('banner-2560x1440.png', await B.banner());

for (const slug of Object.keys(CHARACTERS)) {
  for (const emo of EMOTIONS) {
    const svg = wrapSvg(400, 400, characterSvg(slug, emo));
    if (emo === 'happy') fs.writeFileSync(path.join(out, 'mascots', `${slug}.svg`), svg);
    fs.writeFileSync(path.join(out, 'mascots', `${slug}-${emo}.png`), await svgToPng(svg, 800, 800));
  }
  console.log('  ✓ mascots/' + slug);
}
for (const k of PROP_KEYS) fs.writeFileSync(path.join(out, 'props', `${k}.png`), await svgToPng(wrapSvg(200, 200, propSvg(k)), 400, 400));
console.log(`  ✓ props (${PROP_KEYS.length})`);

const sampleTitles = { colors: 'نتعلم الألوان', numbers: 'نعدّ معًا', alphabet: 'الحروف العربية', animals: 'أصوات الحيوانات', nature: 'عالم الطبيعة', story: 'قصة قبل النوم', habits: 'عادات جميلة', shapes: 'الأشكال', songs: 'أغنية جديدة', general: 'هل تعلم؟' };
for (const t of Object.keys(THUMB_TEMPLATES)) {
  const glyph = t === 'alphabet' ? 'أ' : t === 'numbers' ? '٣' : undefined;
  fs.writeFileSync(path.join(out, 'thumbnail-templates', `${t}.png`), await composeThumbnail({ template: t, title: sampleTitles[t], glyph, accent: t === 'colors' ? 'red' : t === 'alphabet' ? 'blue' : undefined, characters: [{ slug: ['rayyan', 'nunu', 'zaqzaq', 'sallouma'][Object.keys(THUMB_TEMPLATES).indexOf(t) % 4] }] }));
}
console.log('  ✓ thumbnail-templates');

fs.copyFileSync(path.join(ROOT, 'brand', 'BRAND_GUIDELINES.md'), path.join(out, 'BRAND_GUIDELINES.md'));
fs.writeFileSync(path.join(ROOT, 'brand', 'palette.json'), JSON.stringify({ palette: PALETTE, fonts: FONT, teachingColors: COLOR_WORDS }, null, 2));
console.log('Done →', path.relative(ROOT, out));
