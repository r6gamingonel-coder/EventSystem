import { get, del } from '../api.js';
import { h, badge, statusBadge, progressBar, fmtDate, usd, num, empty, fmtDur, confirmDialog, fail } from '../ui.js';

const step = (ok, label, detail, href) => h('a', { href, class: 'row', style: { textDecoration: 'none', color: 'inherit', padding: '6px 0', borderBottom: '1px dashed var(--line)' } }, h('span', { style: { fontSize: '1.2rem' } }, ok === true ? '✅' : ok === 'part' ? '🟡' : '⬜'), h('b', { class: 'grow' }, label), h('span', { class: 'small muted' }, detail));

export async function render(root, S) {
  const [sys, costs, jobs, mon] = await Promise.all([get('/api/system/status'), get('/api/costs/summary'), get('/api/jobs?limit=8'), get('/api/monetization')]);
  const c = sys.capabilities;
  const total = S.projects.length; const by = (s) => S.projects.filter((p) => p.status === s).length;
  const missing = [];
  if (!c.ffmpeg.ok) missing.push(['FFmpeg is not installed — rendering is disabled.', c.ffmpeg.install]);
  else if (!c.ffmpeg.filters?.subtitles) missing.push(['This FFmpeg build has no subtitle (libass) support.', 'Install a full FFmpeg build.']);
  if (!c.espeak.ok) missing.push(['No free local voice (espeak-ng) found. You can still import your own recordings or configure a cloud voice.', c.espeak.install]);

  root.append(h('div', { class: 'stack-lg' },
    h('div', { class: 'row spread' }, h('div', {}, h('h1', {}, 'Welcome to EA KIDS Studio 👋'), h('p', { class: 'muted' }, 'Original, educational, kid-safe videos — scripted, voiced, rendered and reviewed by you.')), h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => window.dispatchEvent(new CustomEvent('new-project')) }, '＋ New project'))),
    missing.length > 0 && h('div', { class: 'callout warn' }, h('b', {}, 'Setup needed'), missing.map(([m, fix]) => h('div', {}, '• ', m, ' ', h('span', { class: 'small' }, fix)))),
    h('div', { class: 'grid g4' },
      h('div', { class: 'card stat' }, h('b', {}, num(total)), h('span', {}, 'projects')),
      h('div', { class: 'card stat' }, h('b', {}, num(by('rendered') + by('approved'))), h('span', {}, 'rendered / approved')),
      h('div', { class: 'card stat' }, h('b', {}, num(by('published') + by('scheduled'))), h('span', {}, 'published / scheduled')),
      h('div', { class: 'card stat' }, h('b', {}, usd(costs.spentMonthUsd)), h('span', {}, `spent this month (limit ${costs.limits.monthlyUsd ? usd(costs.limits.monthlyUsd, 0) : 'not set — paid providers blocked'})`))),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', {}, S.project ? `Pipeline — ${S.project.title}` : 'Pipeline'),
        S.project ? await pipeline(S) : empty('🎬', 'No project selected', 'Create a project, or pick one at the top.', h('button', { class: 'btn primary', onclick: () => window.dispatchEvent(new CustomEvent('new-project')) }, '＋ New project'))),
      h('div', { class: 'card' }, h('h2', {}, 'This machine'),
        h('dl', { class: 'kv' },
          h('dt', {}, 'FFmpeg'), h('dd', {}, c.ffmpeg.ok ? badge('ready', 'ok') : badge('missing', 'bad'), ' ', h('span', { class: 'small muted' }, c.ffmpeg.version?.slice(0, 40) || '')),
          h('dt', {}, 'Free voice'), h('dd', {}, c.espeak.ok ? badge('espeak-ng (draft quality)', 'ok') : badge('not installed', 'warn')),
          h('dt', {}, 'Fonts'), h('dd', {}, c.fonts.ok ? badge(`${c.fonts.files.length} bundled`, 'ok') : badge('missing', 'bad')),
          h('dt', {}, 'AI scripts'), h('dd', {}, badge('offline lesson kits', 'ok'), ' ', ['anthropic', 'openai', 'openai_compatible'].filter((k) => c.providers.llm[k].configured).map((k) => badge(k, 'info'))),
          h('dt', {}, 'YouTube API'), h('dd', {}, c.youtube.configured ? badge('credentials set', 'ok') : badge('not configured — manual export works', 'neutral')),
          h('dt', {}, 'Video generation'), h('dd', {}, badge('none (local animation pipeline)', 'neutral'))),
        h('p', { class: 'small muted' }, c.providers.video_generation.note))),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', {}, 'Recent projects'), S.projects.length ? h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Title', 'Type', 'Status', 'Length', 'Updated', ''].map((x) => h('th', {}, x)))), h('tbody', {}, S.projects.slice(0, 8).map((p) => h('tr', {}, h('td', { dir: 'auto' }, p.title), h('td', {}, p.format === 'shorts' ? 'Short' : 'Video'), h('td', {}, statusBadge(p.status)), h('td', {}, p.durationSec ? fmtDur(p.durationSec) : '—'), h('td', { class: 'small' }, fmtDate(p.updated_at)), h('td', {}, h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { localStorage.setItem('eak.project', p.id); location.reload(); } }, 'Open'), S.can('admin') && h('button', { class: 'btn sm danger', 'aria-label': 'Delete project', onclick: async () => { if (await confirmDialog('Delete this project?', `“${p.title}” and all its media will be permanently deleted. Make a backup first if unsure.`, { danger: true, ok: 'Delete forever' })) { try { await del(`/api/projects/${p.id}`); if (localStorage.getItem('eak.project') === p.id) localStorage.removeItem('eak.project'); location.reload(); } catch (e) { fail(e); } } } }, '🗑')))))))) : h('p', { class: 'muted' }, 'Nothing yet.')),
      h('div', { class: 'card' }, h('h2', {}, 'Recent jobs'), jobs.jobs.length ? jobs.jobs.map((j) => h('div', { class: 'row', style: { padding: '4px 0' } }, statusBadge(j.status), h('b', {}, j.type), h('span', { class: 'small muted grow' }, j.message), h('span', { class: 'small muted' }, fmtDate(j.created_at)))) : h('p', { class: 'muted' }, 'No jobs yet.'))),
    h('div', { class: 'card accent' }, h('h2', {}, 'Monetization readiness'), h('div', { class: 'row' }, h('div', { class: 'grow' }, progressBar(mon.progress / 100)), h('b', {}, `${mon.progress}%`)), h('p', { class: 'small muted' }, mon.note, ' ', h('a', { href: '#/monetization' }, 'Open checklist'))),
  ));
}

async function pipeline(S) {
  const p = S.project; const sc = p.package.scenes; const d = S.projectData;
  const approved = sc.filter((s) => s.review.status === 'approved').length;
  const [nar, comp] = await Promise.all([get(`/api/projects/${p.id}/narration`), get(`/api/projects/${p.id}/compliance`)]);
  const need = nar.status.filter((s) => s.state !== 'not_needed'); const fresh = need.filter((s) => s.state === 'fresh').length;
  const finals = d.assets.filter((a) => a.kind === 'render' && a.meta.key === 'final');
  const up = (await get(`/api/youtube/uploads?projectId=${p.id}`)).uploads.find((u) => u.status === 'uploaded');
  return h('div', {},
    step(sc.length ? true : false, 'Script & storyboard', `${sc.length} scenes`, '#/script'),
    step(approved === sc.length && sc.length ? true : approved ? 'part' : false, 'Scenes reviewed', `${approved}/${sc.length} approved`, '#/storyboard'),
    step(need.length && fresh === need.length ? true : fresh ? 'part' : false, 'Narration', `${fresh}/${need.length} up to date`, '#/voice'),
    step(finals.length ? true : false, 'Final render', finals.length ? `${finals[0].meta.qc?.passed ? 'QC passed' : 'QC issues'} · ${fmtDur(finals[0].meta.durationSec)}` : 'not rendered', '#/render'),
    step(p.package.thumbnail.selectedAssetId ? true : false, 'Thumbnail', p.package.thumbnail.selectedAssetId ? 'selected' : 'not chosen', '#/thumbnails'),
    step(comp.approval.approved ? true : comp.blockers ? false : 'part', 'Compliance review', comp.approval.approved ? 'approved' : `${comp.blockers} blocking item(s)`, '#/youtube'),
    step(up ? true : false, 'Uploaded to YouTube', up ? up.video_id : 'not uploaded', '#/youtube'));
}
