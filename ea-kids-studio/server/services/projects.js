// Projects: metadata + working-copy package + immutable version snapshots.
// Scene-level operations never regenerate the whole project; destructive operations snapshot first.
import { now, j, parse, audit } from '../db.js';
import { newId } from '../lib/security.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { normalizePackage, normalizeScene, totalDuration, scriptText } from '../content/schema.js';

export function createProjects({ db, media }) {
  // Always hand out a fully-formed package (a brand-new project stores '{}').
  const pkgOf = (r) => { const p = parse(r.package, {}); return p.schemaVersion ? p : normalizePackage(p, { title: r.title, language: r.language, format: r.format, category: r.category }); };
  const hydrate = (r) => r && ({ ...r, package: pkgOf(r) });
  const brief = (r) => ({ ...r, package: undefined, sceneCount: pkgOf(r).scenes.length, durationSec: Math.round(totalDuration(pkgOf(r))) });

  function create(b, userId) {
    const id = newId('pr_');
    db.run(`INSERT INTO projects(id,title,category,language,age_min,age_max,target_duration_sec,topic,visual_style,narration_style,difficulty,format,status,package,created_by,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'draft', '{}', ?,?,?)`,
      id, b.title, b.category, b.language ?? 'ar', b.ageMin ?? 3, b.ageMax ?? 6, b.targetDurationSec ?? (b.format === 'shorts' ? 45 : 90), b.topic ?? '', b.visualStyle ?? 'flat-friendly', b.narrationStyle ?? 'warm-teacher', b.difficulty ?? 'easy', b.format ?? 'landscape', userId ?? null, now(), now());
    audit(db, userId, 'project_created', 'project', id, { title: b.title });
    return get(id);
  }
  const get = (id) => hydrate(db.get('SELECT * FROM projects WHERE id = ?', id));
  function must(id) { const p = get(id); if (!p) throw notFound('Project'); return p; }
  function list({ status, category, q } = {}) {
    const w = []; const p = [];
    if (status) { w.push('status = ?'); p.push(status); }
    if (category) { w.push('category = ?'); p.push(category); }
    if (q) { w.push('title LIKE ?'); p.push(`%${q}%`); }
    return db.all(`SELECT * FROM projects ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY updated_at DESC LIMIT 300`, ...p).map(brief);
  }

  function updateMeta(id, patch) {
    const p = must(id);
    const map = { title: 'title', category: 'category', language: 'language', ageMin: 'age_min', ageMax: 'age_max', targetDurationSec: 'target_duration_sec', topic: 'topic', visualStyle: 'visual_style', narrationStyle: 'narration_style', difficulty: 'difficulty', format: 'format', scheduledAt: 'scheduled_at' };
    const sets = []; const vals = [];
    for (const [k, col] of Object.entries(map)) if (patch[k] !== undefined) { sets.push(`${col} = ?`); vals.push(patch[k]); }
    if (!sets.length) return p;
    db.run(`UPDATE projects SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, ...vals, now(), id);
    return get(id);
  }
  const setStatus = (id, status) => db.run('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?', status, now(), id);

  function remove(id) {
    must(id);
    for (const a of media.list({ projectId: id })) media.remove(a.id);
    db.run('DELETE FROM projects WHERE id = ?', id);
  }

  // ---------------------------------------------------------------- versions
  function snapshot(id, label = '', userId = null) {
    const p = must(id);
    const next = (db.get('SELECT COALESCE(MAX(version_no),0) n FROM project_versions WHERE project_id = ?', id).n) + 1;
    db.run('INSERT INTO project_versions(id,project_id,version_no,label,snapshot,created_by,created_at) VALUES (?,?,?,?,?,?,?)', newId('v_'), id, next, label.slice(0, 120), j(p.package), userId, now());
    db.run('UPDATE projects SET current_version = ? WHERE id = ?', next, id);
    return next;
  }
  const listVersions = (id) => db.all('SELECT version_no, label, created_by, created_at, LENGTH(snapshot) AS bytes FROM project_versions WHERE project_id = ? ORDER BY version_no DESC', id);
  function getVersion(id, no) {
    const v = db.get('SELECT * FROM project_versions WHERE project_id = ? AND version_no = ?', id, no);
    if (!v) throw notFound('Version');
    return { ...v, snapshot: parse(v.snapshot, {}) };
  }
  /** Non-destructive restore: the current state is snapshotted first, and the restore itself becomes a new version. */
  function restore(id, no, userId) {
    const v = getVersion(id, no);
    snapshot(id, `Before restoring v${no}`, userId);
    db.run('UPDATE projects SET package = ?, updated_at = ? WHERE id = ?', j(normalizePackage(v.snapshot)), now(), id);
    const n = snapshot(id, `Restored from v${no}`, userId);
    audit(db, userId, 'version_restored', 'project', id, { from: no, to: n });
    return get(id);
  }
  function diffVersions(id, a, b) {
    const A = getVersion(id, a).snapshot; const B = b === 'current' ? must(id).package : getVersion(id, Number(b)).snapshot;
    const mapA = new Map((A.scenes || []).map((s) => [s.id, s])); const mapB = new Map((B.scenes || []).map((s) => [s.id, s]));
    return {
      added: [...mapB.keys()].filter((k) => !mapA.has(k)).map((k) => mapB.get(k).title),
      removed: [...mapA.keys()].filter((k) => !mapB.has(k)).map((k) => mapA.get(k).title),
      changed: [...mapB.keys()].filter((k) => mapA.has(k) && JSON.stringify(mapA.get(k)) !== JSON.stringify(mapB.get(k))).map((k) => ({ id: k, title: mapB.get(k).title, narrationChanged: mapA.get(k).narration !== mapB.get(k).narration })),
    };
  }

  // ---------------------------------------------------------------- package
  function savePackage(id, pkg, { label, userId, snap = false } = {}) {
    const p = must(id);
    const norm = normalizePackage(pkg, p.package.meta);
    db.run('UPDATE projects SET package = ?, status = CASE WHEN status = ? THEN ? ELSE status END, updated_at = ? WHERE id = ?', j(norm), 'draft', norm.scenes.length ? 'scripted' : 'draft', now(), id);
    if (snap) snapshot(id, label || 'Saved', userId);
    return get(id);
  }

  function mutateScenes(id, fn, { snapLabel, userId } = {}) {
    const p = must(id);
    if (snapLabel) snapshot(id, snapLabel, userId);
    const pkg = structuredClone(p.package);
    const out = fn(pkg);
    pkg.scenes = pkg.scenes.map((s, i) => ({ ...s, index: i }));
    db.run('UPDATE projects SET package = ?, updated_at = ? WHERE id = ?', j(pkg), now(), id);
    return { project: get(id), result: out };
  }
  const sceneOf = (pkg, sceneId) => { const s = pkg.scenes.find((x) => x.id === sceneId); if (!s) throw notFound('Scene'); return s; };

  function updateScene(id, sceneId, patch, userId) {
    return mutateScenes(id, (pkg) => {
      const cur = sceneOf(pkg, sceneId);
      // Narration changes drop hand-edited subtitles so they are re-derived from the new text.
      const narrationChanged = patch.narration !== undefined && patch.narration !== cur.narration;
      const merged = { ...cur, ...patch, visual: patch.visual ? { ...cur.visual, ...patch.visual } : cur.visual, camera: { ...cur.camera, ...(patch.camera || {}) }, audio: { ...cur.audio, ...(patch.audio || {}) }, review: patch.review ? { ...cur.review, ...patch.review } : (narrationChanged || patch.visual ? { status: 'pending', note: '' } : cur.review) };
      if (narrationChanged && patch.subtitles === undefined) merged.subtitles = [];
      if (patch.durationSec !== undefined && patch.durationMode === undefined) merged.durationMode = 'manual';
      const norm = normalizeScene(merged, cur.index);
      pkg.scenes[pkg.scenes.findIndex((s) => s.id === sceneId)] = norm;
      return norm;
    }).result;
  }
  const addScene = (id, scene, afterId, userId) => mutateScenes(id, (pkg) => {
    const norm = normalizeScene({ ...scene, id: undefined }, pkg.scenes.length);
    const at = afterId ? pkg.scenes.findIndex((s) => s.id === afterId) + 1 : pkg.scenes.length;
    pkg.scenes.splice(at, 0, norm); return norm;
  }, { snapLabel: 'Before adding a scene', userId }).result;
  const duplicateScene = (id, sceneId, userId) => mutateScenes(id, (pkg) => {
    const cur = sceneOf(pkg, sceneId); const copy = normalizeScene({ ...structuredClone(cur), id: undefined, title: `${cur.title} (copy)`, review: { status: 'pending' } }, 0);
    pkg.scenes.splice(pkg.scenes.findIndex((s) => s.id === sceneId) + 1, 0, copy); return copy;
  }, { userId }).result;
  const deleteScene = (id, sceneId, userId) => {
    const p = must(id);
    if (p.package.scenes.length <= 1) throw conflict('A project needs at least one scene.');
    mutateScenes(id, (pkg) => { sceneOf(pkg, sceneId); pkg.scenes = pkg.scenes.filter((s) => s.id !== sceneId); }, { snapLabel: 'Before deleting a scene', userId });
    for (const a of media.list({ projectId: id, sceneId })) media.remove(a.id);
  };
  const moveScene = (id, sceneId, direction, userId) => mutateScenes(id, (pkg) => {
    const i = pkg.scenes.findIndex((s) => s.id === sceneId); if (i < 0) throw notFound('Scene');
    const k = direction === 'up' ? i - 1 : i + 1;
    if (k < 0 || k >= pkg.scenes.length) throw badRequest('Cannot move further.');
    [pkg.scenes[i], pkg.scenes[k]] = [pkg.scenes[k], pkg.scenes[i]];
  }, { userId }).project;
  const reviewScene = (id, sceneId, status, note, userId) => mutateScenes(id, (pkg) => { const s = sceneOf(pkg, sceneId); s.review = { status, note: String(note || '').slice(0, 500) }; audit(db, userId, `scene_${status}`, 'scene', sceneId, { project: id, note }); return s; }).result;
  const replaceScene = (id, sceneId, scene, label, userId) => mutateScenes(id, (pkg) => { sceneOf(pkg, sceneId); pkg.scenes[pkg.scenes.findIndex((s) => s.id === sceneId)] = scene; return scene; }, { snapLabel: label, userId }).result;
  const setThumbnail = (id, patch) => mutateScenes(id, (pkg) => { pkg.thumbnail = { ...pkg.thumbnail, ...patch }; });
  const setMetadata = (id, patch) => mutateScenes(id, (pkg) => { pkg.metadata = { ...pkg.metadata, ...patch }; }).project;
  const setChecklist = (id, items) => mutateScenes(id, (pkg) => { pkg.reviewChecklist = items.map((c) => ({ id: c.id || newId('rc_'), text: String(c.text), done: !!c.done })); }).project;
  const setFactCheck = (id, items) => mutateScenes(id, (pkg) => { pkg.factCheck = items; }).project;
  const setOverview = (id, patch) => mutateScenes(id, (pkg) => { for (const k of ['objective', 'outcomes', 'music']) if (patch[k] !== undefined) pkg[k] = patch[k]; }).project;

  return {
    create, get, must, list, updateMeta, setStatus, remove, snapshot, listVersions, getVersion, restore, diffVersions, savePackage,
    updateScene, addScene, duplicateScene, deleteScene, moveScene, reviewScene, replaceScene, setThumbnail, setMetadata, setChecklist, setFactCheck, setOverview, scriptText,
  };
}
