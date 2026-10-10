// Security primitives: ids, password hashing, secret encryption, safe paths, file sniffing.
import crypto from 'node:crypto';
import path from 'node:path';
import { badRequest } from './errors.js';

export const newId = (prefix = '') => `${prefix}${crypto.randomBytes(9).toString('base64url')}`;
export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ---- passwords (scrypt; no native deps) ----
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export function verifyPassword(password, stored) {
  try {
    const [alg, N, r, p, saltB64, hashB64] = stored.split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}
export function validatePasswordStrength(pw) {
  if (typeof pw !== 'string' || pw.length < 10) throw badRequest('Password must be at least 10 characters.');
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw badRequest('Password must contain letters and numbers.');
}

// ---- encryption at rest for OAuth tokens (AES-256-GCM, key derived from APP_SECRET) ----
const key = (secret) => crypto.createHash('sha256').update(`eakids:v1:${secret}`).digest();
export function encryptSecret(plain, secret) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(secret), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}
export function decryptSecret(token, secret) {
  const [v, iv, tag, data] = String(token).split('.');
  if (v !== 'v1') throw new Error('Unsupported secret format');
  const d = crypto.createDecipheriv('aes-256-gcm', key(secret), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}

export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// ---- filesystem safety ----
/** Resolve `rel` under `base`, refusing traversal, absolute paths and NUL bytes. */
export function safeJoin(base, ...parts) {
  const rel = path.join(...parts);
  if (rel.includes('\0') || path.isAbsolute(rel)) throw badRequest('Invalid path.');
  const full = path.resolve(base, rel);
  const root = path.resolve(base);
  if (full !== root && !full.startsWith(root + path.sep)) throw badRequest('Path escapes the allowed directory.');
  return full;
}
export function sanitizeFilename(name, fallback = 'file') {
  const base = path.basename(String(name || '')).normalize('NFKC');
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]/gu, '_').replace(/\.{2,}/g, '.').replace(/^\.+/, '').slice(0, 120);
  return cleaned || fallback;
}
export const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

// ---- upload type allowlist, verified by magic bytes (never trust the extension/Content-Type) ----
export function sniffMedia(buf) {
  const b = buf;
  const ascii = (s, o = 0) => b.subarray(o, o + s.length).toString('latin1') === s;
  if (b.length >= 8 && b[0] === 0x89 && ascii('PNG', 1)) return { ext: 'png', mime: 'image/png', kind: 'image' };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg', kind: 'image' };
  if (ascii('RIFF') && ascii('WEBP', 8)) return { ext: 'webp', mime: 'image/webp', kind: 'image' };
  if (ascii('RIFF') && ascii('WAVE', 8)) return { ext: 'wav', mime: 'audio/wav', kind: 'audio' };
  if (ascii('ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: 'mp3', mime: 'audio/mpeg', kind: 'audio' };
  if (ascii('OggS')) return { ext: 'ogg', mime: 'audio/ogg', kind: 'audio' };
  if (ascii('ftyp', 4)) return { ext: 'mp4', mime: 'video/mp4', kind: 'video' };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: 'webm', mime: 'video/webm', kind: 'video' };
  const head = b.subarray(0, 512).toString('utf8').trimStart();
  if (head.startsWith('WEBVTT')) return { ext: 'vtt', mime: 'text/vtt', kind: 'subtitle' };
  return null;
}
