// Probes what this machine can actually do. The UI uses this to explain what is missing
// instead of showing buttons that silently fail.
import fs from 'node:fs';
import { run, probeBinary } from '../lib/exec.js';

export function createCapabilities({ cfg }) {
  let cache = null; let at = 0;

  async function ffmpegFilters() {
    try {
      const { stdout } = await run(cfg.ffmpeg, ['-hide_banner', '-filters'], { timeoutMs: 8000 });
      const have = (n) => new RegExp(`\\s${n}\\s`).test(stdout);
      return { subtitles: have('subtitles') || have('ass'), xfade: have('xfade'), loudnorm: have('loudnorm'), sidechaincompress: have('sidechaincompress'), zoompan: have('zoompan'), blackdetect: have('blackdetect') };
    } catch { return null; }
  }

  async function detect(force = false) {
    if (cache && !force && Date.now() - at < 30_000) return cache;
    const [ffmpeg, ffprobe, espeak, filters] = await Promise.all([
      probeBinary(cfg.ffmpeg, ['-version']), probeBinary(cfg.ffprobe, ['-version']), probeBinary(cfg.espeak, ['--version']), ffmpegFilters(),
    ]);
    const k = cfg.keys;
    const fonts = fs.existsSync(cfg.fontsDir) ? fs.readdirSync(cfg.fontsDir).filter((f) => f.endsWith('.ttf')) : [];
    cache = {
      ffmpeg: { ok: !!ffmpeg, version: ffmpeg, filters, install: 'Install FFmpeg 6+ (https://ffmpeg.org/download.html) and set FFMPEG_PATH if it is not on PATH.' },
      ffprobe: { ok: !!ffprobe, version: ffprobe },
      espeak: { ok: !!espeak, version: espeak, install: 'Optional free draft voice: `sudo apt install espeak-ng` (Linux) / `brew install espeak-ng` (macOS).' },
      fonts: { ok: fonts.length > 0, files: fonts },
      providers: {
        llm: {
          offline_templates: { configured: true, paid: false },
          anthropic: { configured: !!k.anthropic, paid: true, env: 'ANTHROPIC_API_KEY' },
          openai: { configured: !!k.openai, paid: true, env: 'OPENAI_API_KEY' },
          openai_compatible: { configured: !!(k.openaiCompatBase && cfg.models.openaiCompat), paid: false, env: 'OPENAI_COMPAT_BASE_URL + OPENAI_COMPAT_MODEL (e.g. local Ollama)' },
        },
        tts: {
          espeak: { configured: !!espeak, paid: false, quality: 'draft', env: 'install espeak-ng' },
          import: { configured: true, paid: false, quality: 'owner-recorded', env: '' },
          azure: { configured: !!(k.azureSpeechKey && k.azureSpeechRegion), paid: true, env: 'AZURE_SPEECH_KEY + AZURE_SPEECH_REGION' },
          openai: { configured: !!k.openai, paid: true, env: 'OPENAI_API_KEY' },
          elevenlabs: { configured: !!k.elevenlabs, paid: true, env: 'ELEVENLABS_API_KEY' },
          google: { configured: !!k.googleTts, paid: true, env: 'GOOGLE_TTS_API_KEY' },
        },
        image: {
          local_svg: { configured: true, paid: false },
          import: { configured: true, paid: false },
          openai: { configured: !!k.openai, paid: true, env: 'OPENAI_API_KEY' },
        },
        video_generation: { configured: false, note: 'No video-generation API adapter is implemented. Import clips you are licensed to use (media type: imported_video).' },
      },
      youtube: { configured: !!(cfg.youtube.clientId && cfg.youtube.clientSecret), env: 'YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET' },
    };
    at = Date.now();
    return cache;
  }
  return { detect };
}
