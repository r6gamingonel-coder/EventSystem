import { get, post, del } from '../api.js';
import { h, field, select, toast, fail, badge, statusBadge, jobPanel, empty, fmtDur, fmtBytes, fmtDate, confirmDialog } from '../ui.js';

const COLORS = ['#FF7A3D', '#3FA9F5', '#3CC47C', '#FF5C8A', '#7B5BF2', '#FFC93C'];

export async function render(root, S) {
  const p = S.project;
  if (!p) return root.append(empty('🎬', 'No project selected', 'Create or pick a project first.'));
  const refresh = async () => { root.replaceChildren(); await render(root, S); };
  const [tl, nar, rend] = await Promise.all([get(`/api/projects/${p.id}/timeline`), get(`/api/projects/${p.id}/narration`), get(`/api/projects/${p.id}/renders`)]);
  const fmt = S.registry.formats[p.format];
  const sceneSel = select([['', 'Whole video'], ...p.package.scenes.map((s, i) => [s.id, `Scene ${i + 1}: ${s.title}`])], '');
  const mode = select([['preview', 'Preview — fast, low resolution (check before exporting)'], ['final', `Final — ${fmt.width}×${fmt.height} MP4`]], 'preview');
  const fps = select([24, 25, 30, 50, 60].map((x) => [x, `${x} fps${x === 30 ? ' (default)' : ''}`]), S.settings.fps || 30);
  const burn = h('input', { type: 'checkbox', checked: true }); const audio = h('input', { type: 'checkbox' });
  const panel = jobPanel(); const result = h('div'); let jobId = null;
  const stale = nar.status.filter((s) => ['missing', 'stale'].includes(s.state));
  const rejected = p.package.scenes.filter((s) => s.review.status === 'rejected');
  const pre = [];
  if (rejected.length) pre.push(['bad', `${rejected.length} rejected scene(s) block rendering: ${rejected.map((s) => s.title).join(', ')}`, '#/storyboard']);
  if (stale.length) pre.push(['warn', `${stale.length} scene(s) have missing/outdated narration. Final render requires it (preview uses estimated timing).`, '#/voice']);
  p.package.scenes.filter((s) => ['ai_video_clip', 'imported_video'].includes(s.visual.mediaType) && !s.visual.importedAssetId).forEach((s) => pre.push(['bad', `Scene “${s.title}” needs a video clip attached.`, '#/media']));

  const start = async () => {
    try {
      const r = await post(`/api/projects/${p.id}/render`, { mode: mode.value, sceneIds: sceneSel.value ? [sceneSel.value] : undefined, burnCaptions: burn.checked, fps: mode.value === 'final' ? +fps.value : undefined, exportAudio: audio.checked || undefined });
      jobId = r.job.id; cancelBtn.hidden = false; result.replaceChildren();
      const j = await panel.track(jobId, mode.value === 'final' ? 'Final render' : 'Preview');
      cancelBtn.hidden = true;
      if (j?.status === 'succeeded') { await S.loadProject(); show(j.result); refreshList(); }
      else if (j?.status === 'failed') result.replaceChildren(h('div', { class: 'callout bad' }, h('b', {}, j.error?.message), j.error?.hint && h('div', {}, j.error.hint), h('button', { class: 'btn sm', style: { marginTop: '8px' }, onclick: async () => { await post(`/api/jobs/${j.id}/retry`); toast('Re-queued — cached scenes are reused', 'info'); const j2 = await panel.track(j.id, 'Render (retry)'); if (j2?.status === 'succeeded') { show(j2.result); refreshList(); } } }, '↻ Retry')));
    } catch (e) { fail(e); }
  };
  const cancelBtn = h('button', { class: 'btn danger', hidden: true, onclick: async () => { try { await post(`/api/jobs/${jobId}/cancel`); toast('Cancelling…', 'warn'); } catch (e) { fail(e); } } }, 'Cancel render');
  const show = (res) => {
    result.replaceChildren(h('div', { class: 'card ' + (res.qc.passed ? 'good' : 'bad') }, h('h2', {}, res.qc.passed ? '✅ Quality checks passed' : '⚠️ Quality checks failed'),
      h('video', { controls: true, src: `/api/assets/${res.assetId}/file`, style: { maxHeight: '520px', maxWidth: p.format === 'shorts' ? '300px' : '100%' } }),
      h('div', { class: 'row', style: { margin: '8px 0' } }, h('a', { class: 'btn sm', href: `/api/assets/${res.assetId}/file?download=1` }, '⬇ Download MP4'), res.mode === 'final' && [h('a', { class: 'btn sm', href: `/api/projects/${p.id}/subtitles.srt` }, '⬇ SRT'), h('a', { class: 'btn sm', href: `/api/projects/${p.id}/subtitles.vtt` }, '⬇ VTT')]),
      h('div', { class: 'stack' }, res.qc.checks.map((c) => h('div', { class: 'chk' }, h('span', { class: 'st' }, { pass: '✅', warn: '🟡', fail: '❌' }[c.status]), h('div', {}, h('b', {}, c.label), c.detail && h('div', { class: 'small muted' }, c.detail))))),
      h('div', { class: 'callout small', style: { marginTop: '8px' } }, h('b', {}, 'How this video was made: '), Object.entries(res.summary.sceneMediaTypes).map(([k, v]) => `${v}× ${k.replace('_', ' ')}`).join(', '), ` · narration: ${res.summary.narration.join(', ')} · music: ${res.summary.music} · AI-generated video scenes: ${res.summary.aiGeneratedVideoScenes}`)));
  };
  const list = h('div'); const refreshList = async () => { const r = (await get(`/api/projects/${p.id}/renders`)).renders; list.replaceChildren(r.length ? h('table', {}, h('thead', {}, h('tr', {}, ['When', 'Type', 'Length', 'Size', 'QC', ''].map((x) => h('th', {}, x)))), h('tbody', {}, r.map((a) => h('tr', {}, h('td', { class: 'small' }, fmtDate(a.created_at)), h('td', {}, badge(a.kind, a.kind === 'render' ? 'ok' : 'neutral'), ` ${a.width}×${a.height}`), h('td', {}, fmtDur(a.duration_ms / 1000)), h('td', {}, fmtBytes(a.bytes)), h('td', {}, a.meta.qc ? (a.meta.qc.passed ? badge('passed', 'ok') : badge('failed', 'bad')) : '—'), h('td', {}, h('button', { class: 'btn sm', onclick: () => show({ assetId: a.id, qc: a.meta.qc, summary: a.meta.summary, mode: a.meta.mode }) }, 'Open'), ' ', h('button', { class: 'btn sm danger', onclick: async () => { await del(`/api/assets/${a.id}`); refreshList(); } }, '🗑')))))) : h('p', { class: 'muted' }, 'No renders yet.')); }; refreshList();

  root.append(h('div', { class: 'stack-lg' }, h('h1', {}, '🎬 Render & preview'),
    h('div', { class: 'card' }, h('h2', {}, `Timeline — ${fmtDur(tl.totalSec)}`), h('div', { class: 'timeline', role: 'img', 'aria-label': 'Scene timeline' }, tl.scenes.map((s, i) => h('div', { style: { flex: s.duration, background: COLORS[i % COLORS.length] }, title: `${s.title} — ${s.duration}s${s.narrated ? '' : ' (no narration audio yet)'}` }, s.narrated ? String(i + 1) : `${i + 1}·`))), h('p', { class: 'small muted' }, 'Scene lengths follow the measured narration. “·” = no narration audio yet (estimated length).')),
    pre.length ? h('div', { class: 'stack' }, pre.map(([k, m, href]) => h('div', { class: `callout ${k === 'bad' ? 'bad' : 'warn'}` }, m, ' ', h('a', { href }, 'Fix →')))) : null,
    h('div', { class: 'card' }, h('h2', {}, 'Render'), h('div', { class: 'grid g3' }, field('Mode', mode), field('What', sceneSel), field('Frame rate (final)', fps)),
      h('div', { class: 'row', style: { margin: '10px 0' } }, h('label', { class: 'check' }, burn, 'Burn captions into the video'), h('label', { class: 'check' }, audio, 'Also export full audio mix (MP3, final only)')),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', disabled: !S.can('render'), onclick: start }, '▶ Start'), cancelBtn, h('button', { class: 'btn', disabled: !S.can('render'), onclick: async () => { const r = await del(`/api/projects/${p.id}/render-cache`); toast(`Freed ${fmtBytes(r.freedBytes)}`, 'ok'); } }, 'Clear render cache')), panel.node,
      h('p', { class: 'small muted' }, 'Rendering runs locally in the background. Closing this page does not stop it. If it fails, “Retry” reuses every scene that already rendered. Presets: YouTube 1920×1080 (16:9) and Shorts 1080×1920 (9:16).')),
    result, h('div', { class: 'card' }, h('h2', {}, 'Previous renders'), list)));
}
