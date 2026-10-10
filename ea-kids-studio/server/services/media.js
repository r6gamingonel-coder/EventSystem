// Asset store: files live under DATA_DIR/media (never served statically); rows live in `assets`.
// Every asset records HOW it was produced (media_type) and its licence, so the compliance
// checks can tell original, generated and third-party material apart.
import fs from 'node:fs';
import path from 'node:path';
import { now, j, parse } from '../db.js';
import { newId, sha256, safeJoin, sanitizeFilename, sniffMedia } from '../lib/security.js';
import { badRequest, notFound } from '../lib/errors.js';
import { probe } from '../media/ffmpeg.js';
import { sharp } from '../lib/imaging.js';

export const ORIGINAL_LICENSE = { source: 'EA KIDS original', license: 'Owned', commercialUse: true, attribution: '', proofUrl: '' };

export function createMedia({ db, cfg, log }) {
  const hydrate = (r) => r && ({ ...r, license: parse(r.license, {}), meta: parse(r.meta, {}) });

  /** Absolute directory for a project (created on demand). `sub` is one of a fixed allowlist. */
  function projectDir(projectId, sub = '') {
    if (!/^[A-Za-z0-9_-]+$/.test(projectId)) throw badRequest('Invalid project id.');
    if (sub && !['images', 'layers', 'audio', 'video', 'subs', 'thumbs', 'renders', 'tmp', 'music'].includes(sub)) throw badRequest('Invalid media folder.');
    const dir = safeJoin(cfg.mediaDir, 'projects', projectId, sub);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
  const libraryDir = (sub) => { const d = safeJoin(cfg.mediaDir, 'library', sub); fs.mkdirSync(d, { recursive: true }); return d; };
  const abs = (rel) => safeJoin(cfg.mediaDir, rel);
  const rel = (absPath) => path.relative(cfg.mediaDir, absPath);

  async function describeFile(file, kind, buf) {
    const out = { duration_ms: null, width: null, height: null };
    try {
      if (kind === 'image' || kind === 'thumbnail') { const m = await sharp(buf || file).metadata(); out.width = m.width; out.height = m.height; }
      else if (['audio', 'music', 'sfx', 'video', 'render', 'preview'].includes(kind)) {
        const p = await probe(cfg, file);
        out.duration_ms = Math.round(p.durationSec * 1000); out.width = p.width; out.height = p.height;
      }
    } catch (e) { log.warn('asset probe failed', { file: path.basename(file), error: e.message }); }
    return out;
  }

  /**
   * Store a new asset. `file` is an absolute path already inside DATA_DIR/media, or `buffer` to write at `relPath`.
   */
  async function create({ projectId = null, sceneId = null, characterId = null, kind, mediaType = 'other', relPath, buffer, mime, provider = 'local', license = ORIGINAL_LICENSE, meta = {}, reviewStatus = 'pending' }) {
    const absPath = abs(relPath);
    if (buffer) { fs.mkdirSync(path.dirname(absPath), { recursive: true }); fs.writeFileSync(absPath, buffer); }
    if (!fs.existsSync(absPath)) throw badRequest(`Asset file is missing: ${relPath}`);
    const stat = fs.statSync(absPath);
    const d = await describeFile(absPath, kind, buffer);
    const id = newId('as_');
    db.run(`INSERT INTO assets(id,project_id,scene_id,character_id,kind,media_type,path,filename,mime,bytes,duration_ms,width,height,sha256,provider,license,review_status,meta,created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, projectId, sceneId, characterId, kind, mediaType, relPath, path.basename(relPath), mime, stat.size, d.duration_ms, d.width, d.height, sha256(buffer || fs.readFileSync(absPath)), provider, j(license), reviewStatus, j(meta), now());
    return get(id);
  }

  const get = (id) => hydrate(db.get('SELECT * FROM assets WHERE id = ?', id));
  function list({ projectId, sceneId, kind, characterId, library } = {}) {
    const w = []; const p = [];
    if (projectId) { w.push('project_id = ?'); p.push(projectId); }
    if (library) w.push('project_id IS NULL');
    if (sceneId) { w.push('scene_id = ?'); p.push(sceneId); }
    if (kind) { w.push('kind = ?'); p.push(kind); }
    if (characterId) { w.push('character_id = ?'); p.push(characterId); }
    return db.all(`SELECT * FROM assets ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`, ...p).map(hydrate);
  }
  function remove(id) {
    const a = get(id); if (!a) throw notFound('Asset');
    try { fs.unlinkSync(abs(a.path)); } catch { /* already gone */ }
    db.run('DELETE FROM assets WHERE id = ?', id);
  }
  /** Replace-by-key: remove earlier assets of the same (project, scene, kind, key) so re-generation doesn't pile up. */
  function removeWhere(projectId, sceneId, kind, key) {
    for (const a of list({ projectId, sceneId, kind })) if (a.meta.key === key) remove(a.id);
  }
  function review(id, status, note = '') {
    if (!get(id)) throw notFound('Asset');
    db.run('UPDATE assets SET review_status = ?, review_note = ? WHERE id = ?', status, note.slice(0, 500), id);
    return get(id);
  }
  function setLicense(id, license) {
    if (!get(id)) throw notFound('Asset');
    db.run('UPDATE assets SET license = ? WHERE id = ?', j(license), id);
    return get(id);
  }

  /** Validate + store a user upload. Type comes from magic bytes, never the filename or Content-Type. */
  async function importUpload({ projectId, sceneId, characterId, buffer, filename, kindHint, license }) {
    if (!buffer?.length) throw badRequest('Empty upload.');
    if (buffer.length > cfg.maxUploadMb * 1024 * 1024) throw badRequest(`File exceeds the ${cfg.maxUploadMb} MB upload limit.`);
    const sniff = sniffMedia(buffer);
    if (!sniff) throw badRequest('Unsupported file type. Allowed: PNG, JPEG, WebP, WAV, MP3, OGG, MP4, WebM, VTT.', { hint: 'Convert the file first (e.g. with FFmpeg).' });
    const kind = sniff.kind === 'audio' ? (kindHint === 'music' ? 'music' : kindHint === 'sfx' ? 'sfx' : 'audio') : sniff.kind;
    const mediaType = { image: 'imported_image', video: 'imported_video', audio: 'imported_audio', subtitle: 'other' }[sniff.kind] || 'other';
    const safeName = sanitizeFilename(filename, `upload.${sniff.ext}`).replace(/\.[^.]*$/, '') + `.${sniff.ext}`;
    const sub = kind === 'image' ? 'images' : kind === 'video' ? 'video' : kind === 'subtitle' ? 'subs' : kind === 'music' ? 'music' : 'audio';
    const dir = projectId ? projectDir(projectId, sub) : libraryDir(sub);
    const file = path.join(dir, `${newId('up_')}-${safeName}`);
    const lic = { source: license?.source || '', license: license?.license || '', commercialUse: license?.commercialUse ?? null, attribution: license?.attribution || '', proofUrl: license?.proofUrl || '' };
    return create({ projectId, sceneId, characterId, kind, mediaType, relPath: rel(file), buffer, mime: sniff.mime, provider: 'upload', license: lic, meta: { originalName: String(filename || '').slice(0, 120), key: null } });
  }

  const totalBytes = (projectId) => db.get('SELECT COALESCE(SUM(bytes),0) b FROM assets WHERE project_id = ?', projectId).b;
  return { projectDir, libraryDir, abs, rel, create, get, list, remove, removeWhere, review, setLicense, importUpload, totalBytes };
}
