import { get, post, upload, patch } from '../api.js';
import { h, field, select, toast, fail, badge, empty } from '../ui.js';

export async function render(root, S) {
  const p = S.project;
  if (!p) return root.append(empty('🌟', 'No project selected', 'Create or pick a project first.'));
  const refresh = async () => { await S.loadProject(); root.replaceChildren(); await render(root, S); };
  const [{ templates }, th] = await Promise.all([get('/api/thumbnail-templates'), get(`/api/projects/${p.id}/thumbnails`)]);
  const t = th.params;
  const f = { template: select(templates.map((x) => [x.id, x.label]), t.template), title: h('input', { dir: 'auto', value: t.title || p.title.split('|')[0].trim(), maxlength: 40 }), glyph: h('input', { dir: 'auto', value: t.glyph || '', maxlength: 3, style: { maxWidth: '90px' } }), accent: select([['', 'none'], ['red', 'red'], ['blue', 'blue'], ['yellow', 'yellow'], ['green', 'green'], ['orange', 'orange'], ['pink', 'pink'], ['purple', 'purple']], t.accent || '') };
  const chars = S.registry.characters.map((c) => h('label', { class: 'check' }, h('input', { type: 'checkbox', value: c, checked: (t.characters || []).some((x) => x.slug === c) }), c));
  const words = () => f.title.value.trim().split(/\s+/).filter(Boolean).length;
  const warn = h('div', { class: 'small' });
  const upd = () => { warn.textContent = words() > 3 ? `⚠ ${words()} words — thumbnails read best at 3 words or fewer on a phone.` : ''; }; f.title.oninput = upd; upd();
  const generate = async () => {
    try {
      const sel = chars.filter((c) => c.firstChild.checked).map((c) => ({ slug: c.firstChild.value, emotion: 'happy' })).slice(0, 3);
      await post(`/api/projects/${p.id}/thumbnails/generate`, { overrides: { template: f.template.value, title: f.title.value, glyph: f.glyph.value, accent: f.accent.value, characters: sel.length ? sel : undefined } });
      toast('3 concepts generated', 'ok'); refresh();
    } catch (e) { fail(e); }
  };
  const check = await get(`/api/projects/${p.id}/thumbnails/check`).catch(() => null);
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg', hidden: true, onchange: async (e) => { const fl = e.target.files[0]; if (!fl) return; try { await upload(`/api/projects/${p.id}/thumbnails/upload?filename=${encodeURIComponent(fl.name)}&licenseSource=Owner%20artwork`, fl); toast('Custom thumbnail uploaded and selected', 'ok'); refresh(); } catch (x) { fail(x); } } });
  root.append(h('div', { class: 'stack-lg' }, h('h1', {}, '🌟 Thumbnails'),
    p.format === 'shorts' ? h('div', { class: 'callout' }, 'Shorts use a frame from the video as the cover; custom thumbnails are optional. You can still generate one for your records.') : null,
    h('div', { class: 'card' }, h('h2', {}, 'Design'), h('div', { class: 'stack' }, h('div', { class: 'grid g4' }, field('Template', f.template), field('Headline (≤ 3 words)', f.title), field('Big letter/number', f.glyph), field('Accent colour', f.accent)), warn, h('div', {}, h('label', {}, 'Characters (up to 3)'), h('div', { class: 'row' }, chars)),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', disabled: !S.can('write'), onclick: generate }, '✨ Generate 3 concepts'), h('button', { class: 'btn', disabled: !S.can('write'), onclick: () => file.click() }, '⬆ Upload my own'), file),
      h('div', { class: 'small muted' }, 'Rules baked in: one focal character, big outlined text, props kept away from the headline, EA KIDS badge, 16:9 at 1280×720. No misleading imagery — the thumbnail must show what the video actually contains.'))),
    th.assets.length ? h('div', { class: 'card' }, h('h2', {}, 'Concepts'), h('div', { class: 'thumb-grid' }, th.assets.filter((a) => a.kind === 'thumbnail' || a.id === th.selectedAssetId).map((a) => h('div', { class: `thumb ${a.id === th.selectedAssetId ? 'sel' : ''}` }, h('img', { src: `/api/assets/${a.id}/file`, alt: `Thumbnail concept ${a.meta.variant || ''}` }), h('div', { class: 'row spread', style: { padding: '8px' } }, h('span', {}, a.meta.variant ? `Concept ${a.meta.variant}` : 'Custom', a.id === th.selectedAssetId && ' ', a.id === th.selectedAssetId && badge('selected', 'ok')), h('div', { class: 'row' }, h('img', { src: `/api/assets/${a.id}/file`, alt: 'Phone-size preview', style: { width: '120px', height: '68px', borderRadius: '6px', border: '1px solid var(--line)' }, title: 'How it looks as a small phone thumbnail' }), h('button', { class: 'btn sm primary', disabled: !S.can('write') || a.id === th.selectedAssetId, onclick: async () => { try { await post(`/api/projects/${p.id}/thumbnails/select`, { assetId: a.id }); refresh(); } catch (e) { fail(e); } } }, 'Use'), h('a', { class: 'btn sm', href: `/api/assets/${a.id}/file?download=1` }, '⬇')))))),
      check && h('div', { class: `callout ${check.ok ? 'ok' : 'warn'}`, style: { marginTop: '12px' } }, check.ok ? '✅ ' : '⚠ ', check.detail, check.ok ? ' — meets YouTube’s size rules (≤ 2 MB, 16:9).' : '')) : h('div', { class: 'callout' }, 'No thumbnails yet. Click “Generate 3 concepts”.')));
}
