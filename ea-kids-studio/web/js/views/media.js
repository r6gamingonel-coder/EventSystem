import { get, post, patch, del, upload } from '../api.js';
import { h, field, select, toast, fail, badge, statusBadge, modal, empty, fmtBytes, fmtDur, confirmDialog } from '../ui.js';
import { stillUrl, openSceneEditor, rejectDialog } from './storyboard.js';

const KIND_ACCEPT = { image: 'image/png,image/jpeg,image/webp', video: 'video/mp4,video/webm' };

export async function render(root, S) {
  const p = S.project;
  if (!p) return root.append(empty('🖼️', 'No project selected', 'Create or pick a project first.'));
  const refresh = async () => { await S.loadProject(); root.replaceChildren(); await render(root, S); };
  const { assets } = await get(`/api/projects/${p.id}/assets`);
  const byScene = (id) => assets.filter((a) => a.scene_id === id);
  const lic = (a) => (!a.license?.source || a.license.commercialUse !== true ? badge('licence missing', 'bad') : badge('licensed', 'ok'));

  const attach = (scene, kind) => {
    const file = h('input', { type: 'file', accept: KIND_ACCEPT[kind] });
    const f = { source: h('input', { placeholder: 'Where it came from (your own work, a licensed library…)' }), license: h('input', { placeholder: 'Licence name / terms' }), commercial: h('input', { type: 'checkbox' }), attribution: h('input', { placeholder: 'Attribution text, if required' }), proof: h('input', { placeholder: 'Proof URL / receipt id (optional)' }) };
    modal((close) => [h('h2', {}, `Attach ${kind} to “${scene.title}”`), h('div', { class: 'stack' },
      h('div', { class: 'callout warn' }, 'Only attach material you made or are licensed to use ', h('b', {}, 'commercially'), '. Copyrighted cartoon characters, songs and clips will block publishing and can get your channel struck.'),
      field('File', file, 'PNG/JPEG/WebP or MP4/WebM. Type is verified from the file content.'), field('Source', f.source), field('Licence', f.license), h('label', { class: 'check' }, f.commercial, 'I confirm this may be used commercially'), field('Attribution', f.attribution), field('Proof', f.proof),
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
        if (!file.files[0]) return toast('Choose a file', 'warn');
        try {
          const q = new URLSearchParams({ filename: file.files[0].name, sceneId: scene.id, kind, licenseSource: f.source.value, license: f.license.value, commercialUse: String(f.commercial.checked), attribution: f.attribution.value, proofUrl: f.proof.value });
          const { asset } = await upload(`/api/projects/${p.id}/assets?${q}`, file.files[0]);
          await patch(`/api/projects/${p.id}/scenes/${scene.id}`, { visual: { importedAssetId: asset.id, mediaType: asset.kind === 'video' ? 'imported_video' : 'animated_still' } });
          close(); toast('Attached', 'ok'); refresh();
        } catch (e) { fail(e); }
      } }, 'Upload & attach')))]);
  };

  root.append(h('div', { class: 'stack-lg' },
    h('div', {}, h('h1', {}, '🖼️ Scenes & media'), h('p', { class: 'muted' }, 'Each scene is exactly one of four media types. The renderer and the compliance report always say which — a drawn animation is never described as AI video.')),
    h('div', { class: 'card' }, h('h2', {}, 'Media types'), h('dl', { class: 'kv' }, ...Object.entries({ motion_graphics: 'Motion graphics (local, default)', animated_still: 'Animated still image', imported_video: 'Imported video clip', ai_video_clip: 'AI-generated video clip (attached by you)' }).flatMap(([k, l]) => [h('dt', {}, l), h('dd', { class: 'small' }, ({ motion_graphics: 'Drawn from the EA KIDS library with animated layers and camera moves.', animated_still: 'Your own/licensed picture with slow camera movement.', imported_video: 'A clip you are licensed to use commercially.', ai_video_clip: 'No AI video API is built in — generate with a tool you hold the rights to, then attach it. Disclose realistic synthetic content on YouTube when required.' })[k])]))),
    h('div', { class: 'card' }, h('h2', {}, `Scenes (${p.package.scenes.length})`), h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Scene', 'Preview', 'Media type', 'Attached media', 'Review', 'Actions'].map((x) => h('th', {}, x)))), h('tbody', {}, p.package.scenes.map((s, i) => {
      const imp = s.visual.importedAssetId ? assets.find((a) => a.id === s.visual.importedAssetId) : null;
      return h('tr', {},
        h('td', {}, h('b', {}, `${i + 1}. `, h('span', { dir: 'auto' }, s.title)), h('div', { class: 'small muted' }, fmtDur(s.durationSec))),
        h('td', { style: { width: '170px' } }, h('img', { src: stillUrl(p, s, 320), alt: '', style: { width: '160px', borderRadius: '8px', border: '2px solid var(--line)' }, loading: 'lazy' })),
        h('td', {}, select(S.registry.mediaTypes, s.visual.mediaType, { disabled: !S.can('write'), onchange: async (e) => { try { await patch(`/api/projects/${p.id}/scenes/${s.id}`, { visual: { mediaType: e.target.value } }); toast('Media type updated', 'ok'); refresh(); } catch (x) { fail(x); } } })),
        h('td', {}, imp ? h('div', { class: 'stack' }, h('span', { class: 'small' }, imp.filename), lic(imp), h('button', { class: 'btn sm danger', onclick: async () => { await patch(`/api/projects/${p.id}/scenes/${s.id}`, { visual: { importedAssetId: null, mediaType: 'motion_graphics' } }); refresh(); } }, 'Detach')) : (['ai_video_clip', 'imported_video'].includes(s.visual.mediaType) ? badge('clip required', 'bad') : h('span', { class: 'muted small' }, 'drawn locally')), h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { class: 'btn sm', disabled: !S.can('write'), onclick: () => attach(s, 'image') }, '＋ Image'), h('button', { class: 'btn sm', disabled: !S.can('write'), onclick: () => attach(s, 'video') }, '＋ Video'))),
        h('td', {}, statusBadge(s.review.status), s.review.note && h('div', { class: 'small', dir: 'auto' }, s.review.note)),
        h('td', {}, h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => openSceneEditor(S, s, refresh) }, 'Edit'), h('button', { class: 'btn sm good', disabled: !S.can('review'), onclick: async () => { await post(`/api/projects/${p.id}/scenes/${s.id}/review`, { status: 'approved' }); refresh(); } }, '✓'), h('button', { class: 'btn sm danger', disabled: !S.can('review'), onclick: () => rejectDialog(S, s, refresh) }, '✗'))));
    }))))),
    h('div', { class: 'card' }, h('h2', {}, 'All project assets'), assets.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['File', 'Kind', 'Produced by', 'Size', 'Licence', ''].map((x) => h('th', {}, x)))), h('tbody', {}, assets.filter((a) => a.meta.key !== 'preview').map((a) => h('tr', {}, h('td', {}, h('a', { href: `/api/assets/${a.id}/file`, target: '_blank', rel: 'noopener' }, a.filename), a.scene_id && h('div', { class: 'small muted' }, 'scene ' + (p.package.scenes.findIndex((s) => s.id === a.scene_id) + 1))), h('td', {}, a.kind), h('td', {}, a.media_type.replace('_', ' '), h('div', { class: 'small muted' }, a.provider)), h('td', {}, fmtBytes(a.bytes)), h('td', {}, lic(a), h('div', { class: 'small muted' }, a.license?.source || '')), h('td', {}, h('button', { class: 'btn sm', disabled: !S.can('write'), onclick: () => licenseDialog(S, a, refresh) }, 'Licence'), ' ', h('button', { class: 'btn sm danger', disabled: !S.can('write'), onclick: async () => { if (await confirmDialog('Delete this file?', a.filename, { danger: true, ok: 'Delete' })) { await del(`/api/assets/${a.id}`); refresh(); } } }, '🗑'))))))) : h('p', { class: 'muted' }, 'No assets yet. Narration, music and renders appear here once generated.'))));
}

export function licenseDialog(S, a, done) {
  const f = { source: h('input', { value: a.license?.source || '' }), license: h('input', { value: a.license?.license || '' }), commercial: h('input', { type: 'checkbox', checked: a.license?.commercialUse === true }), attribution: h('input', { value: a.license?.attribution || '' }), proof: h('input', { value: a.license?.proofUrl || '' }) };
  modal((close) => [h('h2', {}, 'Licence — ' + a.filename), h('div', { class: 'stack' }, field('Source', f.source), field('Licence', f.license), h('label', { class: 'check' }, f.commercial, 'Commercial use is permitted'), field('Attribution', f.attribution), field('Proof URL / receipt', f.proof), h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => { try { await patch(`/api/assets/${a.id}`, { license: { source: f.source.value, license: f.license.value, commercialUse: f.commercial.checked, attribution: f.attribution.value, proofUrl: f.proof.value } }); close(); done(); } catch (e) { fail(e); } } }, 'Save')))]);
}
