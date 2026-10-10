// Thin fetch wrapper: JSON in/out, CSRF header, structured errors (message + hint) the UI can show.
let csrf = null;
export const setCsrf = (v) => { csrf = v; };

export class ApiError extends Error {
  constructor(status, body) {
    const e = body?.error || {};
    super(e.message || `Request failed (${status})`);
    this.status = status; this.code = e.code || 'ERROR'; this.hint = e.hint; this.details = e.details;
  }
}

export async function api(method, url, body, { raw = false, headers = {}, text = false } = {}) {
  const init = { method, headers: { ...(csrf ? { 'x-csrf-token': csrf } : {}), ...headers }, credentials: 'same-origin' };
  if (body !== undefined) { if (raw) init.body = body; else { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); } }
  let res;
  try { res = await fetch(url, init); } catch { throw new ApiError(0, { error: { code: 'NETWORK', message: 'Cannot reach the studio server.', hint: 'Is `npm start` still running?' } }); }
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => ({})) : (text || ct.startsWith('text/') ? await res.text() : await res.blob());
  if (!res.ok) {
    if (res.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/status')) window.dispatchEvent(new CustomEvent('auth-lost'));
    throw new ApiError(res.status, typeof data === 'object' && !(data instanceof Blob) ? data : {});
  }
  return data;
}
export const get = (u, o) => api('GET', u, undefined, o);
export const post = (u, b = {}, o) => api('POST', u, b, o);
export const put = (u, b, o) => api('PUT', u, b, o);
export const patch = (u, b, o) => api('PATCH', u, b, o);
export const del = (u, o) => api('DELETE', u, undefined, o);
export const upload = (url, file, o) => api('POST', url, file, { raw: true, headers: { 'content-type': 'application/octet-stream' }, ...o });
