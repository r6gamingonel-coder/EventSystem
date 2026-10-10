// Authentication & authorization: scrypt passwords, opaque session cookies (HttpOnly, SameSite=Strict),
// per-session CSRF tokens, login throttling and role → permission mapping.
import crypto from 'node:crypto';
import { now, audit } from '../db.js';
import { newId, sha256, hashPassword, verifyPassword, validatePasswordStrength, safeEqual } from '../lib/security.js';
import { AppError, badRequest, forbidden, unauthorized } from '../lib/errors.js';

export const ROLES = ['owner', 'editor', 'reviewer', 'viewer'];
const READ = ['read'];
const PERMS = {
  viewer: [...READ],
  reviewer: [...READ, 'review'],                                   // can approve/reject scenes + compliance
  editor: [...READ, 'review', 'write', 'generate', 'render'],      // day-to-day production
  owner: [...READ, 'review', 'write', 'generate', 'render', 'publish', 'admin', 'spend'],
};
export const can = (user, perm) => !!user && PERMS[user.role]?.includes(perm);

const COOKIE = 'eak_sid';
const attempts = new Map(); // ip|email -> {n, resetAt}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createAuth({ db, cfg }) {
  const publicUser = (u) => u && ({ id: u.id, email: u.email, name: u.name, role: u.role });

  function userCount() { return db.get('SELECT COUNT(*) c FROM users').c; }

  function createUser({ email, name = '', password, role = 'viewer' }) {
    if (!ROLES.includes(role)) throw badRequest('Unknown role.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) throw badRequest('A valid email is required.');
    validatePasswordStrength(password);
    const id = newId('u_');
    try {
      db.run('INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)', id, email.toLowerCase(), name, hashPassword(password), role, now());
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw new AppError(409, 'CONFLICT', 'A user with that email already exists.');
      throw e;
    }
    return db.get('SELECT * FROM users WHERE id = ?', id);
  }

  function throttle(key) {
    const t = Date.now();
    const e = attempts.get(key);
    if (e && e.resetAt > t && e.n >= 8) throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed sign-in attempts. Try again in a few minutes.');
    return e && e.resetAt > t ? e : { n: 0, resetAt: t + 15 * 60_000 };
  }

  function login(email, password, { ip, userAgent } = {}) {
    const key = `${ip}|${String(email).toLowerCase()}`;
    const rec = throttle(key);
    const u = db.get('SELECT * FROM users WHERE email = ? AND disabled = 0', String(email || '').toLowerCase());
    // Always run a hash to keep timing similar for unknown users.
    const ok = u ? verifyPassword(String(password || ''), u.password_hash) : (verifyPassword('x', hashPassword('y')), false);
    if (!ok) { rec.n += 1; attempts.set(key, rec); throw new AppError(401, 'BAD_CREDENTIALS', 'Incorrect email or password.'); }
    attempts.delete(key);
    const token = crypto.randomBytes(32).toString('base64url');
    const csrf = crypto.randomBytes(24).toString('base64url');
    const expires = new Date(Date.now() + cfg.sessionHours * 3600_000).toISOString();
    db.run('INSERT INTO sessions(id,user_id,csrf,created_at,expires_at,ip,user_agent) VALUES (?,?,?,?,?,?,?)', sha256(token), u.id, csrf, now(), expires, ip ?? null, (userAgent || '').slice(0, 200));
    audit(db, u.id, 'login', 'user', u.id);
    return { token, csrf, user: publicUser(u), expires };
  }

  function logout(token) { if (token) db.run('DELETE FROM sessions WHERE id = ?', sha256(token)); }

  function setCookie(res, token) {
    const maxAge = cfg.sessionHours * 3600;
    res.append('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${cfg.secureCookies ? '; Secure' : ''}`);
  }
  const clearCookie = (res) => res.append('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);

  /** Populate req.user / req.session when a valid session cookie is present. */
  function authenticate(req, _res, next) {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    if (token) {
      const s = db.get('SELECT s.*, u.email, u.name, u.role, u.disabled FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?', sha256(token));
      if (s && !s.disabled && s.expires_at > now()) {
        req.user = { id: s.user_id, email: s.email, name: s.name, role: s.role };
        req.session = { csrf: s.csrf, token };
      } else if (s) db.run('DELETE FROM sessions WHERE id = ?', s.id);
    }
    next();
  }

  const requireUser = (req, _res, next) => (req.user ? next() : next(unauthorized()));

  /** CSRF: state-changing requests need the per-session token header. SameSite=Strict is defence in depth. */
  function csrfGuard(req, _res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.session) return next();
    return safeEqual(req.get('x-csrf-token') || '', req.session.csrf) ? next() : next(forbidden('Missing or invalid CSRF token. Reload the page.'));
  }

  const requirePerm = (perm) => (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    return can(req.user, perm) ? next() : next(forbidden(`Your role (${req.user.role}) cannot perform "${perm}" actions.`));
  };

  return { publicUser, userCount, createUser, login, logout, setCookie, clearCookie, authenticate, requireUser, csrfGuard, requirePerm };
}
