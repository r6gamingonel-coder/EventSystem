// Character library: versioned profiles with reference images, approved prompts and voice notes.
// The four built-in mascots are seeded from server/art/characters.js on first run.
import { now, j, parse } from '../db.js';
import { newId, slugify } from '../lib/security.js';
import { notFound, conflict } from '../lib/errors.js';
import { CHARACTERS, characterSvg } from '../art/characters.js';
import { svgToPng, wrapSvg } from '../lib/imaging.js';

export function createCharacters({ db, media, log }) {
  const hydrate = (r) => r && ({ ...r, colors: parse(r.colors, {}), voice: parse(r.voice, {}), approved_prompts: parse(r.approved_prompts, []), archived: !!r.archived });

  const get = (id) => hydrate(db.get('SELECT * FROM characters WHERE id = ? OR slug = ?', id, id));
  const list = ({ archived = false } = {}) => db.all('SELECT * FROM characters WHERE archived = ? ORDER BY created_at', archived ? 1 : 0).map((c) => ({ ...hydrate(c), references: media.list({ characterId: c.id }).map((a) => ({ id: a.id, filename: a.filename, version: a.meta.version, kind: a.meta.refKind })) }));

  function snapshotVersion(c) {
    db.run('INSERT INTO character_versions(id,character_id,version_no,snapshot,created_at) VALUES (?,?,?,?,?)', newId('cv_'), c.id, c.version, j({ ...c, references: undefined }), now());
  }

  function create(b) {
    const slug = slugify(b.slug || b.nameEn || b.nameAr);
    if (db.get('SELECT 1 FROM characters WHERE slug = ?', slug)) throw conflict(`A character with slug "${slug}" already exists.`);
    const id = newId('ch_');
    db.run('INSERT INTO characters(id,slug,name_ar,name_en,species,description,colors,features,personality,edu_role,voice,approved_prompts,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)',
      id, slug, b.nameAr, b.nameEn ?? '', b.species ?? '', b.description ?? '', j(b.colors ?? {}), b.features ?? '', b.personality ?? '', b.eduRole ?? '', j(b.voice ?? {}), j(b.approvedPrompts ?? []), now(), now());
    snapshotVersion(get(id));
    return get(id);
  }

  /** Any edit creates a new version; earlier versions stay in character_versions. */
  function update(id, patch) {
    const c = get(id); if (!c) throw notFound('Character');
    const next = { ...c, ...patch };
    db.run('UPDATE characters SET name_ar=?, name_en=?, species=?, description=?, colors=?, features=?, personality=?, edu_role=?, voice=?, approved_prompts=?, version=version+1, updated_at=? WHERE id=?',
      next.nameAr ?? c.name_ar, next.nameEn ?? c.name_en, next.species ?? c.species, next.description ?? c.description, j(next.colors ?? c.colors), next.features ?? c.features, next.personality ?? c.personality, next.eduRole ?? c.edu_role, j(next.voice ?? c.voice), j(next.approvedPrompts ?? c.approved_prompts), now(), c.id);
    snapshotVersion(get(c.id));
    return get(c.id);
  }
  const versions = (id) => db.all('SELECT version_no, snapshot, created_at FROM character_versions WHERE character_id = ? ORDER BY version_no DESC', get(id)?.id).map((v) => ({ ...v, snapshot: parse(v.snapshot) }));
  const archive = (id, on = true) => { const c = get(id); if (!c) throw notFound('Character'); db.run('UPDATE characters SET archived=? WHERE id=?', on ? 1 : 0, c.id); };

  /** Prompt block injected into every scene prompt that features this character (consistency instructions). */
  function consistencyBlock(slugs) {
    return slugs.map((s) => get(s)).filter(Boolean).map((c) => `${c.name_en} (${c.name_ar}), ${c.species}: ${c.features} Palette: ${Object.entries(c.colors).map(([k, v]) => `${k} ${v}`).join(', ')}.`).join('\n');
  }

  /** Seed the built-in mascots (+ reference PNGs) once. */
  async function seed() {
    for (const m of Object.values(CHARACTERS)) {
      if (get(m.slug)) continue;
      const c = create({ slug: m.slug, nameAr: m.nameAr, nameEn: m.nameEn, species: m.species, description: m.description, colors: m.colors, features: m.features, personality: m.personality, eduRole: m.eduRole, voice: m.voice,
        approvedPrompts: [`Flat vector children's illustration of ${m.nameEn}, a ${m.species}. ${m.features} Thick navy (#23285B) outline, soft pastel background, friendly expression, EA KIDS style.`] });
      for (const emo of ['happy', 'wow']) {
        const png = await svgToPng(wrapSvg(400, 400, characterSvg(m.slug, emo)), 800, 800);
        await media.create({ characterId: c.id, kind: 'image', mediaType: 'motion_graphics', relPath: `library/characters/${m.slug}/v1-${emo}.png`, buffer: png, mime: 'image/png', provider: 'local_svg', reviewStatus: 'approved', meta: { version: 1, refKind: emo, key: `${m.slug}:${emo}` } });
      }
      log.info('seeded character', { slug: m.slug });
    }
  }
  return { get, list, create, update, versions, archive, consistencyBlock, seed };
}
