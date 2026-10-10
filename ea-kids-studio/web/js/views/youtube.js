import { get, post, put } from '../api.js';
import { h, field, select, toast, fail, badge, statusBadge, jobPanel, empty, modal, confirmDialog, fmtDate } from '../ui.js';

const ICON = { pass: '✅', fail: '❌', warn: '🟡', manual: '👁️' };

export async function render(root, S) {
  const p = S.project;
  if (!p) return root.append(empty('🚀', 'No project selected', 'Create or pick a project first.'));
  const refresh = async () => { await S.loadProject(); root.replaceChildren(); await render(root, S); };
  const [ev, yt, manualItems, uploads] = await Promise.all([get(`/api/projects/${p.id}/compliance`), get('/api/youtube/status'), get('/api/compliance/manual-items'), get(`/api/youtube/uploads?projectId=${p.id}`)]);
  root.append(h('div', { class: 'stack-lg' }, h('h1', {}, '🚀 Compliance & YouTube'),
    h('div', { class: 'callout' }, h('b', {}, 'Nothing is ever uploaded or published automatically. '), 'A human reviews, the compliance gate passes, and the owner approves each upload.'),
    compliance(S, p, ev, manualItems.items, refresh), connection(S, yt, refresh), await publish(S, p, ev, yt, uploads.uploads, refresh), await manualExport(p)));
}

function compliance(S, p, ev, manualItems, refresh) {
  const groups = {}; ev.items.forEach((i) => { (groups[i.section] = groups[i.section] || []).push(i); });
  const aud = ev.review?.audience || {}; const manual = ev.review?.checks?.manual || {};
  const kidsYes = h('input', { type: 'radio', name: 'mfk', checked: aud.madeForKids === true }); const kidsNo = h('input', { type: 'radio', name: 'mfk', checked: aud.madeForKids === false });
  const why = h('textarea', { dir: 'auto', rows: 3, placeholder: 'Why is this the right audience setting? (e.g. cartoon educational video for ages 3–6)' }, aud.rationale || '');
  const boxes = manualItems.map((m) => ({ id: m.id, el: h('input', { type: 'checkbox', checked: !!manual[m.id] }), label: m.label }));
  const save = async () => {
    try {
      const body = { manual: Object.fromEntries(boxes.map((b) => [b.id, b.el.checked])) };
      if (kidsYes.checked || kidsNo.checked) body.audience = { madeForKids: kidsYes.checked, rationale: why.value };
      await put(`/api/projects/${p.id}/compliance/review`, body); toast('Review saved', 'ok'); refresh();
    } catch (e) { fail(e); }
  };
  const a = ev.audienceAssessment;
  return h('div', { class: 'grid g2' },
    h('div', { class: 'stack' },
      h('div', { class: `card ${ev.approval.approved ? 'good' : ev.approval.stale ? 'warn' : ''}` }, h('h2', {}, 'Publish gate'), ev.approval.approved ? h('div', { class: 'callout ok' }, '✅ Approved ', fmtDate(ev.approval.approvedAt), '. Any later change to scenes, metadata, thumbnail or video voids this approval.') : ev.approval.stale ? h('div', { class: 'callout warn' }, '⚠ The approval is out of date because the content changed. Review again and re-approve.') : h('div', { class: `callout ${ev.blockers ? 'bad' : 'ok'}` }, ev.blockers ? `${ev.blockers} blocking item(s) to fix` : 'No blockers — you can approve.', ev.warnings ? ` · ${ev.warnings} warning(s)` : ''),
        h('div', { class: 'row', style: { marginTop: '10px' } }, h('button', { class: 'btn good', disabled: !S.can('review') || !ev.canApprove || ev.approval.approved, onclick: async () => { try { await post(`/api/projects/${p.id}/compliance/approve`); toast('Approved for upload', 'ok'); refresh(); } catch (e) { fail(e); } } }, '✓ Approve for publishing'), h('button', { class: 'btn', disabled: !S.can('review'), onclick: async () => { await post(`/api/projects/${p.id}/compliance/request-changes`, { notes: prompt('What needs to change?') || '' }); refresh(); } }, 'Request changes'))),
      h('div', { class: 'card' }, h('h2', {}, 'Audience designation'), h('div', { class: `callout ${a.likelyMadeForKids ? 'warn' : ''}` }, h('b', {}, a.likelyMadeForKids ? 'This looks like content made for kids.' : 'Review audience carefully.'), h('div', { class: 'small' }, a.guidance), h('ul', { class: 'small' }, a.signals.map((s) => h('li', {}, s)))),
        h('div', { class: 'stack', style: { marginTop: '10px' } }, h('label', { class: 'check' }, kidsYes, h('span', {}, h('b', {}, 'Yes, it’s made for kids'), ' — comments, personalised ads, notifications and some features are switched off by YouTube.')), h('label', { class: 'check' }, kidsNo, h('span', {}, h('b', {}, 'No, it’s not made for kids'), ' — only if you are certain the video is not directed at children.')), field('Reason', why), h('p', { class: 'small muted' }, 'YouTube Kids app inclusion is separate and cannot be requested. Monetization eligibility is separate again. See the Monetization page.'))),
      h('div', { class: 'card' }, h('h2', {}, 'Owner confirmations'), h('div', { class: 'stack' }, boxes.map((b) => h('label', { class: 'check' }, b.el, b.label)), h('div', {}, h('button', { class: 'btn primary', disabled: !S.can('review'), onclick: save }, 'Save review'))))),
    h('div', { class: 'card' }, h('h2', {}, 'Automated checks'), Object.entries(groups).map(([sec, items]) => h('div', { style: { marginBottom: '10px' } }, h('h3', {}, sec), items.map((i) => h('div', { class: 'chk' }, h('span', { class: 'st' }, ICON[i.status] || '•'), h('div', {}, h('b', {}, i.label), i.detail && h('div', { class: 'small muted', dir: 'auto' }, i.detail), i.status === 'fail' && i.fix && h('div', { class: 'small' }, '➜ ', i.fix))))))));
}

function connection(S, yt, refresh) {
  const scopes = { upload: h('input', { type: 'checkbox', checked: true }), read: h('input', { type: 'checkbox', checked: true }), analytics: h('input', { type: 'checkbox', checked: true }), manage: h('input', { type: 'checkbox' }), revenue: h('input', { type: 'checkbox' }) };
  const row = (k, label, hint) => h('label', { class: 'check' }, scopes[k], h('span', {}, label, h('div', { class: 'small muted' }, hint)));
  return h('div', { class: 'card' }, h('h2', {}, 'YouTube channel connection'),
    !yt.configured ? h('div', { class: 'callout warn' }, h('b', {}, 'YouTube API is not configured yet.'), h('div', {}, yt.setup), h('div', { class: 'small' }, 'Everything else still works — use the manual export below to upload in YouTube Studio.')) : null,
    yt.connected ? h('div', { class: 'stack' }, h('div', { class: 'callout ok' }, `✅ Connected to “${yt.channel?.title || 'your channel'}”`, h('div', { class: 'small' }, 'Permissions: ', yt.scopes.map((s) => s.split('/').pop()).join(', '))), h('div', { class: 'row' }, h('button', { class: 'btn', disabled: !S.can('publish'), onclick: async () => { try { await post('/api/youtube/refresh'); toast('Channel refreshed', 'ok'); refresh(); } catch (e) { fail(e); } } }, 'Refresh channel info'), h('button', { class: 'btn danger', disabled: !S.can('publish'), onclick: async () => { if (await confirmDialog('Disconnect YouTube?', 'Tokens are deleted from this server. You can reconnect any time.', { danger: true, ok: 'Disconnect' })) { await post('/api/youtube/disconnect'); refresh(); } } }, 'Disconnect')))
      : yt.configured ? h('div', { class: 'stack' }, h('p', { class: 'small' }, 'You sign in on Google’s own page (OAuth). EA KIDS Studio never sees your Google password. Redirect URI to register: ', h('code', { class: 'mono' }, yt.redirectUri)), h('b', {}, 'Permissions to request (least privilege)'), row('upload', 'Upload videos', 'Required to upload.'), row('read', 'View channel info', 'Channel name check.'), row('analytics', 'View analytics', 'Views, watch time, retention — no revenue.'), row('manage', 'Manage playlists', 'Broader “manage your YouTube account” scope; only if you want playlist sync.'), row('revenue', 'View revenue analytics', 'Only for monetised channels; shown as ESTIMATED revenue, never earnings.'),
        h('div', {}, h('button', { class: 'btn primary', disabled: !S.can('publish'), onclick: async () => { try { const { url } = await post('/api/youtube/connect', { scopes: Object.entries(scopes).filter(([, el]) => el.checked).map(([k]) => k) }); location.href = url; } catch (e) { fail(e); } } }, 'Connect with Google'))) : null);
}

async function publish(S, p, ev, yt, uploads, refresh) {
  const privacy = select([['private', 'Private (recommended first)'], ['unlisted', 'Unlisted'], ['public', 'Public']], 'private'); const when = h('input', { type: 'datetime-local' });
  const pl = h('input', { value: p.package.metadata.playlist, dir: 'auto', placeholder: 'Playlist (optional)' });
  const out = h('div'); const panel = jobPanel();
  const dry = async () => {
    try {
      const body = { privacy: when.value ? 'private' : privacy.value, playlist: pl.value || undefined, ...(when.value ? { publishAt: new Date(when.value).toISOString() } : {}) };
      const d = await post(`/api/projects/${p.id}/youtube/dry-run`, body);
      const conf = h('input', { placeholder: 'Type UPLOAD' }); const pub = h('input', { type: 'checkbox' });
      out.replaceChildren(h('div', { class: `card ${d.wouldUpload ? 'good' : 'warn'}` }, h('h2', {}, 'Dry run — exactly what would be sent'), h('div', { class: 'callout small' }, d.privacyNote),
        d.problems.length ? h('div', { class: 'callout bad' }, h('b', {}, 'Cannot upload yet:'), h('ul', {}, d.problems.map((x) => h('li', {}, x)))) : h('div', { class: 'callout ok' }, '✅ Ready to upload'),
        h('pre', { class: 'log', dir: 'ltr' }, JSON.stringify(d.payload, null, 2)),
        h('dl', { class: 'kv' }, h('dt', {}, 'Video'), h('dd', {}, d.video ? `${d.video.filename} — ${(d.video.bytes / 1e6).toFixed(1)} MB, ${Math.round(d.video.durationSec)} s` : '—'), h('dt', {}, 'Thumbnail'), h('dd', {}, d.thumbnail ? `${(d.thumbnail.bytes / 1024).toFixed(0)} KB ${d.thumbnail.mime}` : 'none'), h('dt', {}, 'Playlist'), h('dd', {}, d.playlist || '—'), h('dt', {}, 'Captions'), h('dd', {}, d.captionFiles.join(', ') || '—')),
        h('p', { class: 'small muted' }, 'Captions (SRT/VTT) are exported for you to add in YouTube Studio; this tool does not upload them. Quota: ', d.quotaNote),
        d.wouldUpload && S.user.role === 'owner' ? h('div', { class: 'stack' }, h('hr'), d.payload.status.privacyStatus === 'public' && h('label', { class: 'check' }, pub, h('b', {}, 'I understand this will make the video public as soon as YouTube finishes processing it.')), field('Type UPLOAD to confirm', conf), h('div', {}, h('button', { class: 'btn primary', onclick: async () => { try { const r = await post(`/api/youtube/uploads/${d.uploadId}/approve`, { confirm: conf.value, confirmPublic: pub.checked }); const j = await panel.track(r.job.id, 'YouTube upload'); if (j?.status === 'succeeded') { toast(`Uploaded: ${j.result.url}`, 'ok'); refresh(); } } catch (e) { fail(e); } } }, '⬆ Approve & upload'))) : d.wouldUpload ? h('div', { class: 'callout' }, 'Only the owner can approve the upload.') : null));
    } catch (e) { fail(e); }
  };
  return h('div', { class: 'card' }, h('h2', {}, 'Upload & schedule'),
    h('div', { class: 'grid g3' }, field('Visibility', privacy), field('Schedule (optional)', when, 'Scheduling keeps the video private until the time you choose.'), field('Playlist', pl)),
    h('div', { class: 'row', style: { margin: '10px 0' } }, h('button', { class: 'btn primary', disabled: !S.can('render'), onclick: dry }, '🔍 Dry run (preview upload)')),
    h('p', { class: 'small muted' }, 'The dry run uploads nothing. It builds the exact request, checks the compliance approval and files, and shows what YouTube would receive. ', 'YouTube may force new videos from unverified API projects to private — the result is always shown after upload.'), out, panel.node,
    h('h3', {}, 'Upload history'), uploads.length ? h('table', {}, h('thead', {}, h('tr', {}, ['When', 'Status', 'Visibility', 'Video'].map((x) => h('th', {}, x)))), h('tbody', {}, uploads.map((u) => h('tr', {}, h('td', { class: 'small' }, fmtDate(u.created_at)), h('td', {}, statusBadge(u.status), u.error && h('div', { class: 'small' }, u.error)), h('td', {}, u.payload.payload.status.privacyStatus, u.payload.payload.status.publishAt && ` → ${fmtDate(u.payload.payload.status.publishAt)}`), h('td', {}, u.video_id ? h('a', { href: `https://www.youtube.com/watch?v=${u.video_id}`, target: '_blank', rel: 'noopener noreferrer' }, u.video_id) : '—'))))) : h('p', { class: 'muted small' }, 'Nothing uploaded yet.'));
}

async function manualExport(p) {
  let m; try { m = await get(`/api/projects/${p.id}/manual-export`); } catch (e) { return h('div', { class: 'card' }, h('h2', {}, 'Manual export'), h('p', { class: 'muted' }, e.message)); }
  const copy = (label, text) => h('div', { class: 'stack' }, h('div', { class: 'row spread' }, h('b', {}, label), h('button', { class: 'btn sm', onclick: () => navigator.clipboard?.writeText(text).then(() => toast(`${label} copied`, 'ok')) }, 'Copy')), h('pre', { class: 'log', dir: 'auto', style: { maxHeight: '120px' } }, text));
  return h('div', { class: 'card' }, h('h2', {}, 'Manual export (works without any API)'), h('ol', {}, m.steps.map((s) => h('li', {}, s))),
    h('div', { class: 'grid g2' }, copy('Title', m.title), copy('Tags', m.tags.join(', '))), copy('Description', m.description), h('p', {}, `Audience to choose in Studio: ${m.madeForKids ? 'Yes, it’s made for kids' : 'as decided in Compliance'}`),
    h('div', { class: 'row' }, m.files.map((f) => h('a', { class: 'btn', href: `/api/assets/${f.assetId}/file?download=1` }, `⬇ ${f.label}`))));
}
