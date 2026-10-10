// Application factory. Builds the shared context (config, db, services) and the Express app.
import path from 'node:path';
import express from 'express';
import { buildConfig, secretValues, ROOT } from './config.js';
import { openDb, migrate } from './db.js';
import { createLogger, registerSecrets } from './lib/logger.js';
import { securityHeaders, errorHandler } from './lib/http.js';
import { createAuth } from './services/auth.js';
import { createJobs } from './services/jobs.js';
import { createCapabilities } from './services/capabilities.js';
import { registerServices } from './services/index.js';
import { mountRoutes } from './routes/index.js';

export async function createApp(overrides = {}) {
  const cfg = buildConfig(overrides);
  registerSecrets(secretValues(cfg));
  const log = createLogger({ dir: cfg.logDir });
  const db = openDb(cfg.dbFile);
  migrate(db, (m) => log.info(m));

  const ctx = { cfg, db, log };
  ctx.auth = createAuth(ctx);
  ctx.jobs = createJobs(ctx);
  ctx.caps = createCapabilities(ctx);
  registerServices(ctx); // domain services + job handlers

  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: '2mb' }));
  app.use(ctx.auth.authenticate);

  // Everything under /api (except status/login/setup) requires a session; mutations need CSRF.
  const open = new Set(['/auth/status', '/auth/login', '/auth/setup', '/health', '/youtube/oauth/callback']);
  app.use('/api', (req, res, next) => {
    if (open.has(req.path)) return next();
    return ctx.auth.requireUser(req, res, (e) => (e ? next(e) : ctx.auth.csrfGuard(req, res, next)));
  });
  app.get('/api/health', (_req, res) => res.json({ ok: true, version: '1.0.0' }));
  mountRoutes(app, ctx);

  // Static dashboard (no directory listing, no dotfiles). Media is served only through authenticated /api routes.
  app.use(express.static(path.join(ROOT, 'web'), { dotfiles: 'ignore', index: 'index.html', maxAge: 0 }));
  app.use('/fonts', express.static(cfg.fontsDir, { dotfiles: 'ignore', maxAge: '7d' })); // OFL fonts bundled with the app (public)
  app.use('/brand-assets', express.static(path.join(ROOT, 'brand', 'out'), { dotfiles: 'ignore' }));
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API route.' } }));
  app.use((_req, res) => res.sendFile(path.join(ROOT, 'web', 'index.html')));
  app.use(errorHandler(log));

  ctx.close = async () => { ctx.jobs.stop(); ctx.db.close(); log.close(); };
  return { app, ctx };
}

export function listen(app, cfg) {
  return new Promise((resolve) => { const s = app.listen(cfg.port, cfg.host, () => resolve(s)); });
}
