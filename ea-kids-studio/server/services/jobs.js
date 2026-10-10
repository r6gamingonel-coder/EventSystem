// Persistent background job queue (SQLite-backed) with retries + exponential backoff,
// cancellation, restart recovery, per-lane concurrency and per-job logs.
import { now, j, parse } from '../db.js';
import { newId } from '../lib/security.js';
import { notFound, conflict } from '../lib/errors.js';

// Lanes limit concurrency so a heavy render never starves quick jobs (and vice versa).
const LANE_LIMITS = { render: 1, media: 2, llm: 2, io: 2 };

export function createJobs({ db, cfg, log }) {
  const handlers = new Map();   // type -> { fn, lane, maxAttempts }
  const running = new Map();    // jobId -> AbortController
  const waiters = new Map();    // jobId -> [resolve]
  let timer = null; let stopped = false; let ticking = false;
  const listeners = new Set();

  const hydrate = (r) => r && ({ ...r, payload: parse(r.payload, {}), result: parse(r.result), error: parse(r.error), cost_confirmed: !!r.cost_confirmed, cancel_requested: !!r.cancel_requested });

  function register(type, fn, { lane = 'io', maxAttempts = 3 } = {}) { handlers.set(type, { fn, lane, maxAttempts }); }

  function enqueue(type, { projectId = null, sceneId = null, payload = {}, createdBy = null, costEstimateUsd = 0, costConfirmed = false, maxAttempts, runAfter } = {}) {
    const h = handlers.get(type);
    if (!h) throw new Error(`Unknown job type: ${type}`);
    const id = newId('job_');
    db.run(`INSERT INTO jobs(id,type,project_id,scene_id,status,max_attempts,run_after,payload,cost_estimate_usd,cost_confirmed,created_by,created_at)
            VALUES (?,?,?,?, 'queued', ?,?,?,?,?,?,?)`,
      id, type, projectId, sceneId, maxAttempts ?? h.maxAttempts, runAfter ?? now(), j(payload), costEstimateUsd, costConfirmed ? 1 : 0, createdBy, now());
    logJob(id, projectId, 'info', `Job queued: ${type}`);
    kick();
    return get(id);
  }

  function logJob(jobId, projectId, level, message, data) {
    db.run('INSERT INTO job_logs(job_id,project_id,level,message,data,ts) VALUES (?,?,?,?,?,?)', jobId, projectId ?? null, level, String(message).slice(0, 2000), data ? j(data) : null, now());
  }

  const get = (id) => hydrate(db.get('SELECT * FROM jobs WHERE id = ?', id));
  function list({ projectId, status, limit = 100 } = {}) {
    const where = []; const p = [];
    if (projectId) { where.push('project_id = ?'); p.push(projectId); }
    if (status) { where.push('status = ?'); p.push(status); }
    return db.all(`SELECT * FROM jobs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT ?`, ...p, limit).map(hydrate);
  }
  const logs = (jobId, afterId = 0) => db.all('SELECT id, level, message, data, ts FROM job_logs WHERE job_id = ? AND id > ? ORDER BY id LIMIT 500', jobId, afterId).map((r) => ({ ...r, data: parse(r.data) }));
  const projectLogs = (projectId, limit = 200) => db.all('SELECT id, job_id, level, message, ts FROM job_logs WHERE project_id = ? ORDER BY id DESC LIMIT ?', projectId, limit).reverse();

  function cancel(id) {
    const job = get(id);
    if (!job) throw notFound('Job');
    if (['succeeded', 'failed', 'cancelled'].includes(job.status)) throw conflict(`Job already ${job.status}.`);
    db.run('UPDATE jobs SET cancel_requested = 1 WHERE id = ?', id);
    if (job.status === 'queued') finish(id, 'cancelled', { message: 'Cancelled before start' });
    else running.get(id)?.abort();
    return get(id);
  }

  function retry(id) {
    const job = get(id);
    if (!job) throw notFound('Job');
    if (!['failed', 'cancelled'].includes(job.status)) throw conflict('Only failed or cancelled jobs can be retried.');
    db.run("UPDATE jobs SET status='queued', attempts=0, cancel_requested=0, error=NULL, progress=0, message='Re-queued by user', run_after=?, finished_at=NULL WHERE id=?", now(), id);
    logJob(id, job.project_id, 'info', 'Re-queued by user');
    kick();
    return get(id);
  }

  function finish(id, status, { result, error, message } = {}) {
    db.run('UPDATE jobs SET status=?, result=?, error=?, message=COALESCE(?, message), progress=CASE WHEN ?=\'succeeded\' THEN 1 ELSE progress END, finished_at=? WHERE id=?',
      status, result === undefined ? null : j(result), error ? j(error) : null, message ?? null, status, now(), id);
    (waiters.get(id) || []).forEach((r) => r(get(id)));
    waiters.delete(id);
    listeners.forEach((l) => l(get(id)));
  }

  function waitFor(id, timeoutMs = 120_000) {
    const cur = get(id);
    if (cur && ['succeeded', 'failed', 'cancelled'].includes(cur.status)) return Promise.resolve(cur);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Timed out waiting for job ${id}`)), timeoutMs);
      waiters.set(id, [...(waiters.get(id) || []), (r) => { clearTimeout(t); resolve(r); }]);
    });
  }

  async function execute(job) {
    const h = handlers.get(job.type);
    const ac = new AbortController();
    running.set(job.id, ac);
    db.run("UPDATE jobs SET status='running', attempts=attempts+1, started_at=COALESCE(started_at, ?), message='Running' WHERE id=?", now(), job.id);
    const attempt = job.attempts + 1;
    logJob(job.id, job.project_id, 'info', `Started (attempt ${attempt}/${job.max_attempts})`);
    const ctx = {
      job: { ...job, attempts: attempt },
      signal: ac.signal,
      log: (level, message, data) => logJob(job.id, job.project_id, level, message, data),
      progress: (p, message) => db.run('UPDATE jobs SET progress=?, message=COALESCE(?, message) WHERE id=?', Math.max(0, Math.min(1, p)), message ?? null, job.id),
    };
    try {
      const result = await h.fn(ctx);
      if (ac.signal.aborted) throw Object.assign(new Error('Cancelled'), { cancelled: true });
      logJob(job.id, job.project_id, 'info', 'Completed');
      finish(job.id, 'succeeded', { result: result ?? {}, message: 'Done' });
    } catch (e) {
      if (e.cancelled || ac.signal.aborted) { logJob(job.id, job.project_id, 'warn', 'Cancelled'); finish(job.id, 'cancelled', { message: 'Cancelled' }); }
      else {
        const info = { message: e.message, code: e.code || e.name, hint: e.hint, details: e.details };
        const canRetry = (e.retryable || e.code === 'ECONNRESET') && attempt < job.max_attempts;
        if (canRetry) {
          const delay = cfg.jobRetryBaseMs * 2 ** (attempt - 1);
          logJob(job.id, job.project_id, 'warn', `Transient failure: ${e.message}. Retrying in ${Math.round(delay / 1000)}s`);
          db.run("UPDATE jobs SET status='queued', run_after=?, message=? WHERE id=?", new Date(Date.now() + delay).toISOString(), `Retrying: ${e.message}`.slice(0, 300), job.id);
        } else {
          logJob(job.id, job.project_id, 'error', e.message, { code: info.code, hint: info.hint });
          log.error('job failed', { id: job.id, type: job.type, error: e.message });
          finish(job.id, 'failed', { error: info, message: e.message.slice(0, 300) });
        }
      }
    } finally { running.delete(job.id); kick(); }
  }

  function tick() {
    if (ticking || stopped) return;
    ticking = true;
    try {
      const counts = {};
      for (const id of running.keys()) { const t = get(id)?.type; const lane = handlers.get(t)?.lane; counts[lane] = (counts[lane] || 0) + 1; }
      const due = db.all("SELECT * FROM jobs WHERE status='queued' AND run_after <= ? ORDER BY created_at LIMIT 50", now());
      for (const row of due) {
        const h = handlers.get(row.type);
        if (!h) continue;
        if ((counts[h.lane] || 0) >= (LANE_LIMITS[h.lane] ?? 1)) continue;
        counts[h.lane] = (counts[h.lane] || 0) + 1;
        execute(hydrate(row));
      }
    } finally { ticking = false; }
  }

  function kick() { if (!stopped) setImmediate(tick); }

  function start() {
    stopped = false;
    // Jobs left "running" by a crash/restart are re-queued; the attempt counter bounds loops.
    const orphaned = db.run("UPDATE jobs SET status='queued', message='Recovered after restart' WHERE status='running'");
    if (orphaned.changes) log.warn('recovered interrupted jobs', { count: orphaned.changes });
    timer = setInterval(tick, cfg.jobPollMs);
    timer.unref?.();
    kick();
  }
  function stop() { stopped = true; clearInterval(timer); for (const ac of running.values()) ac.abort(); }
  const onFinish = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

  return { register, enqueue, get, list, logs, projectLogs, cancel, retry, waitFor, start, stop, logJob, onFinish, hasHandler: (t) => handlers.has(t) };
}
