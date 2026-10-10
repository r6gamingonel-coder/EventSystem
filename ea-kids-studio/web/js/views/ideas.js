import { get, post, patch, del } from '../api.js';
import { h, field, select, toast, fail, badge, empty, modal } from '../ui.js';

export async function render(root, S) {
  const cats = S.registry.categories;
  const list = h('div', { class: 'stack' });
  const q = h('input', { placeholder: 'Search ideas…', oninput: load }); const st = select([['', 'All statuses'], 'new', 'planned', 'in_production', 'done', 'archived'], '', { onchange: load });
  async function load() {
    const { ideas } = await get(`/api/ideas?q=${encodeURIComponent(q.value)}&status=${st.value}`);
    list.replaceChildren(...(ideas.length ? ideas.map(card) : [empty('💡', 'No ideas match', 'Add one below.')]));
  }
  function card(i) {
    const cat = cats.find((c) => c.id === i.category);
    return h('div', { class: 'card row' }, h('div', { class: 'grow' }, h('b', { dir: 'auto' }, i.title), h('div', { class: 'small muted', dir: 'auto' }, i.description), h('div', { class: 'row', style: { marginTop: '6px' } }, badge(cat?.label || i.category, 'info'), badge(i.language.toUpperCase()), badge(`ages ${i.age_min}–${i.age_max}`), ...i.tags.map((t) => badge(t)))),
      select(['new', 'planned', 'in_production', 'done', 'archived'], i.status, { style: { width: '150px' }, onchange: async (e) => { await patch(`/api/ideas/${i.id}`, { status: e.target.value }); toast('Updated', 'ok'); } }),
      h('button', { class: 'btn sm primary', onclick: async () => { try { const { project } = await post('/api/projects', { title: i.title, category: i.category, language: i.language, ageMin: i.age_min, ageMax: i.age_max, topic: i.description }); await patch(`/api/ideas/${i.id}`, { status: 'in_production', projectId: project.id }); localStorage.setItem('eak.project', project.id); toast('Project created from idea', 'ok'); location.hash = '#/script'; location.reload(); } catch (e) { fail(e); } } }, '→ Make video'),
      h('button', { class: 'btn sm danger', 'aria-label': 'Delete idea', onclick: async () => { await del(`/api/ideas/${i.id}`); load(); } }, '🗑'));
  }
  const title = h('input', { dir: 'auto', placeholder: 'Idea title (Arabic or English)' }); const desc = h('textarea', { dir: 'auto', placeholder: 'What will children learn?' });
  const cat = select(cats.map((c) => [c.id, c.label]), 'colors'); const lang = select([['ar', 'Arabic'], ['en', 'English']], 'ar'); const tags = h('input', { placeholder: 'tags, comma separated' });
  root.append(h('div', { class: 'stack-lg' }, h('h1', {}, '💡 Video ideas'), h('p', { class: 'muted' }, 'Collect ideas, plan them, and turn the good ones into projects. Vary topics and formats — YouTube may treat near-identical videos as mass-produced content.'),
    h('div', { class: 'card' }, h('h2', {}, 'Add an idea'), h('div', { class: 'stack' }, h('div', { class: 'grid g3' }, field('Title', title), field('Category', cat), field('Language', lang)), field('Description', desc), field('Tags', tags),
      h('div', {}, h('button', { class: 'btn primary', onclick: async () => { if (!title.value.trim()) return toast('Add a title', 'warn'); try { await post('/api/ideas', { title: title.value.trim(), description: desc.value, category: cat.value, language: lang.value, tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean) }); title.value = desc.value = tags.value = ''; toast('Idea saved', 'ok'); load(); } catch (e) { fail(e); } } }, 'Save idea')))),
    h('div', { class: 'row' }, q, st), list));
  await load();
}
