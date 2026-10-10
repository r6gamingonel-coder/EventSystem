// DOM helpers, toasts, modals, job tracking and the paid-operation confirmation flow.
import { get, post, ApiError } from './api.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected' || k === 'open') el[k] = !!v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = (c) => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c.nodeType ? c : document.createTextNode(String(c))); };
  kids.forEach(add);
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const clear = (el) => { el.replaceChildren(); return el; };

// ---- formatting ----
export const fmtBytes = (n) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n > 1e3 ? `${(n / 1e3).toFixed(0)} KB` : `${n || 0} B`);
export const fmtDur = (s) => { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
export const usd = (n, d = 2) => `$${Number(n || 0).toFixed(d)}`;
export const num = (n) => Number(n || 0).toLocaleString();

export const badge = (text, kind = 'neutral') => h('span', { class: `badge ${kind}` }, text);
export const statusBadge = (s) => badge(s, { succeeded: 'ok', approved: 'ok', pass: 'ok', fresh: 'ok', rendered: 'ok', uploaded: 'ok', published: 'ok', running: 'info', queued: 'neutral', pending: 'neutral', uploading: 'info', failed: 'bad', rejected: 'bad', fail: 'bad', missing: 'bad', stale: 'warn', warn: 'warn', cancelled: 'warn', draft: 'neutral', scripted: 'info', scheduled: 'info', dryrun: 'neutral' }[s] || 'neutral');
export const progressBar = (p) => h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': Math.round(p * 100) }, h('i', { style: { width: `${Math.round(p * 100)}%` } }));
export const empty = (icon, title, sub, ...actions) => h('div', { class: 'empty' }, h('div', { class: 'big' }, icon), h('h3', {}, title), sub && h('p', {}, sub), h('div', { class: 'row', style: { justifyContent: 'center' } }, ...actions));
export const field = (label, input, hint) => h('label', { class: 'field' }, h('span', {}, label), input, hint && h('div', { class: 'hint' }, hint));
export const select = (options, value, props = {}) => h('select', props, options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(v) === String(value) }, l); }));

// ---- toasts ----
export function toast(msg, kind = 'info', hint) {
  const t = h('div', { class: `toast ${kind}`, role: 'status' }, msg, hint && h('small', {}, hint));
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 9000 : 4500);
}
export const fail = (e) => { console.error(e); toast(e.message || String(e), 'bad', e.hint); };

// ---- modal ----
export function modal(build, { wide = false, title } = {}) {
  const root = document.getElementById('modal-root');
  const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } });
  const box = h('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' });
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  box.append(...[].concat(build(close)));
  bg.append(box); root.append(bg);
  box.querySelector('input,textarea,select,button')?.focus();
  return close;
}
export const confirmDialog = (title, body, { ok = 'Confirm', danger = false } = {}) => new Promise((res) => {
  let done = false; const fin = (v, close) => { if (!done) { done = true; close(); res(v); } };
  modal((close) => [h('h2', {}, title), h('div', {}, body), h('div', { class: 'row', style: { marginTop: '16px', justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: () => fin(false, close) }, 'Cancel'), h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => fin(true, close) }, ok))]);
});

/**
 * Runs `fn(confirmCost)`. If the server says the operation costs money, shows the estimate and only retries
 * after explicit confirmation. Never purchases anything by itself.
 */
export async function withCost(fn) {
  try { return await fn(undefined); } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.code === 'SPENDING_LIMIT_NOT_SET') {
      modal((close) => [h('h2', {}, '🔒 Paid providers are blocked'), h('p', {}, e.message), h('p', { class: 'muted' }, e.hint), h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: close }, 'Close'), h('a', { class: 'btn primary', href: '#/costs', onclick: close }, 'Set a spending limit'))]);
      return null;
    }
    if (e.code === 'CONFIRMATION_REQUIRED') {
      const d = e.details || {};
      const ok = await confirmDialog('💳 This will cost money', h('div', { class: 'stack' }, h('p', {}, e.message), h('dl', { class: 'kv' }, h('dt', {}, 'Estimated cost'), h('dd', {}, h('b', {}, usd(d.estimateUsd, 4))), h('dt', {}, 'Price source'), h('dd', {}, d.verified ? badge('verified', 'ok') : badge('NOT verified — check the provider', 'warn'), ' ', h('span', { class: 'small muted' }, d.source || '')), h('dt', {}, 'Details'), h('dd', {}, h('span', { class: 'small' }, JSON.stringify(d.breakdown || {})))), h('p', { class: 'small muted' }, 'Nothing is charged by EA KIDS Studio itself; this is the provider\'s usage fee on your account. Estimates can differ from the final bill.')), { ok: `Confirm ${usd(d.estimateUsd, 4)}` });
      if (!ok) return null;
      return fn(d.estimateUsd);
    }
    throw e;
  }
}

// ---- jobs ----
const active = new Map();
export const activeJobs = () => [...active.values()];
/** Polls a job until it finishes. onUpdate(job, logs) is called on every poll. Resolves with the final job. */
export function trackJob(jobId, { onUpdate, label } = {}) {
  return new Promise((resolve) => {
    let after = 0; const logs = [];
    active.set(jobId, { id: jobId, label: label || 'Job', progress: 0, message: 'Queued' });
    window.dispatchEvent(new CustomEvent('jobs-changed'));
    const tick = async () => {
      try {
        const { job, logs: l } = await get(`/api/jobs/${jobId}?after=${after}`);
        l.forEach((x) => { logs.push(x); after = Math.max(after, x.id); });
        active.set(jobId, { id: jobId, label: label || job.type, progress: job.progress, message: job.message, status: job.status });
        onUpdate?.(job, logs);
        window.dispatchEvent(new CustomEvent('jobs-changed'));
        if (['succeeded', 'failed', 'cancelled'].includes(job.status)) {
          setTimeout(() => { active.delete(jobId); window.dispatchEvent(new CustomEvent('jobs-changed')); }, 4000);
          if (job.status === 'failed') toast(`${label || job.type} failed: ${job.error?.message || job.message}`, 'bad', job.error?.hint);
          else if (job.status === 'succeeded') toast(`${label || job.type} finished`, 'ok');
          return resolve(job);
        }
      } catch (e) { if (e.status === 401) return resolve(null); }
      setTimeout(tick, 800);
    };
    tick();
  });
}

/** Inline job panel: progress bar + live log. Returns {node, track}. */
export function jobPanel() {
  const bar = h('div'); const msg = h('div', { class: 'small muted' }); const log = h('div', { class: 'log', hidden: true });
  const node = h('div', { class: 'stack', hidden: true }, bar, msg, log);
  return {
    node,
    async track(jobId, label) {
      node.hidden = false; log.hidden = false;
      return trackJob(jobId, {
        label,
        onUpdate: (job, logs) => {
          bar.replaceChildren(progressBar(job.progress)); msg.textContent = `${job.status} — ${job.message || ''}`;
          log.replaceChildren(...logs.slice(-60).map((l) => h('div', { class: l.level }, `${new Date(l.ts).toLocaleTimeString()}  ${l.message}`))); log.scrollTop = log.scrollHeight;
        },
      });
    },
  };
}

export const needProject = (S, root, what = 'this section') => {
  if (S.project) return false;
  root.replaceChildren(empty('🎬', 'Pick or create a project first', `${what} works on one video project at a time.`, h('button', { class: 'btn primary', onclick: () => window.dispatchEvent(new CustomEvent('new-project')) }, '＋ New project'), h('a', { class: 'btn', href: '#/script' }, 'Open the script generator')));
  return true;
};

/** Small SVG line/bar chart (no external libs). */
export function lineChart(points, { color = '#3FA9F5', label = '' } = {}) {
  const W = 600; const H = 190; const pad = 28;
  if (!points.length) return h('div', { class: 'empty small' }, 'No data');
  const max = Math.max(...points.map((p) => p.y), 1);
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, points.length - 1); const y = (v) => H - pad - (v / max) * (H - 2 * pad);
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'chart'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label);
  const el = (n, a, t) => { const e = document.createElementNS(NS, n); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); if (t != null) e.textContent = t; svg.append(e); return e; };
  el('line', { x1: pad, y1: H - pad, x2: W - pad, y2: H - pad, stroke: '#E8E1CF' });
  el('text', { x: 4, y: 12 }, num(Math.round(max))); el('text', { x: pad, y: H - 8 }, points[0].x); el('text', { x: W - pad, y: H - 8, 'text-anchor': 'end' }, points.at(-1).x);
  el('polyline', { points: points.map((p, i) => `${x(i)},${y(p.y)}`).join(' '), fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linejoin': 'round' });
  points.forEach((p, i) => { const c = el('circle', { cx: x(i), cy: y(p.y), r: 3.5, fill: color }); const t = document.createElementNS(NS, 'title'); t.textContent = `${p.x}: ${num(p.y)}`; c.append(t); });
  return svg;
}
