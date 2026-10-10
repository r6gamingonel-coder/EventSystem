import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../lib/http.js';
import { AppError, forbidden } from '../lib/errors.js';
import { safeEqual, verifyPassword, hashPassword, validatePasswordStrength, sha256 } from '../lib/security.js';
import { audit } from '../db.js';
import { ROLES, can } from '../services/auth.js';

// "This machine" only counts when the request really came straight from loopback. A request relayed by a reverse proxy
// (X-Forwarded-* headers) is remote even if the proxy sits on localhost — otherwise anyone could claim the owner account.
const loopback = (req) => ['::1', '127.0.0.1', '::ffff:127.0.0.1'].includes(req.ip || '') && !req.headers['x-forwarded-for'] && !req.headers.forwarded;

export default function authRoutes(ctx) {
  const { auth, db, cfg } = ctx;
  const r = Router();

  r.get('/status', (req, res) => {
    res.json({
      needsSetup: auth.userCount() === 0,
      user: req.user ?? null,
      csrf: req.session?.csrf ?? null,
      permissions: req.user ? ['read', 'review', 'write', 'generate', 'render', 'publish', 'admin', 'spend'].filter((p) => can(req.user, p)) : [],
    });
  });

  // First-run owner creation: only while no users exist, and only from this machine unless SETUP_TOKEN is supplied.
  r.post('/setup', (req, res) => {
    if (auth.userCount() > 0) throw new AppError(409, 'ALREADY_SETUP', 'An owner account already exists. Sign in instead.');
    const body = validate(z.object({ email: z.string(), name: z.string().max(80).optional(), password: z.string(), setupToken: z.string().optional() }), req.body);
    if (!loopback(req) || cfg.env === 'production') {
      if (!cfg.setupToken || !safeEqual(body.setupToken || '', cfg.setupToken)) {
        throw forbidden('First-run setup here requires SETUP_TOKEN (always required in production or when reached through a proxy). Set it in .env and supply it here, or run `npm run create-owner` on the server.');
      }
    }
    const u = auth.createUser({ email: body.email, name: body.name, password: body.password, role: 'owner' });
    audit(db, u.id, 'owner_created', 'user', u.id);
    res.status(201).json({ user: auth.publicUser(u) });
  });

  r.post('/login', (req, res) => {
    const { email, password } = validate(z.object({ email: z.string(), password: z.string() }), req.body);
    const s = auth.login(email, password, { ip: req.ip, userAgent: req.get('user-agent') });
    auth.setCookie(res, s.token);
    res.json({ user: s.user, csrf: s.csrf });
  });

  r.post('/logout', (req, res) => { auth.logout(req.session?.token); auth.clearCookie(res); res.json({ ok: true }); });

  r.post('/password', (req, res) => {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Sign in required.');
    const b = validate(z.object({ current: z.string(), next: z.string() }), req.body);
    const u = db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!verifyPassword(b.current, u.password_hash)) throw new AppError(400, 'BAD_CREDENTIALS', 'Current password is incorrect.');
    validatePasswordStrength(b.next);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(b.next), u.id);
    db.run('DELETE FROM sessions WHERE user_id = ? AND id != ?', u.id, sha256(req.session.token)); // sign out other devices
    audit(db, u.id, 'password_changed', 'user', u.id);
    res.json({ ok: true });
  });

  // ---- user management (owner only) ----
  r.get('/users', auth.requirePerm('admin'), (_req, res) => res.json({ users: db.all('SELECT id,email,name,role,disabled,created_at FROM users ORDER BY created_at') }));
  r.post('/users', auth.requirePerm('admin'), (req, res) => {
    const b = validate(z.object({ email: z.string(), name: z.string().max(80).optional(), password: z.string(), role: z.enum(ROLES) }), req.body);
    const u = auth.createUser(b);
    audit(db, req.user.id, 'user_created', 'user', u.id, { role: b.role });
    res.status(201).json({ user: auth.publicUser(u) });
  });
  r.patch('/users/:id', auth.requirePerm('admin'), (req, res) => {
    const b = validate(z.object({ role: z.enum(ROLES).optional(), disabled: z.boolean().optional() }), req.body);
    if (req.params.id === req.user.id && (b.disabled || (b.role && b.role !== 'owner'))) throw new AppError(400, 'BAD_REQUEST', 'You cannot demote or disable your own account.');
    if (b.role) db.run('UPDATE users SET role = ? WHERE id = ?', b.role, req.params.id);
    if (b.disabled !== undefined) { db.run('UPDATE users SET disabled = ? WHERE id = ?', b.disabled ? 1 : 0, req.params.id); if (b.disabled) db.run('DELETE FROM sessions WHERE user_id = ?', req.params.id); }
    audit(db, req.user.id, 'user_updated', 'user', req.params.id, b);
    res.json({ ok: true });
  });
  return r;
}
