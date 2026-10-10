import { get, post, patch, del } from '../api.js';
import { h, field, select, toast, fail, badge, statusBadge, modal, confirmDialog, withCost, jobPanel, fmtDur, empty } from '../ui.js';

const MEDIA_HELP = {
  motion_graphics: 'Drawn locally from the EA KIDS art library with animated layers and camera moves. This is NOT AI video.',
  animated_still: 'An imported still image animated with camera moves (Ken Burns). Not AI video.',
  imported_video: 'A video clip you imported and are licensed to use commercially.',
  ai_video_clip: 'A clip produced by an AI video generator that YOU generated elsewhere and attached. No video-generation API is built in.',
};

export const stillUrl = (p, s, w = 480) => `/api/projects/${p.id}/scenes/${s.id}/still.png?w=${w}&v=${encodeURIComponent(s.review.status + s.narration.length + JSON.stringify(s.visual).length)}`;

export async function render(root, S) {
  const p = S.project;
  if (!p) return root.append(empty('🎞️', 'No project selected', 'Create or pick a project first.', h('button', { class: 'btn primary', onclick: () => window.dispatchEvent(new CustomEvent('new-project')) }, '＋ New project')));
  const scenes = p.package.scenes;
  if (!scenes.length) return root.append(empty('🎞️', 'No storyboard yet', 'Generate a script first.', h('a', { class: 'btn primary', href: '#/script' }, 'Open the script generator')));
  let filter = 'all';
  const grid = h('div', { class: `scene-grid` });
  const counts = () => ({ approved: scenes.filter((s) => s.review.status === 'approved').length, rejected: scenes.filter((s) => s.review.status === 'rejected').length });
  const header = h('div', { class: 'row spread' });
  const refresh = async () => { await S.loadProject(); root.replaceChildren(); await render(root, S); };
  const draw = () => {
    const c = counts();
    header.replaceChildren(h('div', {}, h('h1', {}, '🎞️ Storyboard'), h('p', { class: 'muted' }, `${scenes.length} scenes · ${fmtDur(scenes.reduce((a, s) => a + s.durationSec, 0))} · ${c.approved} approved · ${c.rejected} rejected`)),
      h('div', { class: 'row' }, select([['all', 'All scenes'], ['pending', 'Pending review'], ['approved', 'Approved'], ['rejected', 'Rejected']], filter, { onchange: (e) => { filter = e.target.value; draw(); } }),
        h('button', { class: 'btn', disabled: !S.can('review'), onclick: async () => { if (!(await confirmDialog('Approve every pending scene?', 'Only do this after you looked at each scene: characters on-model, nothing inappropriate, text correct.', { ok: 'Approve all' }))) return; try { for (const s of scenes.filter((x) => x.review.status === 'pending')) await post(`/api/projects/${p.id}/scenes/${s.id}/review`, { status: 'approved' }); refresh(); } catch (e) { fail(e); } } }, '✓ Approve all pending'),
        h('button', { class: 'btn primary', disabled: !S.can('write'), onclick: async () => { try { await post(`/api/projects/${p.id}/scenes`, { scene: { title: 'New scene', kind: 'lesson', narration: 'نص جديد.', visual: { background: { preset: 'meadow' }, layers: [] } } }); refresh(); } catch (e) { fail(e); } } }, '＋ Add scene')));
    grid.replaceChildren(...scenes.filter((s) => filter === 'all' || s.review.status === filter).map((s) => card(s)));
  };
  const card = (s) => {
    const i = scenes.indexOf(s);
    return h('div', { class: `card scene ${p.format === 'shorts' ? 'shorts' : ''} rev-${s.review.status}` },
      h('div', { class: 'pic' }, h('img', { src: stillUrl(p, s), alt: `Preview of scene ${i + 1}`, loading: 'lazy' }), h('div', { class: 'tag' }, statusBadge(s.review.status))),
      h('div', { class: 'body' },
        h('div', { class: 'row spread' }, h('b', {}, `${i + 1}. `, h('span', { dir: 'auto' }, s.title)), h('span', { class: 'small muted' }, fmtDur(s.durationSec))),
        h('div', { class: 'row' }, badge(s.kind), badge(s.visual.mediaType.replace('_', ' '), s.visual.mediaType === 'motion_graphics' ? 'neutral' : 'info'), s.locked && badge('🔒')),
        h('div', { class: 'narr', dir: 'auto' }, s.narration || h('span', { class: 'muted' }, '(no narration)')),
        s.review.note && h('div', { class: 'callout warn small', dir: 'auto' }, s.review.note),
        h('div', { class: 'row', style: { marginTop: 'auto' } },
          h('button', { class: 'btn sm primary', onclick: () => openSceneEditor(S, s, refresh) }, '✏️ Edit'),
          h('button', { class: 'btn sm good', disabled: !S.can('review'), onclick: async () => { try { await post(`/api/projects/${p.id}/scenes/${s.id}/review`, { status: 'approved' }); refresh(); } catch (e) { fail(e); } } }, '✓'),
          h('button', { class: 'btn sm danger', disabled: !S.can('review'), onclick: () => rejectDialog(S, s, refresh) }, '✗ Reject'),
          h('button', { class: 'btn sm', disabled: i === 0 || !S.can('write'), 'aria-label': 'Move up', onclick: async () => { await post(`/api/projects/${p.id}/scenes/${s.id}/move`, { direction: 'up' }); refresh(); } }, '↑'),
          h('button', { class: 'btn sm', disabled: i === scenes.length - 1 || !S.can('write'), 'aria-label': 'Move down', onclick: async () => { await post(`/api/projects/${p.id}/scenes/${s.id}/move`, { direction: 'down' }); refresh(); } }, '↓'),
          h('button', { class: 'btn sm', disabled: !S.can('write'), onclick: async () => { await post(`/api/projects/${p.id}/scenes/${s.id}/duplicate`); refresh(); } }, '⧉'),
          h('button', { class: 'btn sm', disabled: !S.can('generate') || s.locked, title: s.locked ? 'Unlock the scene first' : 'Revise this one scene with AI', onclick: () => reviseDialog(S, s, refresh) }, '🤖'),
          h('button', { class: 'btn sm danger', disabled: !S.can('write'), 'aria-label': 'Delete scene', onclick: async () => { if (await confirmDialog('Delete this scene?', 'A version is saved first so you can restore it.', { danger: true, ok: 'Delete' })) { try { await del(`/api/projects/${p.id}/scenes/${s.id}`); refresh(); } catch (e) { fail(e); } } } }, '🗑'))));
  };
  draw();
  root.append(h('div', { class: 'stack-lg' }, header, h('div', { class: 'callout' }, 'Check every scene for: ', h('b', {}, 'characters look the same as the reference'), ', nothing scary or unsafe, correct Arabic text, readable captions. Reject anything defective with a note — rejected scenes block rendering.'), grid));
}

export function rejectDialog(S, s, done) {
  const reason = select(['Character looks inconsistent / off-model', 'Visual defect (cut off, overlapping, wrong colours)', 'Inappropriate or scary for children', 'Text or Arabic is wrong', 'Other'], '');
  const note = h('textarea', { dir: 'auto', placeholder: 'What should be fixed?' });
  modal((close) => [h('h2', {}, 'Reject scene'), h('div', { class: 'stack' }, field('Reason', reason), field('Note', note), h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: close }, 'Cancel'), h('button', { class: 'btn danger', onclick: async () => { try { await post(`/api/projects/${S.project.id}/scenes/${s.id}/review`, { status: 'rejected', note: `${reason.value}${note.value ? ': ' + note.value : ''}` }); close(); done(); } catch (e) { fail(e); } } }, 'Reject')))]);
}

export async function reviseDialog(S, s, done) {
  const caps = (await get('/api/system/status')).capabilities.providers.llm;
  const opts = ['anthropic', 'openai', 'openai_compatible'].map((k) => [k, `${k}${caps[k].configured ? '' : ' — not configured'}${caps[k].paid ? ' (paid)' : ' (free)'}`]);
  const prov = select(opts, opts.find(([k]) => caps[k.split(' ')[0]]?.configured)?.[0] || 'anthropic'); const ins = h('textarea', { dir: 'auto', placeholder: 'e.g. Make the narration simpler and add a question for the child. / اجعل الجملة أقصر وأبسط' });
  const panel = jobPanel();
  modal((close) => [h('h2', {}, `AI revision — ${s.title}`), h('p', { class: 'muted small' }, 'Only this scene is changed. The previous state is saved as a version first. Review the result before approving.'), h('div', { class: 'stack' }, field('Provider', prov), field('What should change?', ins), panel.node, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: close }, 'Close'), h('button', { class: 'btn primary', onclick: async () => { if (ins.value.trim().length < 3) return toast('Describe the change', 'warn'); try { const r = await withCost((confirmCost) => post(`/api/projects/${S.project.id}/scenes/${s.id}/revise`, { instruction: ins.value, provider: prov.value, confirmCost })); if (!r) return; const j = await panel.track(r.job.id, 'Scene revision'); if (j?.status === 'succeeded') { close(); done(); } } catch (e) { fail(e); } } }, 'Revise scene')))]);
}

// ----------------------------------------------------------------------------- scene editor
export function openSceneEditor(S, scene, done) {
  const reg = S.registry; const p = S.project;
  const sc = structuredClone(scene);
  let tab = 'text';
  const body = h('div'); const preview = h('img', { alt: 'Scene preview', style: { width: '100%', borderRadius: '10px', border: '2px solid var(--line)' } });
  const refreshPreview = () => { preview.src = `/api/projects/${p.id}/scenes/${sc.id}/still.png?w=480&t=${Date.now()}`; };
  const refsFor = (t) => (t === 'character' ? reg.characters : t === 'animal' ? reg.animals.map((a) => a.key) : t === 'prop' ? reg.props : t === 'logo' ? ['wordmark'] : []);
  const num = (v, step = 0.01, w = '78px') => h('input', { type: 'number', step, value: v, style: { width: w } });

  const tabs = { text: textTab, visual: visualTab, audio: audioTab };
  function textTab() {
    const title = h('input', { value: sc.title, dir: 'auto', oninput: (e) => { sc.title = e.target.value; } });
    const narr = h('textarea', { dir: 'auto', rows: 5, oninput: (e) => { sc.narration = e.target.value; } }, sc.narration);
    return h('div', { class: 'stack' }, field('Scene title', title), field('Narration (what the voice says; one sentence per line works best)', narr),
      h('div', { class: 'grid g4' }, field('Kind', select(reg.sceneKinds, sc.kind, { onchange: (e) => { sc.kind = e.target.value; } })), field('Narration speed', num(sc.narrationSpeed, 0.05, '100%'), ), field('Length', select([['auto', 'Automatic (follows the voice)'], ['manual', 'Manual minimum']], sc.durationMode, { onchange: (e) => { sc.durationMode = e.target.value; } })), field('Seconds (manual)', h('input', { type: 'number', step: 0.5, value: sc.durationSec, oninput: (e) => { sc.durationSec = +e.target.value; sc.durationMode = 'manual'; } }))),
      h('div', { class: 'grid g2' }, field('Transition into this scene', select(reg.transitions, sc.transition, { onchange: (e) => { sc.transition = e.target.value; } })), h('label', { class: 'check', style: { alignSelf: 'end' } }, h('input', { type: 'checkbox', checked: sc.locked, onchange: (e) => { sc.locked = e.target.checked; } }), 'Lock scene (protects it from AI revision)')));
    // narrationSpeed input handled on save
  }
  function visualTab() {
    const bgp = select(reg.backgrounds, sc.visual.background.preset, { onchange: (e) => { sc.visual.background.preset = e.target.value; } });
    const bgc = h('input', { type: 'color', value: sc.visual.background.color || '#FFD6D6', style: { width: '70px', padding: '2px' }, onchange: (e) => { sc.visual.background.color = e.target.value; } });
    const mt = select(reg.mediaTypes, sc.visual.mediaType, { onchange: (e) => { sc.visual.mediaType = e.target.value; help.textContent = MEDIA_HELP[e.target.value]; } });
    const help = h('div', { class: 'hint' }, MEDIA_HELP[sc.visual.mediaType]);
    const layers = h('div', { class: 'stack' });
    const drawLayers = () => layers.replaceChildren(...sc.visual.layers.map((l, i) => {
      const row = h('div', { class: 'card flat', style: { padding: '8px' } });
      const typeSel = select(['character', 'animal', 'prop', 'text', 'logo', 'shape'], l.type, { style: { width: '110px' }, onchange: (e) => { l.type = e.target.value; l.ref = refsFor(l.type)[0] || ''; drawLayers(); } });
      const refs = refsFor(l.type);
      row.append(h('div', { class: 'row' }, typeSel, refs.length ? select(refs, l.ref, { style: { width: '130px' }, onchange: (e) => { l.ref = e.target.value; } }) : null,
        ['character', 'animal'].includes(l.type) ? select(reg.emotions, l.emotion || 'happy', { style: { width: '100px' }, onchange: (e) => { l.emotion = e.target.value; } }) : null,
        l.type === 'text' ? h('input', { dir: 'auto', value: l.text || '', style: { width: '160px' }, oninput: (e) => { l.text = e.target.value; } }) : null,
        ['text', 'shape'].includes(l.type) ? h('input', { type: 'color', value: l.color || '#FFFFFF', style: { width: '50px', padding: '2px' }, onchange: (e) => { l.color = e.target.value; } }) : null,
        l.type === 'prop' ? h('input', { type: 'number', min: 1, max: 12, value: l.copies || 1, title: 'copies', style: { width: '60px' }, oninput: (e) => { l.copies = +e.target.value; } }) : null,
        h('div', { class: 'grow' }), h('button', { class: 'btn sm', onclick: () => { if (i > 0) { [sc.visual.layers[i - 1], sc.visual.layers[i]] = [sc.visual.layers[i], sc.visual.layers[i - 1]]; drawLayers(); } } }, '↑'), h('button', { class: 'btn sm danger', onclick: () => { sc.visual.layers.splice(i, 1); drawLayers(); } }, '✕')),
        h('div', { class: 'row small', style: { marginTop: '6px' } }, 'x', ...[['x', 'x'], ['y', 'y'], ['size', 'size']].map(([k, label]) => h('span', {}, label, ' ', Object.assign(num(l[k]), { oninput: (e) => { l[k] = +e.target.value; } }))), select(reg.anims, l.anim, { style: { width: '110px' }, onchange: (e) => { l.anim = e.target.value; } }), 'delay', Object.assign(num(l.delay, 0.1, '64px'), { oninput: (e) => { l.delay = +e.target.value; } })));
      return row;
    }));
    drawLayers();
    const prompt_ = h('textarea', { rows: 3, dir: 'auto', oninput: (e) => { sc.visual.prompt = e.target.value; } }, sc.visual.prompt);
    return h('div', { class: 'stack' },
      h('div', { class: 'grid g2' }, field('Media type', mt, ''), h('div', {}, help)), h('div', { class: 'grid g2' }, field('Background', bgp), field('Tint colour (for "tint")', bgc)),
      h('div', {}, h('div', { class: 'row spread' }, h('b', {}, 'Layers (x, y = centre 0–1; size = fraction of the shorter side)'), h('button', { class: 'btn sm', onclick: () => { sc.visual.layers.push({ type: 'prop', ref: 'star', x: 0.5, y: 0.5, size: 0.3, anim: 'float', delay: 0 }); drawLayers(); } }, '＋ Layer')), layers),
      h('div', { class: 'grid g2' }, field('Camera move', select(reg.cameraMoves, sc.camera.move, { onchange: (e) => { sc.camera.move = e.target.value; } })), field('Camera amount (0–0.3)', Object.assign(num(sc.camera.amount, 0.01, '100%'), { oninput: (e) => { sc.camera.amount = +e.target.value; } }))),
      field('Image/animation prompt (for external AI tools, optional)', prompt_, 'Character consistency block: ' + (sc.visual.layers.filter((l) => l.type === 'character').map((l) => l.ref).join(', ') || '—')),
      field('Animation notes', h('textarea', { rows: 2, dir: 'auto', oninput: (e) => { sc.animationNotes = e.target.value; } }, sc.animationNotes)), field('Character notes', h('textarea', { rows: 2, dir: 'auto', oninput: (e) => { sc.characterNotes = e.target.value; } }, sc.characterNotes)));
  }
  function audioTab() {
    const sfx = h('div', { class: 'stack' });
    const draw = () => sfx.replaceChildren(...sc.audio.sfx.map((x, i) => h('div', { class: 'row' }, select(reg.sfx, x.name, { style: { width: '140px' }, onchange: (e) => { x.name = e.target.value; } }), 'at', h('input', { type: 'number', step: 0.1, min: 0, value: x.at, style: { width: '80px' }, oninput: (e) => { x.at = +e.target.value; } }), 's', h('button', { class: 'btn sm danger', onclick: () => { sc.audio.sfx.splice(i, 1); draw(); } }, '✕'))));
    draw();
    return h('div', { class: 'stack' }, field('Background music in this scene', select([['main', 'Normal'], ['soft', 'Quieter'], ['none', 'Silent']], sc.audio.music, { onchange: (e) => { sc.audio.music = e.target.value; } })),
      h('div', {}, h('div', { class: 'row spread' }, h('b', {}, 'Sound effects (synthesised in-house, royalty-free)'), h('button', { class: 'btn sm', onclick: () => { sc.audio.sfx.push({ name: 'pop', at: 0.5 }); draw(); } }, '＋ Effect')), sfx),
      h('p', { class: 'small muted' }, 'Music and effects are generated by EA KIDS Studio itself, so they carry no third-party licence. Project-wide music (import a licensed track, volume) is in Voice & narration.'));
  }
  const tabBar = h('div', { class: 'tabs' });
  const show = () => { tabBar.replaceChildren(...Object.keys(tabs).map((k) => h('button', { class: k === tab ? 'on' : '', onclick: () => { tab = k; show(); } }, { text: 'Text & timing', visual: 'Visual', audio: 'Audio' }[k]))); body.replaceChildren(tabs[tab]()); };
  show();
  modal((close) => [
    h('div', { class: 'row spread' }, h('h2', {}, 'Edit scene'), h('button', { class: 'btn sm', onclick: close }, '✕')),
    h('div', { class: 'grid', style: { gridTemplateColumns: 'minmax(0,1.6fr) minmax(220px,1fr)' } }, h('div', {}, tabBar, body), h('div', { class: 'stack' }, preview, h('p', { class: 'small muted' }, 'Preview shows the final layout without animation. Save to refresh.'), h('button', { class: 'btn', onclick: () => save(false) }, '💾 Save & refresh preview'))),
    h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '14px' } }, h('button', { class: 'btn', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => { if (await save(true)) { close(); done(); } } }, 'Save scene')),
  ], { wide: true, title: 'Edit scene' });
  refreshPreview();
  async function save(final) {
    try {
      const speedInput = body.querySelector('input[step="0.05"]'); if (speedInput) sc.narrationSpeed = +speedInput.value || 1;
      const patchBody = { title: sc.title, kind: sc.kind, narration: sc.narration, narrationSpeed: sc.narrationSpeed, durationMode: sc.durationMode, ...(sc.durationMode === 'manual' ? { durationSec: sc.durationSec } : {}), transition: sc.transition, locked: sc.locked, visual: { mediaType: sc.visual.mediaType, background: sc.visual.background, layers: sc.visual.layers, prompt: sc.visual.prompt }, camera: sc.camera, animationNotes: sc.animationNotes, characterNotes: sc.characterNotes, audio: sc.audio };
      const { scene: saved } = await patch(`/api/projects/${p.id}/scenes/${sc.id}`, patchBody);
      Object.assign(sc, saved); S.project.package.scenes = S.project.package.scenes.map((x) => (x.id === saved.id ? saved : x));
      if (!final) { refreshPreview(); toast('Saved', 'ok'); }
      return true;
    } catch (e) { fail(e); return false; }
  }
}
