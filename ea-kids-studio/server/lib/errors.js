// Errors that carry an HTTP status, a stable machine code and an actionable hint for the UI.
export class AppError extends Error {
  constructor(status, code, message, { hint, details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.details = details;
  }
}
export const badRequest = (msg, o) => new AppError(400, 'BAD_REQUEST', msg, o);
export const unauthorized = (msg = 'Sign in required.') => new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'You do not have permission for this action.') => new AppError(403, 'FORBIDDEN', msg);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (msg, o) => new AppError(409, 'CONFLICT', msg, o);

/** A provider/tool is not configured: tell the user exactly what to set. Never a fake success. */
export const notConfigured = (what, hint) => new AppError(412, 'NOT_CONFIGURED', `${what} is not configured.`, { hint });

/** Paid operation attempted without explicit confirmation or beyond limits. */
export const confirmationRequired = (msg, details) =>
  new AppError(402, 'CONFIRMATION_REQUIRED', msg, { details, hint: 'Review the estimate, then resubmit with confirmCost set to the estimated amount.' });

/** Transient failures a job may retry (network, 429, 5xx, ffmpeg crash). */
export class RetryableError extends Error {
  constructor(message, { cause } = {}) { super(message); this.retryable = true; this.cause = cause; }
}
