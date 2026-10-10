// YouTube Data API / Analytics integration using the official OAuth 2.0 authorization-code flow (with PKCE).
// - Never asks for or stores a Google password.
// - Refresh/access tokens are encrypted at rest (AES-256-GCM, key from APP_SECRET).
// - Nothing is uploaded without a dry-run, passing compliance, and an explicit owner approval.
// - Everything stays functional without credentials (manual export workflow).
import crypto from 'node:crypto';
import fs from 'node:fs';
import { now, j, parse } from '../db.js';
import { newId, sha256, encryptSecret, decryptSecret } from '../lib/security.js';
import { AppError, RetryableError, notConfigured, forbidden } from '../lib/errors.js';

export const SCOPES = {
  upload: 'https://www.googleapis.com/auth/youtube.upload',
  read: 'https://www.googleapis.com/auth/youtube.readonly',
  manage: 'https://www.googleapis.com/auth/youtube',                    // playlists
  analytics: 'https://www.googleapis.com/auth/yt-analytics.readonly',
  revenue: 'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
};
const VIDEO_CATEGORY_EDUCATION = '27';

export function createYouTube(ctx) {
  const { cfg, db, projects, media, publishing, jobs, log } = ctx;
  const Y = cfg.youtube;
  const pending = new Map(); // oauth state -> {userId, verifier, scopes, exp}

  const configured = () => !!(Y.clientId && Y.clientSecret);
  const needConfig = () => { if (!configured()) throw notConfigured('YouTube API access', 'Create OAuth credentials in Google Cloud (see docs/GOOGLE_OAUTH_SETUP.md), then set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env and restart.'); };
  const account = () => db.get('SELECT * FROM youtube_accounts ORDER BY created_at DESC LIMIT 1');
  const enc = (v) => encryptSecret(v, cfg.appSecret);
  const dec = (v) => decryptSecret(v, cfg.appSecret);

  // ---------------------------------------------------------------- OAuth
  function status() {
    const a = account();
    return {
      configured: configured(), redirectUri: Y.redirectUri,
      connected: !!a?.refresh_token_enc, channel: a ? { id: a.channel_id, title: a.channel_title } : null, scopes: a ? a.scopes.split(' ').filter(Boolean) : [],
      availableScopes: Object.fromEntries(Object.entries(SCOPES).map(([k, v]) => [k, v])),
      setup: configured() ? null : 'Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env (docs/GOOGLE_OAUTH_SETUP.md). Without them, use the manual export workflow.',
    };
  }

  function authUrl(userId, scopeKeys = ['upload', 'read', 'analytics']) {
    needConfig();
    const scopes = [...new Set(scopeKeys.map((k) => SCOPES[k]).filter(Boolean))];
    if (!scopes.length) throw new AppError(400, 'BAD_SCOPES', 'Choose at least one permission.');
    const state = crypto.randomBytes(24).toString('base64url');
    const verifier = crypto.randomBytes(48).toString('base64url');
    pending.set(state, { userId, verifier, scopes, exp: Date.now() + 10 * 60_000 });
    for (const [k, v] of pending) if (v.exp < Date.now()) pending.delete(k);
    const q = new URLSearchParams({ client_id: Y.clientId, redirect_uri: Y.redirectUri, response_type: 'code', scope: scopes.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state, code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
    return `${Y.authBase}?${q}`;
  }

  async function tokenRequest(params) {
    let res;
    try { res = await fetch(Y.tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: Y.clientId, client_secret: Y.clientSecret, ...params }) }); }
    catch (e) { throw new RetryableError(`Google token endpoint unreachable: ${e.message}`); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new AppError(res.status >= 500 ? 502 : 400, body.error === 'invalid_grant' ? 'OAUTH_INVALID_GRANT' : 'OAUTH_ERROR', `Google rejected the authorization (${body.error || res.status}${body.error_description ? ': ' + body.error_description : ''}).`, { hint: body.error === 'invalid_grant' ? 'Reconnect your channel. If your OAuth app is in "Testing", refresh tokens expire after 7 days — publish the app or reconnect weekly.' : 'Check the client id/secret and the redirect URI in Google Cloud.' });
    return body;
  }

  async function handleCallback({ code, state, error }) {
    const p = pending.get(state); pending.delete(state);
    if (!p || p.exp < Date.now()) throw new AppError(400, 'OAUTH_STATE', 'This authorization link expired or was not started here. Start the connection again.');
    if (error) throw new AppError(400, 'OAUTH_DENIED', `Authorization was not granted (${error}).`);
    const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: Y.redirectUri, code_verifier: p.verifier });
    if (!t.refresh_token) throw new AppError(400, 'OAUTH_NO_REFRESH', 'Google did not return a refresh token.', { hint: 'Remove EA KIDS Studio at myaccount.google.com/permissions and connect again.' });
    const id = newId('yt_');
    db.run('DELETE FROM youtube_accounts');
    db.run('INSERT INTO youtube_accounts(id,scopes,refresh_token_enc,access_token_enc,expires_at,created_at) VALUES (?,?,?,?,?,?)', id, (t.scope || p.scopes.join(' ')), enc(t.refresh_token), enc(t.access_token), new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(), now());
    try { await refreshChannelInfo(); } catch (e) { log.warn('channel lookup failed after connect', { error: e.message }); }
    return status();
  }

  async function accessToken() {
    needConfig();
    const a = account();
    if (!a?.refresh_token_enc) throw new AppError(412, 'YOUTUBE_NOT_CONNECTED', 'No YouTube channel is connected.', { hint: 'Open YouTube → Connect channel.' });
    if (a.access_token_enc && a.expires_at > now()) return dec(a.access_token_enc);
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: dec(a.refresh_token_enc) });
    db.run('UPDATE youtube_accounts SET access_token_enc = ?, expires_at = ? WHERE id = ?', enc(t.access_token), new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(), a.id);
    return t.access_token;
  }

  async function disconnect() {
    const a = account();
    if (a?.refresh_token_enc) { try { await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: dec(a.refresh_token_enc) }) }); } catch { /* best effort */ } }
    db.run('DELETE FROM youtube_accounts');
  }

  /** Authenticated Google API call with one automatic token refresh and error classification. */
  async function api(path, { method = 'GET', base = Y.apiBase, body, headers = {}, raw = false, retried = false } = {}) {
    const token = await accessToken();
    let res;
    try { res = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, ...(body && !raw ? { 'content-type': 'application/json' } : {}), ...headers }, body: body && !raw ? JSON.stringify(body) : body }); }
    catch (e) { throw new RetryableError(`Network error calling Google: ${e.message}`); }
    if (res.status === 401 && !retried) { db.run('UPDATE youtube_accounts SET expires_at = ?', new Date(0).toISOString()); return api(path, { method, base, body, headers, raw, retried: true }); }
    if (!res.ok) {
      const err = await res.json().catch(() => ({})); const reason = err.error?.errors?.[0]?.reason || err.error?.status || res.status;
      if (res.status === 403 && /quota/i.test(String(reason))) throw new AppError(429, 'YOUTUBE_QUOTA', 'The YouTube API daily quota is exhausted.', { hint: 'Quota resets daily (Pacific time). Request more in Google Cloud → YouTube Data API v3 → Quotas.' });
      if (res.status === 403) throw new AppError(403, 'YOUTUBE_FORBIDDEN', `YouTube refused the request (${reason}).`, { hint: 'Check the granted permissions (reconnect with the needed scopes), that the YouTube Data API v3 is enabled, and that your account is verified.' });
      if (res.status === 429 || res.status >= 500) throw new RetryableError(`YouTube temporarily unavailable (${res.status})`);
      throw new AppError(res.status === 401 ? 401 : 502, 'YOUTUBE_ERROR', `YouTube error ${res.status}: ${err.error?.message || reason}`);
    }
    return res;
  }

  async function refreshChannelInfo() {
    const r = await api('/youtube/v3/channels?part=snippet,statistics&mine=true');
    const ch = (await r.json()).items?.[0];
    if (!ch) throw new AppError(404, 'NO_CHANNEL', 'The authorised Google account has no YouTube channel.', { hint: 'Create a channel for this account first.' });
    db.run('UPDATE youtube_accounts SET channel_id = ?, channel_title = ?', ch.id, ch.snippet.title);
    return { id: ch.id, title: ch.snippet.title, statistics: ch.statistics };
  }

  // ---------------------------------------------------------------- dry run & approval
  async function buildPayload(projectId, opts = {}) {
    const p = projects.must(projectId); const m = p.package.metadata;
    const render = media.list({ projectId, kind: 'render' }).find((a) => a.meta.key === 'final');
    const audience = (await publishing.evaluate(projectId)).review?.audience || {};
    const thumb = p.format === 'landscape' ? await publishing.exportThumbnail(projectId) : null;
    const privacy = opts.privacy || 'private';
    const payload = {
      snippet: { title: m.title, description: m.description, tags: m.tags, categoryId: VIDEO_CATEGORY_EDUCATION, defaultLanguage: m.language || p.language, defaultAudioLanguage: m.language || p.language },
      status: { privacyStatus: privacy, ...(opts.publishAt ? { publishAt: new Date(opts.publishAt).toISOString() } : {}), selfDeclaredMadeForKids: audience.madeForKids === true, embeddable: true, license: 'youtube', publicStatsViewable: true, ...(typeof opts.containsSyntheticMedia === 'boolean' ? { containsSyntheticMedia: opts.containsSyntheticMedia } : {}) },
    };
    if (payload.status.publishAt && privacy !== 'private') throw new AppError(400, 'BAD_SCHEDULE', 'Scheduled publishing requires privacyStatus "private" until the publish time.');
    if (payload.status.publishAt && new Date(payload.status.publishAt) <= new Date(Date.now() + 5 * 60_000)) throw new AppError(400, 'BAD_SCHEDULE', 'The scheduled time must be at least a few minutes in the future.');
    const file = render ? media.abs(render.path) : null;
    return {
      payload, project: { id: p.id, title: p.title }, playlist: opts.playlist || m.playlist || '', captionFiles: media.list({ projectId, kind: 'subtitle' }).map((a) => a.filename),
      video: render ? { assetId: render.id, filename: render.filename, bytes: render.bytes, durationSec: render.meta.durationSec, exists: !!file && fs.existsSync(file) } : null,
      thumbnail: thumb ? { bytes: thumb.bytes, mime: thumb.mime } : null,
      quotaNote: 'See docs: videos.insert quota cost differs between sources; check Google Cloud Console → Quotas.',
    };
  }

  async function dryRun(projectId, opts, user) {
    const plan = await buildPayload(projectId, opts);
    const ev = await publishing.evaluate(projectId);
    const problems = [];
    if (!plan.video) problems.push('No final render exists.'); else if (!plan.video.exists) problems.push('The rendered file is missing on disk.');
    if (!ev.approval.approved) problems.push(ev.approval.stale ? 'Compliance approval is out of date (content changed). Re-approve.' : 'Compliance review is not approved.');
    if (!configured()) problems.push('YouTube API credentials are not configured (manual export is still possible).');
    else if (!account()?.refresh_token_enc) problems.push('No YouTube channel is connected.');
    const id = newId('up_');
    db.run('INSERT INTO youtube_uploads(id,project_id,status,payload,total_bytes,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', id, projectId, 'dryrun', j({ ...plan, problems, requestedBy: user?.email, fingerprint: ev.fingerprint, payloadHash: sha256(JSON.stringify(plan.payload)).slice(0, 16) }), plan.video?.bytes || 0, now(), now());
    return { uploadId: id, ...plan, problems, wouldUpload: problems.length === 0, privacyNote: plan.payload.status.privacyStatus === 'public' ? 'PUBLIC: the video would be visible to everyone immediately after processing.' : `Privacy: ${plan.payload.status.privacyStatus}${plan.payload.status.publishAt ? `, scheduled for ${plan.payload.status.publishAt}` : ''}.` };
  }

  async function approveUpload(uploadId, { confirm, confirmPublic }, user) {
    if (user.role !== 'owner') throw forbidden('Only the owner can approve an upload.');
    const u = db.get('SELECT * FROM youtube_uploads WHERE id = ?', uploadId);
    if (!u || u.status !== 'dryrun') throw new AppError(404, 'NOT_FOUND', 'Dry-run not found (or already approved).');
    const pl = parse(u.payload);
    if (confirm !== 'UPLOAD') throw new AppError(400, 'CONFIRM_REQUIRED', 'Type UPLOAD to confirm.', { hint: 'Review the dry-run payload first.' });
    if (pl.payload.status.privacyStatus === 'public' && !confirmPublic) throw new AppError(400, 'CONFIRM_PUBLIC_REQUIRED', 'This video would be PUBLIC immediately. Tick "I understand this publishes the video".');
    const ev = await publishing.evaluate(u.project_id);
    if (!ev.approval.approved) throw new AppError(409, 'COMPLIANCE_NOT_APPROVED', 'Compliance approval is missing or stale.', { hint: 'Open Compliance, review, and approve again.' });
    if (ev.fingerprint !== pl.fingerprint) throw new AppError(409, 'CONTENT_CHANGED', 'The project changed after this dry-run. Run a new dry-run.');
    if (pl.problems.length) throw new AppError(409, 'DRYRUN_PROBLEMS', 'Resolve the dry-run problems first.', { details: pl.problems });
    db.run('UPDATE youtube_uploads SET status = ?, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?', 'approved', user.id, now(), now(), uploadId);
    const job = jobs.enqueue('youtube_upload', { projectId: u.project_id, payload: { uploadId }, createdBy: user.id, maxAttempts: 4 });
    return { job };
  }

  // ---------------------------------------------------------------- resumable upload
  async function resumableUpload({ uploadId, file, bytes, mime, metadata, signal, onProgress }) {
    const u = () => db.get('SELECT * FROM youtube_uploads WHERE id = ?', uploadId);
    let session = parse(u().response, {})?.sessionUriEnc ? dec(parse(u().response).sessionUriEnc) : null;
    const token = async () => accessToken();
    if (!session) {
      const r = await fetch(`${Y.apiBase}/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`, { method: 'POST', signal, headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-length': String(bytes), 'x-upload-content-type': mime }, body: JSON.stringify(metadata) }).catch((e) => { throw new RetryableError(`Network error starting upload: ${e.message}`); });
      if (!r.ok) {
        const err = await r.json().catch(() => ({})); const reason = err.error?.errors?.[0]?.reason || r.status;
        if (/quota/i.test(String(reason))) throw new AppError(429, 'YOUTUBE_QUOTA', 'The YouTube API quota is exhausted.', { hint: 'Wait for the daily reset or request more quota.' });
        if (r.status === 401) { db.run('UPDATE youtube_accounts SET expires_at = ?', new Date(0).toISOString()); throw new RetryableError('Access token expired; refreshing'); }
        if (r.status >= 500 || r.status === 429) throw new RetryableError(`YouTube unavailable (${r.status})`);
        throw new AppError(502, 'YOUTUBE_UPLOAD_REJECTED', `YouTube rejected the upload request: ${err.error?.message || reason}`, { hint: reason === 'forbidden' || r.status === 403 ? 'Reconnect with the upload permission and make sure the YouTube Data API v3 is enabled.' : undefined });
      }
      session = r.headers.get('location');
      if (!session) throw new AppError(502, 'YOUTUBE_NO_SESSION', 'YouTube did not return an upload session.');
      db.run('UPDATE youtube_uploads SET response = ?, status = ? WHERE id = ?', j({ sessionUriEnc: enc(session) }), 'uploading', uploadId);
    }
    // ask where we are (resume support), then send chunks
    let offset = 0;
    const probe = await fetch(session, { method: 'PUT', signal, headers: { 'content-length': '0', 'content-range': `bytes */${bytes}` } }).catch((e) => { throw new RetryableError(`Network error: ${e.message}`); });
    if (probe.status === 308) { const range = probe.headers.get('range'); offset = range ? Number(range.split('-')[1]) + 1 : 0; }
    else if (probe.status === 200 || probe.status === 201) return probe.json();
    else if (probe.status >= 500) throw new RetryableError(`YouTube unavailable (${probe.status})`);
    else if (probe.status === 404) { db.run('UPDATE youtube_uploads SET response = NULL WHERE id = ?', uploadId); throw new RetryableError('Upload session expired; starting a new one'); }
    const fd = fs.openSync(file, 'r');
    try {
      while (offset < bytes) {
        if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { cancelled: true });
        const len = Math.min(cfg.uploadChunkBytes, bytes - offset); const buf = Buffer.alloc(len); fs.readSync(fd, buf, 0, len, offset);
        const res = await fetch(session, { method: 'PUT', signal, headers: { 'content-length': String(len), 'content-range': `bytes ${offset}-${offset + len - 1}/${bytes}` }, body: buf }).catch((e) => { throw new RetryableError(`Network error during upload: ${e.message}`); });
        if (res.status === 308) { const range = res.headers.get('range'); offset = range ? Number(range.split('-')[1]) + 1 : offset + len; }
        else if (res.status === 200 || res.status === 201) { offset = bytes; onProgress(bytes); return res.json(); }
        else if (res.status >= 500 || res.status === 429) throw new RetryableError(`YouTube unavailable during upload (${res.status})`);
        else throw new AppError(502, 'YOUTUBE_UPLOAD_FAILED', `Upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
        db.run('UPDATE youtube_uploads SET uploaded_bytes = ?, updated_at = ? WHERE id = ?', offset, now(), uploadId);
        onProgress(offset);
      }
    } finally { fs.closeSync(fd); }
    throw new AppError(502, 'YOUTUBE_UPLOAD_INCOMPLETE', 'Upload ended without a response from YouTube.');
  }

  jobs.register('youtube_upload', async ({ job, signal, log: jlog, progress }) => {
    const { uploadId } = job.payload;
    const u = db.get('SELECT * FROM youtube_uploads WHERE id = ?', uploadId);
    if (!u || !['approved', 'uploading', 'failed'].includes(u.status)) throw new AppError(409, 'NOT_APPROVED', 'This upload has not been approved.');
    if (!u.approved_at) throw new AppError(409, 'NOT_APPROVED', 'This upload has not been approved by the owner.');
    const pl = parse(u.payload);
    const ev = await publishing.evaluate(u.project_id);
    if (!ev.approval.approved || ev.fingerprint !== pl.fingerprint) throw new AppError(409, 'CONTENT_CHANGED', 'Content or approval changed since approval; run a new dry-run.');
    const render = media.get(pl.video.assetId); const file = media.abs(render.path);
    if (!fs.existsSync(file)) throw new AppError(400, 'MISSING_MEDIA', 'The rendered video file is missing.');
    jlog('info', `Uploading ${render.filename} (${(render.bytes / 1e6).toFixed(1)} MB) as ${pl.payload.status.privacyStatus}`);
    db.run('UPDATE youtube_uploads SET status = ?, error = NULL, updated_at = ? WHERE id = ?', 'uploading', now(), uploadId);
    let video;
    try {
      video = await resumableUpload({ uploadId, file, bytes: render.bytes, mime: 'video/mp4', metadata: pl.payload, signal, onProgress: (n) => progress(0.05 + 0.85 * (n / render.bytes), `Uploaded ${(n / 1e6).toFixed(1)} / ${(render.bytes / 1e6).toFixed(1)} MB`) });
    } catch (e) {
      db.run('UPDATE youtube_uploads SET status = ?, error = ?, updated_at = ? WHERE id = ?', e.retryable ? 'uploading' : 'failed', e.message.slice(0, 500), now(), uploadId);
      throw e;
    }
    jlog('info', `YouTube accepted the video: ${video.id}`);
    const returnedPrivacy = video.status?.privacyStatus;
    if (returnedPrivacy && returnedPrivacy !== pl.payload.status.privacyStatus) jlog('warn', `YouTube set privacy to "${returnedPrivacy}" (requested "${pl.payload.status.privacyStatus}"). If the project is unverified, uploads may be locked to private until an API audit — or change it in YouTube Studio.`);
    const warnings = [];
    // thumbnail
    const th = pl.thumbnail ? await publishing.exportThumbnail(u.project_id) : null;
    if (th) {
      try { await api(`/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(video.id)}&uploadType=media`, { method: 'POST', raw: true, body: th.buffer, headers: { 'content-type': th.mime } }); jlog('info', 'Thumbnail set'); }
      catch (e) { warnings.push(`Thumbnail not set: ${e.message}`); jlog('warn', `Thumbnail not set: ${e.message}. Custom thumbnails need a verified channel; set it in YouTube Studio.`); }
    }
    // playlist
    if (pl.playlist) {
      try {
        let pls = ctx.db.get('SELECT * FROM playlists WHERE title = ?', pl.playlist);
        if (!pls) pls = publishing.playlists.create({ title: pl.playlist });
        if (!pls.youtube_id) {
          const made = await (await api('/youtube/v3/playlists?part=snippet,status', { method: 'POST', body: { snippet: { title: pls.title, description: pls.description || '' }, status: { privacyStatus: 'public' } } })).json();
          ctx.db.run('UPDATE playlists SET youtube_id = ? WHERE id = ?', made.id, pls.id); pls.youtube_id = made.id;
        }
        await api('/youtube/v3/playlistItems?part=snippet', { method: 'POST', body: { snippet: { playlistId: pls.youtube_id, resourceId: { kind: 'youtube#video', videoId: video.id } } } });
        jlog('info', `Added to playlist "${pls.title}"`);
      } catch (e) { warnings.push(`Playlist not updated: ${e.message}`); jlog('warn', `Playlist not updated: ${e.message}`); }
    }
    db.run('UPDATE youtube_uploads SET status = ?, video_id = ?, response = ?, uploaded_bytes = total_bytes, updated_at = ? WHERE id = ?', 'uploaded', video.id, j({ id: video.id, status: video.status, warnings }), now(), uploadId);
    const scheduled = !!pl.payload.status.publishAt; const pub = (returnedPrivacy || pl.payload.status.privacyStatus) === 'public';
    projects.setStatus(u.project_id, scheduled ? 'scheduled' : pub ? 'published' : 'approved');
    if (scheduled) db.run('UPDATE projects SET scheduled_at = ? WHERE id = ?', pl.payload.status.publishAt, u.project_id);
    return { videoId: video.id, privacy: returnedPrivacy, warnings, url: `https://www.youtube.com/watch?v=${video.id}` };
  }, { lane: 'io', maxAttempts: 4 });

  // ---------------------------------------------------------------- analytics
  const METRICS = ['views', 'estimatedMinutesWatched', 'averageViewDuration', 'averageViewPercentage', 'subscribersGained', 'subscribersLost', 'likes', 'comments', 'shares'];
  async function report(params) {
    const q = new URLSearchParams({ ids: 'channel==MINE', ...params });
    return (await api(`/v2/reports?${q}`, { base: Y.analyticsBase })).json();
  }
  /** Pulls real numbers from the YouTube Analytics API. Never fabricates data; revenue only when the scope was granted. */
  async function syncAnalytics({ days = 28 } = {}) {
    const a = account(); if (!a) throw new AppError(412, 'YOUTUBE_NOT_CONNECTED', 'Connect your channel first.');
    const scopes = a.scopes.split(' ');
    if (!scopes.includes(SCOPES.analytics)) throw new AppError(403, 'MISSING_SCOPE', 'The analytics permission was not granted.', { hint: 'Reconnect the channel and tick "Analytics".' });
    const end = new Date(Date.now() - 86400_000); const start = new Date(end.getTime() - days * 86400_000);
    const d = (x) => x.toISOString().slice(0, 10);
    const wantRevenue = scopes.includes(SCOPES.revenue);
    const metrics = [...METRICS, ...(wantRevenue ? ['estimatedRevenue'] : [])].join(',');
    let rows = 0;
    const store = (video, date, names, values) => names.forEach((n, i) => { if (values[i] == null) return; db.run("INSERT INTO analytics_rows(source,video_id,project_id,date,metric,value,imported_at) VALUES ('youtube_api',?,?,?,?,?,?) ON CONFLICT(source,video_id,date,metric) DO UPDATE SET value=excluded.value, imported_at=excluded.imported_at", video, projectForVideo(video), date, n, values[i], now()); rows++; });
    const chan = await report({ startDate: d(start), endDate: d(end), metrics, dimensions: 'day', sort: 'day' });
    const names = (chan.columnHeaders || []).map((h) => h.name);
    for (const r of chan.rows || []) store('', r[0], names.slice(1), r.slice(1));
    const vids = db.all("SELECT DISTINCT video_id FROM youtube_uploads WHERE video_id IS NOT NULL AND status = 'uploaded'").map((x) => x.video_id);
    for (const v of vids) {
      const vr = await report({ startDate: d(start), endDate: d(end), metrics, dimensions: 'day', filters: `video==${v}`, sort: 'day' });
      const vn = (vr.columnHeaders || []).map((h) => h.name);
      for (const r of vr.rows || []) store(v, r[0], vn.slice(1), r.slice(1));
      try { // retention curve (available for sufficiently viewed videos only)
        const rr = await report({ startDate: d(start), endDate: d(end), metrics: 'audienceWatchRatio', dimensions: 'elapsedVideoTimeRatio', filters: `video==${v}` });
        for (const r of rr.rows || []) store(v, 'retention', [`audienceWatchRatio@${r[0]}`], [r[1]]);
      } catch (e) { log.info('retention unavailable', { video: v, error: e.message }); }
    }
    return { rows, videos: vids.length, revenueIncluded: wantRevenue, period: [d(start), d(end)] };
  }
  const projectForVideo = (videoId) => (videoId ? db.get('SELECT project_id FROM youtube_uploads WHERE video_id = ?', videoId)?.project_id ?? null : null);

  jobs.register('youtube_analytics_sync', async ({ job }) => syncAnalytics(job.payload || {}), { lane: 'io', maxAttempts: 3 });

  return { status, configured, authUrl, handleCallback, disconnect, refreshChannelInfo, dryRun, approveUpload, syncAnalytics, buildPayload, api, listUploads: (projectId) => db.all(`SELECT * FROM youtube_uploads ${projectId ? 'WHERE project_id = ?' : ''} ORDER BY created_at DESC LIMIT 50`, ...(projectId ? [projectId] : [])).map((u) => ({ ...u, payload: parse(u.payload), response: u.response ? { ...parse(u.response), sessionUriEnc: undefined } : null })), SCOPES };
}
