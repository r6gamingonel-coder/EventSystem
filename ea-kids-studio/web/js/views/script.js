import { get, post, put, patch } from '../api.js';
import { h, field, select, toast, fail, badge, statusBadge, jobPanel, withCost, modal, fmtDate, fmtDur, empty, confirmDialog } from '../ui.js';

export async function render(root, S) {
  const reg = S.registry; const caps = (await get('/api/system/status')).capabilities;
  const kits = (await get('/api/kits')).kits;
  const p = S.project;
  if (!p) return root.append(empty('📝', 'Create a project to start scripting', 'A project holds your script, storyboard, audio, renders and metadata.', h('button', { class: 'btn primary', onclick: () => window.dispatchEvent(new CustomEvent('new-project')) }, '＋ New project')));
  const panel = jobPanel();
  const f = {
    title: h('input', { value: p.title, dir: 'auto' }), category: select(reg.categories.map((c) => [c.id, c.label]), p.category), format: select(Object.values(reg.formats).map((x) => [x.id, x.label]), p.format),
    language: select([['ar', 'Arabic'], ['en', 'English']], p.language), ageMin: h('input', { type: 'number', min: 1, max: 12, value: p.age_min }), ageMax: h('input', { type: 'number', min: 1, max: 14, value: p.age_max }),
    duration: h('input', { type: 'number', min: 15, max: 1800, value: p.target_duration_sec }), topic: h('textarea', { dir: 'auto', value: p.topic, placeholder: 'e.g. Teach children the colours using friendly animal characters.' }),
    style: select(reg.visualStyles, p.visual_style), narr: select(reg.narrationStyles, p.narration_style), diff: select(reg.difficulties, p.difficulty), notes: h('textarea', { dir: 'auto', placeholder: 'Optional notes for the AI (tone, things to include/avoid)…' }),
  };
  const kitSel = select([['', '— choose a lesson kit —'], ...kits.map((k) => [k.id, `${k.title.ar} (${k.category}${k.languages.includes('en') ? ', ar/en' : ', ar'})`])], '', { id: 'kit-select', 'aria-label': 'Lesson kit' });
  const prov = (id, label, c, paid) => [id, `${label}${c ? '' : ' — not configured'}${paid ? ' — paid' : ' — free'}`];
  const provSel = select([prov('offline_templates', 'Offline lesson kits (no AI)', true, false), prov('anthropic', 'Claude (Anthropic)', caps.providers.llm.anthropic.configured, true), prov('openai', 'OpenAI', caps.providers.llm.openai.configured, true), prov('openai_compatible', 'Local / OpenAI-compatible (e.g. Ollama)', caps.providers.llm.openai_compatible.configured, false)], S.settings.providers?.llm || 'offline_templates');
  const chars = reg.characters.map((c) => h('label', { class: 'check' }, h('input', { type: 'checkbox', value: c }), c));
  const kitHint = h('div', { class: 'hint' });
  const syncKit = () => { const k = kits.find((x) => x.id === kitSel.value); kitHint.textContent = provSel.value === 'offline_templates' ? (k ? `${k.maxItems} lesson items available; the generator picks enough to reach the target duration.` : 'Offline mode needs a lesson kit.') : 'The kit is ignored for AI providers; your topic drives the script.'; };
  kitSel.onchange = syncKit; provSel.onchange = syncKit; f.category.onchange = () => { const k = kits.find((x) => x.category === f.category.value); if (k && !kitSel.value) { kitSel.value = k.id; syncKit(); } };
  syncKit();

  const saveBrief = async () => patch(`/api/projects/${p.id}`, { title: f.title.value, category: f.category.value, format: f.format.value, language: f.language.value, ageMin: +f.ageMin.value, ageMax: +f.ageMax.value, targetDurationSec: +f.duration.value, topic: f.topic.value, visualStyle: f.style.value, narrationStyle: f.narr.value, difficulty: f.diff.value });

  const generate = async () => {
    try {
      if (provSel.value === 'offline_templates' && !kitSel.value) return toast('Choose a lesson kit (or switch to an AI provider).', 'warn');
      if (p.package.scenes.length && !(await confirmDialog('Replace the current script?', 'The current script and storyboard will be saved as a version first, so you can restore it later.', { ok: 'Generate' }))) return;
      await saveBrief();
      const res = await withCost((confirmCost) => post(`/api/projects/${p.id}/generate`, { provider: provSel.value, kit: kitSel.value || undefined, topic: f.topic.value, notes: f.notes.value || undefined, characters: chars.filter((c) => c.firstChild.checked).map((c) => c.firstChild.value), confirmCost }));
      if (!res) return;
      const job = await panel.track(res.job.id, 'Script generation');
      if (job?.status === 'succeeded') { await S.loadProject(); location.hash = '#/script'; window.dispatchEvent(new HashChangeEvent('hashchange')); }
    } catch (e) { fail(e); }
  };

  root.append(h('div', { class: 'stack-lg' },
    h('h1', {}, '📝 Script generator'),
    h('div', { class: 'card' }, h('h2', {}, 'Brief'), h('div', { class: 'stack' },
      h('div', { class: 'grid g3' }, field('Title', f.title), field('Category', f.category), field('Format', f.format)),
      h('div', { class: 'grid g4' }, field('Language', f.language), field('Age from', f.ageMin), field('Age to', f.ageMax), field('Target length (seconds)', f.duration)),
      field('Topic / idea', f.topic), h('div', { class: 'grid g3' }, field('Visual style', f.style), field('Narration style', f.narr), field('Difficulty', f.diff)),
      h('div', { class: 'grid g2' }, field('Generator', provSel, 'Free offline kits are the default. Paid AI shows an estimate and asks you to confirm first.'), field('Lesson kit', kitSel, '')), kitHint,
      h('div', {}, h('label', {}, 'Preferred characters (optional)'), h('div', { class: 'row' }, chars)), field('Notes for AI', f.notes),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: generate }, '✨ Generate script & storyboard'), h('button', { class: 'btn', onclick: async () => { try { await saveBrief(); toast('Brief saved', 'ok'); } catch (e) { fail(e); } } }, 'Save brief')), panel.node)),
    p.package.scenes.length ? await scriptEditor(S, p) : h('div', { class: 'callout' }, 'No script yet. Pick a lesson kit and generate — it takes a second and costs nothing.')));
}

async function scriptEditor(S, p) {
  const pkg = p.package;
  const obj = h('textarea', { dir: 'auto' }, pkg.objective); const outc = h('textarea', { dir: 'auto', rows: 3 }, pkg.outcomes.join('\n'));
  const facts = pkg.factCheck.map((fc) => ({ ...fc }));
  const factRows = facts.map((fc) => h('div', { class: 'row', style: { alignItems: 'flex-start' } }, h('div', { class: 'grow', dir: 'auto' }, fc.claim), select(['unverified', 'verified', 'disputed'], fc.status, { style: { width: '140px' }, onchange: (e) => { fc.status = e.target.value; } }), h('input', { style: { width: '220px' }, placeholder: 'Source / how verified', value: fc.source || '', oninput: (e) => { fc.source = e.target.value; } })));
  const versions = S.projectData.versions;
  const versionList = h('div', { class: 'stack' }, versions.length ? versions.slice(0, 12).map((v) => h('div', { class: 'row', style: { padding: '4px 0', borderBottom: '1px dashed var(--line)' } }, badge(`v${v.version_no}`, 'info'), h('span', { class: 'grow' }, v.label || '—'), h('span', { class: 'small muted' }, fmtDate(v.created_at)),
    h('button', { class: 'btn sm', onclick: async () => { const d = (await get(`/api/projects/${p.id}/versions/${v.version_no}/diff/current`)).diff; modal((close) => [h('h2', {}, `v${v.version_no} → current`), h('p', {}, `Added: ${d.added.length} · Removed: ${d.removed.length} · Changed: ${d.changed.length}`), d.changed.map((c) => h('div', {}, '✏️ ', h('span', { dir: 'auto' }, c.title), c.narrationChanged ? ' (narration)' : '')), d.added.map((t) => h('div', {}, '➕ ', h('span', { dir: 'auto' }, t))), d.removed.map((t) => h('div', {}, '➖ ', h('span', { dir: 'auto' }, t))), h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } }, h('button', { class: 'btn', onclick: close }, 'Close'))]); } }, 'Compare'),
    h('button', { class: 'btn sm', onclick: async () => { if (!(await confirmDialog(`Restore v${v.version_no}?`, 'Your current state is saved as a version first, so nothing is lost.', { ok: 'Restore' }))) return; try { await post(`/api/projects/${p.id}/versions/${v.version_no}/restore`); toast(`Restored v${v.version_no}`, 'ok'); location.reload(); } catch (e) { fail(e); } } }, 'Restore'))) : h('p', { class: 'muted' }, 'No versions yet.'));
  const narr = pkg.scenes.map((s) => ({ id: s.id, el: h('textarea', { dir: 'auto', rows: 2 }, s.narration), orig: s.narration }));
  return h('div', { class: 'grid g2' },
    h('div', { class: 'stack' },
      h('div', { class: 'card' }, h('h2', {}, 'Educational objective'), h('div', { class: 'stack' }, field('Objective', obj), field('Learning outcomes (one per line)', outc), h('div', {}, h('button', { class: 'btn', onclick: async () => { try { await patch(`/api/projects/${p.id}/overview`, { objective: obj.value, outcomes: outc.value.split('\n').map((x) => x.trim()).filter(Boolean) }); toast('Saved', 'ok'); } catch (e) { fail(e); } } }, 'Save')))),
      h('div', { class: 'card warn' }, h('h2', {}, '🔍 Facts to verify'), h('p', { class: 'small' }, 'AI and templates can be wrong. Check every claim against a reliable source before publishing; compliance blocks publishing until all are verified.'), h('div', { class: 'stack' }, factRows), h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn', disabled: !S.can('review'), onclick: async () => { try { await put(`/api/projects/${p.id}/factcheck`, { items: facts }); toast('Fact check saved', 'ok'); } catch (e) { fail(e); } } }, 'Save fact check'))),
      h('div', { class: 'card' }, h('h2', {}, 'Versions'), h('div', { class: 'row', style: { marginBottom: '8px' } }, h('button', { class: 'btn sm', onclick: async () => { const label = prompt('Name this version', 'Manual save'); if (label === null) return; try { await post(`/api/projects/${p.id}/versions`, { label }); toast('Version saved', 'ok'); location.reload(); } catch (e) { fail(e); } } }, '💾 Save version'), h('a', { class: 'btn sm', href: `/api/projects/${p.id}/export/script` }, '⬇ Script (.md)')), versionList)),
    h('div', { class: 'card' }, h('h2', {}, `Script (${pkg.scenes.length} scenes · ~${fmtDur(pkg.scenes.reduce((a, s) => a + s.durationSec, 0))})`), h('p', { class: 'small muted' }, 'Narration, scene by scene. Editing a scene sends it back to "pending" review and marks its narration audio as out of date.'),
      h('div', { class: 'stack' }, pkg.scenes.map((s, i) => h('div', {}, h('div', { class: 'row' }, h('b', {}, `${i + 1}. `, h('span', { dir: 'auto' }, s.title)), badge(s.kind, 'neutral'), statusBadge(s.review.status), s.locked && badge('🔒 locked')), narr[i].el))),
      h('div', { style: { marginTop: '12px' } }, h('button', { class: 'btn primary', onclick: async () => { try { let n = 0; for (const x of narr) if (x.el.value !== x.orig) { await patch(`/api/projects/${p.id}/scenes/${x.id}`, { narration: x.el.value }); n++; } toast(n ? `${n} scene(s) updated` : 'No changes', n ? 'ok' : 'info'); if (n) location.reload(); } catch (e) { fail(e); } } }, 'Save narration changes'))));
}
