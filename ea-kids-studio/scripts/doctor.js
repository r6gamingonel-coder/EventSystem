// Environment check: tells you exactly what works and what to install. Exit code 1 if something critical is missing.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildConfig, ROOT } from '../server/config.js';
import { probeBinary, run } from '../server/lib/exec.js';

const cfg = buildConfig();
const rows = []; let critical = 0;
const add = (ok, name, detail, fix, crit = false) => { rows.push({ ok, name, detail, fix }); if (!ok && crit) critical++; };

const [maj, min] = process.versions.node.split('.').map(Number);
add(maj > 22 || (maj === 22 && min >= 13), 'Node.js ≥ 22.13', process.version, 'Install Node 22 LTS or newer (https://nodejs.org).', true);
try { await import('node:sqlite'); add(true, 'node:sqlite', 'built in'); } catch { add(false, 'node:sqlite', 'unavailable', 'Upgrade Node to 22.13+.', true); }

const ff = await probeBinary(cfg.ffmpeg); add(!!ff, 'FFmpeg', ff || 'not found', 'Install FFmpeg 6+ (apt install ffmpeg / brew install ffmpeg / winget install ffmpeg) or set FFMPEG_PATH.', true);
add(!!(await probeBinary(cfg.ffprobe)), 'ffprobe', 'comes with FFmpeg', 'Install FFmpeg (includes ffprobe) or set FFPROBE_PATH.', true);
if (ff) {
  try {
    const { stdout } = await run(cfg.ffmpeg, ['-hide_banner', '-filters'], { timeoutMs: 8000 });
    for (const f of ['subtitles', 'xfade', 'loudnorm', 'sidechaincompress', 'blackdetect']) add(new RegExp(`\\s${f}\\s`).test(stdout), `FFmpeg filter: ${f}`, '', 'Use a full FFmpeg build (with libass).', f === 'subtitles' || f === 'xfade');
    const bc = (await run(cfg.ffmpeg, ['-hide_banner', '-buildconf'], { timeoutMs: 8000 })).stdout;
    for (const l of ['libx264', 'libharfbuzz', 'libfribidi', 'libass']) add(bc.includes(`--enable-${l}`), `FFmpeg built with ${l}`, '', l === 'libx264' ? 'Needed for MP4 (H.264).' : 'Needed for correct Arabic captions.', l !== 'libass');
  } catch { /* ignore */ }
}
const es = await probeBinary(cfg.espeak, ['--version']); add(!!es, 'espeak-ng (free draft voice)', es || 'not installed — optional', 'Optional: apt install espeak-ng / brew install espeak-ng. Or use cloud voices / import recordings.');

try {
  const { renderText } = await import('../server/art/text.js');
  const t = await renderText('نتعلم الألوان', { font: 'display', weight: 800, maxW: 600, maxH: 200 });
  add(t.width > 100, 'Arabic text rendering (sharp + bundled fonts)', `${t.width}×${t.height}px`, 'Reinstall dependencies (npm ci). On Windows install the fonts in assets/fonts, or use WSL2/Docker.', true);
} catch (e) { add(false, 'sharp / fonts', e.message, 'Run `npm ci`.', true); }
add(fs.existsSync(path.join(ROOT, 'brand', 'out', 'logo-main.png')), 'Brand assets generated', '', 'Run `npm run build:brand`.');
try { const f = path.join(cfg.dataDir, '.doctor'); fs.writeFileSync(f, 'ok'); fs.rmSync(f); const st = fs.statfsSync(cfg.dataDir); add(st.bavail * st.bsize > 2e9, 'Disk space in data/', `${(st.bavail * st.bsize / 1e9).toFixed(1)} GB free`, 'Free up space; renders need a few GB.'); } catch (e) { add(false, 'data/ writable', e.message, 'Check permissions.', true); }
add(!!process.env.APP_SECRET || cfg.env !== 'production', 'APP_SECRET (production)', process.env.APP_SECRET ? 'set' : 'auto-generated in data/.app_secret (dev only)', 'Set APP_SECRET in .env before production use.');

const k = cfg.keys;
const prov = [['Anthropic', k.anthropic], ['OpenAI', k.openai], ['Local LLM (OpenAI-compatible)', k.openaiCompatBase && cfg.models.openaiCompat], ['Azure Speech', k.azureSpeechKey && k.azureSpeechRegion], ['ElevenLabs', k.elevenlabs], ['Google TTS', k.googleTts], ['YouTube OAuth', cfg.youtube.clientId && cfg.youtube.clientSecret]];
console.log('\nEA KIDS Studio — environment check\n');
for (const r of rows) console.log(`${r.ok ? ' ✔ ' : ' ✘ '} ${r.name}${r.detail ? ` — ${r.detail}` : ''}${!r.ok && r.fix ? `\n      → ${r.fix}` : ''}`);
console.log('\nOptional providers (configured = key present in .env; never printed):');
for (const [n, v] of prov) console.log(`   ${v ? '●' : '○'} ${n}: ${v ? 'configured' : 'not configured'}`);
console.log(`\nPlatform: ${os.platform()} ${os.release()} · ${os.cpus().length} CPU cores · ${(os.totalmem() / 1e9).toFixed(0)} GB RAM`);
console.log(critical ? `\n${critical} critical problem(s). Fix them, then run \`npm run doctor\` again.` : '\nAll critical checks passed. Run `npm start`.');
process.exit(critical ? 1 : 0);
