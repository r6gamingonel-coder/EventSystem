// Central configuration. Everything comes from environment variables (see .env.example).
// Secrets are read here, on the server only, and never serialised to the browser.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Load .env (without overriding real environment variables).
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  try { process.loadEnvFile(envFile); } catch { /* malformed .env is reported by `npm run doctor` */ }
}

const env = process.env;
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

export function buildConfig(overrides = {}) {
  const e = { ...env, ...overrides };
  const dataDir = path.resolve(ROOT, e.DATA_DIR || 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // APP_SECRET encrypts OAuth tokens at rest. In production it must come from the environment.
  let appSecret = e.APP_SECRET;
  if (!appSecret) {
    if (e.NODE_ENV === 'production') {
      throw new Error('APP_SECRET is required in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
    const f = path.join(dataDir, '.app_secret');
    if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    appSecret = fs.readFileSync(f, 'utf8').trim();
  }

  const cfg = {
    env: e.NODE_ENV || 'development',
    host: e.HOST || '127.0.0.1',
    port: num(e.PORT, 4300),
    publicUrl: e.PUBLIC_URL || '',
    trustProxy: bool(e.TRUST_PROXY, false),
    secureCookies: bool(e.SECURE_COOKIES, e.NODE_ENV === 'production'),
    dataDir,
    mediaDir: path.join(dataDir, 'media'),
    backupDir: path.join(dataDir, 'backups'),
    logDir: path.join(dataDir, 'logs'),
    dbFile: path.join(dataDir, e.DB_FILE || 'studio.db'),
    appSecret,
    setupToken: e.SETUP_TOKEN || '',
    sessionHours: num(e.SESSION_HOURS, 12),
    maxUploadMb: num(e.MAX_UPLOAD_MB, 50),
    ffmpeg: e.FFMPEG_PATH || 'ffmpeg',
    ffprobe: e.FFPROBE_PATH || 'ffprobe',
    espeak: e.ESPEAK_PATH || 'espeak-ng',
    jobPollMs: num(e.JOB_POLL_MS, 700),
    uploadChunkBytes: Math.max(262144, Math.floor(num(e.UPLOAD_CHUNK_BYTES, 8 * 1024 * 1024) / 262144) * 262144), // resumable uploads need multiples of 256 KiB
    jobRetryBaseMs: num(e.JOB_RETRY_BASE_MS, 5000),
    fontsDir: path.join(ROOT, 'assets', 'fonts'),
    // Providers: keys live only in the environment. `configured` is the only thing the UI sees.
    keys: {
      anthropic: e.ANTHROPIC_API_KEY || '',
      openai: e.OPENAI_API_KEY || '',
      openaiCompatBase: e.OPENAI_COMPAT_BASE_URL || '',
      openaiCompatKey: e.OPENAI_COMPAT_API_KEY || '',
      azureSpeechKey: e.AZURE_SPEECH_KEY || '',
      azureSpeechRegion: e.AZURE_SPEECH_REGION || '',
      elevenlabs: e.ELEVENLABS_API_KEY || '',
      googleTts: e.GOOGLE_TTS_API_KEY || '',
    },
    models: {
      anthropic: e.ANTHROPIC_MODEL || 'claude-opus-5-5',
      openaiText: e.OPENAI_TEXT_MODEL || 'gpt-4.1',
      openaiCompat: e.OPENAI_COMPAT_MODEL || '',
      openaiImage: e.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      openaiTts: e.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
    },
    anthropicBaseUrl: e.ANTHROPIC_BASE_URL || undefined, // tests point this at a mock server
    openaiBase: e.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    youtube: {
      clientId: e.YOUTUBE_CLIENT_ID || '',
      clientSecret: e.YOUTUBE_CLIENT_SECRET || '',
      redirectUri: e.YOUTUBE_REDIRECT_URI || `http://localhost:${num(e.PORT, 4300)}/api/youtube/oauth/callback`,
      authBase: e.YOUTUBE_AUTH_BASE || 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: e.YOUTUBE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
      apiBase: e.YOUTUBE_API_BASE || 'https://www.googleapis.com',
      analyticsBase: e.YOUTUBE_ANALYTICS_BASE || 'https://youtubeanalytics.googleapis.com',
    },
  };
  for (const d of [cfg.mediaDir, cfg.backupDir, cfg.logDir]) fs.mkdirSync(d, { recursive: true });
  return cfg;
}

/** Names/values that must never appear in logs or responses. */
export function secretValues(cfg) {
  const v = [cfg.appSecret, cfg.setupToken, cfg.youtube.clientSecret, ...Object.values(cfg.keys)];
  return v.filter((x) => typeof x === 'string' && x.length >= 8);
}
