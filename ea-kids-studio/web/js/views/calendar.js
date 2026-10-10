import { get, post, del, patch } from '../api.js';
import { h, field, select, toast, fail, badge } from '../ui.js';

export async function render(root, S) {
  let ym = new Date(); ym.setDate(1);
  const { events } = await get('/api/calendar');
  const grid = h('div'); const title = h('h2');
  const draw = () => {
    title.textContent = ym.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    const first = new Date(ym.getFullYear(), ym.getMonth(), 1); const start = new Date(first); start.setDate(1 - first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cells.push(h('div', { class: `day ${d.getMonth() !== ym.getMonth() ? 'dim' : ''}` }, h('b', {}, d.getDate()), events.filter((e) => e.date === key).map((e) => h('span', { class: `ev ${e.kind}`, title: `${e.title} (${e.kind})` }, `${e.kind === 'publish' ? '🚀' : '•'} ${e.title}`))));
    }
    grid.replaceChildren(h('div', { class: 'cal' }, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((x) => h('div', { class: 'dow' }, x)), cells));
  };
  draw();
  const t = h('input', { dir: 'auto', placeholder: 'e.g. Record narration for colours episode' }); const d = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10) }); const k = select(['note', 'script', 'render', 'review', 'publish'], 'note');
  const projSel = select([['', '—'], ...S.projects.map((p) => [p.id, p.title])], S.projectId || ''); const sched = h('input', { type: 'datetime-local' });
  const upcoming = events.filter((e) => e.date >= new Date().toISOString().slice(0, 10)).slice(0, 12);
  root.append(h('div', { class: 'stack-lg' }, h('h1', {}, '🗓️ Content calendar'), h('p', { class: 'muted' }, 'Plan a steady, sustainable schedule — consistent quality beats volume. Scheduled uploads (set in Compliance & YouTube) appear here automatically.'),
    h('div', { class: 'card' }, h('div', { class: 'row spread' }, h('button', { class: 'btn sm', onclick: () => { ym.setMonth(ym.getMonth() - 1); draw(); } }, '◀'), title, h('button', { class: 'btn sm', onclick: () => { ym.setMonth(ym.getMonth() + 1); draw(); } }, '▶')), grid),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', {}, 'Add to calendar'), h('div', { class: 'stack' }, field('What', t), h('div', { class: 'grid g2' }, field('Date', d), field('Type', k)), h('div', {}, h('button', { class: 'btn primary', disabled: !S.can('write'), onclick: async () => { if (!t.value.trim()) return toast('Describe the entry', 'warn'); try { await post('/api/calendar', { title: t.value, date: d.value, kind: k.value }); toast('Added', 'ok'); location.reload(); } catch (e) { fail(e); } } }, 'Add')))),
      h('div', { class: 'card' }, h('h2', {}, 'Planned publication date'), h('div', { class: 'stack' }, field('Project', projSel), field('Date & time', sched, 'Records your plan only. To make YouTube hold the video until then, use “Schedule” in Compliance & YouTube.'), h('button', { class: 'btn', disabled: !S.can('publish'), onclick: async () => { if (!projSel.value) return toast('Choose a project', 'warn'); try { await patch(`/api/projects/${projSel.value}/schedule`, { scheduledAt: sched.value ? new Date(sched.value).toISOString() : null }); toast('Saved', 'ok'); location.reload(); } catch (e) { fail(e); } } }, 'Save plan')))),
    h('div', { class: 'card' }, h('h2', {}, 'Upcoming'), upcoming.length ? upcoming.map((e) => h('div', { class: 'row', style: { padding: '4px 0' } }, h('b', {}, e.date), badge(e.kind, e.kind === 'publish' ? 'ok' : 'info'), h('span', { class: 'grow', dir: 'auto' }, e.title), !String(e.id).startsWith('proj_') && h('button', { class: 'btn sm danger', onclick: async () => { await del(`/api/calendar/${e.id}`); location.reload(); } }, '✕'))) : h('p', { class: 'muted' }, 'Nothing planned.'))));
}
