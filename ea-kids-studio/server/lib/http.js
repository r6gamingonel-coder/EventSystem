// HTTP helpers: security headers, JSON error handler, zod-based validation.
import { ZodError } from 'zod';
import { AppError } from './errors.js';

export function securityHeaders(_req, res, next) {
  res.set({
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cache-Control': 'no-store',
  });
  next();
}

/** Parse + validate with zod; throws a 400 AppError listing the offending fields. */
export function validate(schema, data) {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const issues = r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`);
  throw new AppError(400, 'VALIDATION_ERROR', `Invalid input — ${issues.join('; ')}`, { details: issues });
}

export function errorHandler(log) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    if (err instanceof ZodError) err = new AppError(400, 'VALIDATION_ERROR', err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    if (err.type === 'entity.too.large') err = new AppError(413, 'TOO_LARGE', 'Upload or request is too large.');
    if (err.type === 'entity.parse.failed') err = new AppError(400, 'BAD_JSON', 'Request body is not valid JSON.');
    const status = err.status || 500;
    if (status >= 500) log.error('request failed', { path: req.path, method: req.method, error: err.message, stack: String(err.stack).split('\n').slice(0, 4).join(' | ') });
    res.status(status).json({
      error: { code: err.code || 'INTERNAL', message: status >= 500 && !err.code ? 'Internal server error.' : err.message, hint: err.hint, details: err.details },
    });
  };
}
