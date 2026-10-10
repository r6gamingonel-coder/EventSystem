import { get, patch, post } from '../api.js';
import { h, field, select, toast, fail, badge, empty, fmtDur } from '../ui.js';

export async function render(root, S) {
  const p = S.project;
  if (!p) return root.append(empty('🏷️', 'No project selected', 'Create or pick a project first.'));
  const m = structuredClone(p.package.metadata);
  const [sug, val, pls] = await Promise.all([get(`/api/projects/${p.id}/metadata/suggest`), get(`/api/projects/${p.id}/metadata/validate`), get('/api/playlists')]);
  const f = { title: h('input', { dir: 'auto', value: m.title, maxlength: 100 }), desc: h('textarea', { dir: 'auto', rows: 12, value: m.description }), tags: h('input', { dir: 'auto', value: m.tags.join(', ') }), lang: select([['ar', 'Arabic'], ['en', 'English']], m.language || p.language), playlist: h('input', { dir: 'auto', value: m.playlist, list: 'pls' }), thumb: h('input', { value: m.thumbnailFilename }) };
  const counters = { title: h('span', { class: 'small muted' }), desc: h('span', { class: 'small muted' }), tags: h('span', { class: 'small muted' }) };
  const upd = () => { counters.title.textContent = `${f.title.value.length}/100`; counters.desc.textContent = `${f.desc.value.length}/5000`; const tl = f.tags.value.split(',').map((x) => x.trim()).filter(Boolean); counters.tags.textContent = `${tl.length} tags · ${tl.join(',').length}/500 characters`; };
  [f.title, f.desc, f.tags].forEach((x) => { x.oninput = upd; }); upd();
  const save = async () => { try { await patch(`/api/projects/${p.id}/metadata`, { title: f.title.value, description: f.desc.value, tags: f.tags.value.split(',').map((x) => x.trim()).filter(Boolean), language: f.lang.value, playlist: f.playlist.value, thumbnailFilename: f.thumb.value }); toast('Metadata saved', 'ok'); S.loadProject().then(() => { root.replaceChildren(); render(root, S); }); } catch (e) { fail(e); } };
  const useSuggestion = () => { f.desc.value = sug.suggestion.description; f.thumb.value = sug.suggestion.thumbnailFilename; upd(); toast('Description rebuilt from the real timeline (not saved yet)', 'info'); };
  root.append(h('div', { class: 'stack-lg' }, h('h1', {}, '🏷️ Titles, descriptions & SEO'),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', {}, 'YouTube metadata'), h('div', { class: 'stack' }, field('Title', f.title), counters.title, field('Description', f.desc), counters.desc, field('Tags (comma separated)', f.tags), counters.tags, h('div', { class: 'grid g2' }, field('Language', f.lang), field('Playlist', f.playlist, 'A playlist is created/used on upload if YouTube is connected.')), field('Thumbnail file name', f.thumb), h('datalist', { id: 'pls' }, sug.suggestion.playlistSuggestions.map((x) => h('option', { value: x }))),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', disabled: !S.can('write'), onclick: save }, 'Save'), h('button', { class: 'btn', onclick: useSuggestion }, '↻ Rebuild description & chapters')))),
      h('div', { class: 'stack' },
        h('div', { class: 'card' }, h('h2', {}, 'Checks'), val.issues.length ? val.issues.map((i) => h('div', { class: 'chk' }, h('span', { class: 'st' }, i.level === 'fail' ? '❌' : '🟡'), h('div', {}, i.text))) : h('div', { class: 'callout ok' }, '✅ No problems found. Still, make sure the title honestly describes the video.'), h('p', { class: 'small muted' }, 'Avoid misleading clickbait, keyword stuffing and unsupported educational claims. Tags: only a few accurate ones.')),
        h('div', { class: 'card' }, h('h2', {}, 'Chapters (from the real timeline)'), sug.suggestion.chapters.length ? sug.suggestion.chapters.map((c) => h('div', { class: 'row' }, h('span', { class: 'mono' }, fmtDur(c.time)), h('span', { dir: 'auto' }, c.title))) : h('p', { class: 'muted small' }, 'Chapters are added for landscape videos of at least 60 seconds with 3+ sections (each ≥ 10 s). Generate narration first so timestamps are accurate.')),
        h('div', { class: 'card' }, h('h2', {}, 'Publication checklist'), ['Title is truthful and ≤ 100 characters', 'Description explains the learning goal and the age range', 'Voice disclosure line kept if the voice is computer-generated', 'Language is set', 'Thumbnail matches the video', 'Audience (made for kids) decided in Compliance', 'Captions (SRT/VTT) exported'].map((x) => h('div', { class: 'chk' }, h('span', { class: 'st' }, '☐'), h('div', {}, x))))))));
}
