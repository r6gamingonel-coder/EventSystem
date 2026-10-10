import { now, j, parse } from '../db.js';
import { newId } from '../lib/security.js';
import { notFound } from '../lib/errors.js';

export function createIdeas({ db }) {
  const hydrate = (r) => r && ({ ...r, tags: parse(r.tags, []) });
  const get = (id) => hydrate(db.get('SELECT * FROM ideas WHERE id = ?', id));
  const list = ({ status, category, q } = {}) => {
    const w = []; const p = [];
    if (status) { w.push('status = ?'); p.push(status); }
    if (category) { w.push('category = ?'); p.push(category); }
    if (q) { w.push('(title LIKE ? OR description LIKE ?)'); p.push(`%${q}%`, `%${q}%`); }
    return db.all(`SELECT * FROM ideas ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY updated_at DESC LIMIT 500`, ...p).map(hydrate);
  };
  function create(b) {
    const id = newId('id_');
    db.run('INSERT INTO ideas(id,title,description,category,language,age_min,age_max,status,tags,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', id, b.title, b.description ?? '', b.category ?? 'general', b.language ?? 'ar', b.ageMin ?? 3, b.ageMax ?? 6, b.status ?? 'new', j(b.tags ?? []), now(), now());
    return get(id);
  }
  function update(id, b) {
    const c = get(id); if (!c) throw notFound('Idea');
    const n = { ...c, ...b };
    db.run('UPDATE ideas SET title=?, description=?, category=?, language=?, age_min=?, age_max=?, status=?, tags=?, project_id=?, updated_at=? WHERE id=?', n.title, n.description, n.category, n.language, n.ageMin ?? c.age_min, n.ageMax ?? c.age_max, n.status, j(n.tags), n.projectId ?? c.project_id, now(), id);
    return get(id);
  }
  const remove = (id) => { if (!get(id)) throw notFound('Idea'); db.run('DELETE FROM ideas WHERE id = ?', id); };
  /** Starter ideas so the library is useful on day one. Idempotent. */
  function seed() {
    if (db.get('SELECT COUNT(*) c FROM ideas').c) return;
    const starters = [
      ['نتعلم الألوان مع أصدقاء الحيوانات', 'درس الألوان الأساسية مع الشخصيات الأربع', 'colors', ['ألوان']],
      ['نعدّ معًا من ١ إلى ٥', 'العدّ مع نونو وأشياء مألوفة', 'numbers', ['أرقام']],
      ['الحروف العربية: أ ب ت', 'حرف وكلمة وصورة لكل حرف', 'alphabet', ['حروف']],
      ['أصوات الحيوانات', 'ست حيوانات وأصواتها', 'animals', ['حيوانات']],
      ['كيف تنمو النباتات؟', 'الماء والضوء والنمو (معلومات أساسية)', 'nature', ['علوم']],
      ['نونو والجزرة الكبيرة', 'قصة عن المشاركة', 'story', ['قصة']],
      ['عادات جميلة: غسل اليدين', 'عادات النظافة والأدب', 'habits', ['عادات']],
      ['أغنية الألوان', 'أغنية أصلية قصيرة', 'songs', ['أغنية']],
    ];
    for (const [title, description, category, tags] of starters) create({ title, description, category, tags });
  }
  return { get, list, create, update, remove, seed };
}
