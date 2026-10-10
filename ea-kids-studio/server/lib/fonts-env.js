// Must be imported BEFORE `sharp`. Points fontconfig at the bundled OFL fonts (Tajawal, Cairo,
// Baloo Bhaijaan 2, Fredoka) so Arabic/Latin text renders identically on every machine,
// without installing fonts system-wide.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ROOT } from '../config.js';

export const FONTS_DIR = path.join(ROOT, 'assets', 'fonts');

(function setup() {
  if (process.env.FONTCONFIG_FILE && process.env.EAK_FONTS_READY) return;
  const dir = path.join(process.env.DATA_DIR ? path.resolve(ROOT, process.env.DATA_DIR) : path.join(ROOT, 'data'), 'fontconfig');
  try {
    fs.mkdirSync(dir, { recursive: true });
    const conf = path.join(dir, 'fonts.conf');
    const sys = ['/etc/fonts/fonts.conf', '/opt/homebrew/etc/fonts/fonts.conf', '/usr/local/etc/fonts/fonts.conf'].find((f) => fs.existsSync(f));
    const xml = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
${sys ? `  <include ignore_missing="yes">${sys}</include>` : ''}
  <dir>${FONTS_DIR}</dir>
  <cachedir>${path.join(dir, 'cache')}</cachedir>
</fontconfig>
`;
    if (!fs.existsSync(conf) || fs.readFileSync(conf, 'utf8') !== xml) fs.writeFileSync(conf, xml);
    process.env.FONTCONFIG_FILE = conf;
    process.env.EAK_FONTS_READY = '1';
  } catch (e) {
    console.warn('[fonts] could not prepare fontconfig:', e.message, os.platform());
  }
})();
