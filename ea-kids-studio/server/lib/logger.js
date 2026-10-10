// Structured JSON logs (one object per line) with secret redaction.
import fs from 'node:fs';
import path from 'node:path';

const PATTERNS = [
  /sk-[A-Za-z0-9_\-]{12,}/g,                 // Anthropic / OpenAI style keys
  /AIza[0-9A-Za-z_\-]{20,}/g,                // Google API keys
  /ya29\.[0-9A-Za-z_\-]{20,}/g,              // Google OAuth access tokens
  /1\/\/[0-9A-Za-z_\-]{20,}/g,               // Google refresh tokens
  /(Bearer\s+)[A-Za-z0-9._\-]{12,}/gi,
  /((?:api[_-]?key|secret|token|password|authorization)["'\s:=]+)[^\s"',}]{6,}/gi,
];

let extraSecrets = [];
export function registerSecrets(values) { extraSecrets = values.filter((v) => v && v.length >= 8); }

export function redact(input) {
  let s = typeof input === 'string' ? input : JSON.stringify(input);
  if (s === undefined) return '';
  for (const secret of extraSecrets) s = s.split(secret).join('[REDACTED]');
  for (const re of PATTERNS) s = s.replace(re, (m, p1) => (p1 ? `${p1}[REDACTED]` : '[REDACTED]'));
  return s;
}

export function createLogger({ dir, level = process.env.LOG_LEVEL || 'info', silent = process.env.NODE_ENV === 'test' } = {}) {
  const order = { debug: 10, info: 20, warn: 30, error: 40 };
  let stream = null;
  if (dir) {
    fs.mkdirSync(dir, { recursive: true });
    stream = fs.createWriteStream(path.join(dir, 'app.log'), { flags: 'a' });
  }
  const write = (lvl, msg, data) => {
    if (order[lvl] < order[level]) return;
    const line = redact({ ts: new Date().toISOString(), level: lvl, msg, ...(data ? { data } : {}) });
    stream?.write(line + '\n');
    if (!silent) (lvl === 'error' ? console.error : console.log)(line);
  };
  return {
    debug: (m, d) => write('debug', m, d),
    info: (m, d) => write('info', m, d),
    warn: (m, d) => write('warn', m, d),
    error: (m, d) => write('error', m, d),
    close: () => stream?.end(),
  };
}
