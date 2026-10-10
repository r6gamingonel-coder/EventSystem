import { get, post, put, patch } from '../api.js';
import { h, field, select, toast, fail, badge, fmtDate, fmtBytes, modal, confirmDialog, empty } from '../ui.js';

export async function render(root, S) {
  const cfg = S.settings; const owner = S.can('admin');
  const f = { name: h('input', { value: cfg.channelName, disabled: !owner }), lang: select([['ar', 'Arabic'], ['en', 'English']], cfg.defaultLanguage, { disabled: !owner }), fmt: select([['landscape', 'Landscape'], ['shorts', 'Shorts']], cfg.defaultFormat, { disabled: !owner }), fps: select([24, 25, 30, 50, 60], cfg.fps, { disabled: !owner }) };
  const cur = h('input', { type: 'password', autocomplete: 'current-password' }); const nw = h('input', { type: 'password', autocomplete: 'new-password' });
  root.append(h('div', { class: 'stack-lg' }, h('h1', {}, '⚙️ Settings, security & backup'),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', {}, 'General'), h('div', { class: 'stack' }, field('Channel name', f.name), h('div', { class: 'grid g3' }, field('Default language', f.lang), field('Default format', f.fmt), field('Default FPS', f.fps)), h('div', {}, h('button', { class: 'btn primary', disabled: !owner, onclick: async () => { try { const r = await put('/api/system/settings', { ...cfg, channelName: f.name.value, defaultLanguage: f.lang.value, defaultFormat: f.fmt.value, fps: +f.fps.value }); S.settings = r.settings; toast('Saved', 'ok'); } catch (e) { fail(e); } } }, 'Save')), h('p', { class: 'small muted' }, 'Human review before publishing is always required and cannot be switched off.'))),
      h('div', { class: 'card' }, h('h2', {}, 'Your password'), h('div', { class: 'stack' }, field('Current password', cur), field('New password (10+ characters, letters and numbers)', nw), h('button', { class: 'btn', onclick: async () => { try { await post('/api/auth/password', { current: cur.value, next: nw.value }); cur.value = nw.value = ''; toast('Password changed; other devices were signed out', 'ok'); } catch (e) { fail(e); } } }, 'Change password')))),
    owner ? await users(S) : null, owner ? await backups(S) : null, owner ? await system(S) : null,
    h('div', { class: 'card' }, h('h2', {}, 'Security notes'), h('ul', { class: 'small' }, h('li', {}, 'The dashboard listens on 127.0.0.1 by default. Before exposing it (HOST=0.0.0.0), put HTTPS in front, set SECURE_COOKIES=true and APP_SECRET — see docs/PRODUCTION_CHECKLIST.md.'), h('li', {}, 'Sessions are HttpOnly + SameSite=Strict cookies with a CSRF token; passwords are hashed with scrypt; YouTube tokens are encrypted at rest.'), h('li', {}, 'Uploads are type-checked by content and size-limited; media is only served to signed-in users.'))),
    !owner && h('div', { class: 'callout' }, 'Users, backups and diagnostics are visible to the owner only.')));
}

async function users(S) {
  const { users: list } = await get('/api/auth/users');
  const e = { email: h('input', { type: 'email' }), name: h('input'), pw: h('input', { type: 'password', autocomplete: 'new-password' }), role: select(['editor', 'reviewer', 'viewer', 'owner'], 'editor') };
  const roles = h('div', { class: 'small muted' }, 'owner: everything · editor: create, generate, render (no spending/publishing) · reviewer: approve scenes & compliance · viewer: read-only');
  return h('div', { class: 'card' }, h('h2', {}, 'Users & roles'), h('table', {}, h('thead', {}, h('tr', {}, ['Email', 'Name', 'Role', 'Status', ''].map((x) => h('th', {}, x)))), h('tbody', {}, list.map((u) => h('tr', {}, h('td', {}, u.email), h('td', {}, u.name), h('td', {}, select(['owner', 'editor', 'reviewer', 'viewer'], u.role, { disabled: u.id === S.user.id, onchange: async (ev) => { try { await patch(`/api/auth/users/${u.id}`, { role: ev.target.value }); toast('Role updated', 'ok'); } catch (x) { fail(x); } } })), h('td', {}, u.disabled ? badge('disabled', 'bad') : badge('active', 'ok')), h('td', {}, u.id !== S.user.id && h('button', { class: 'btn sm', onclick: async () => { await patch(`/api/auth/users/${u.id}`, { disabled: !u.disabled }); location.reload(); } }, u.disabled ? 'Enable' : 'Disable')))))), roles,
    h('div', { class: 'row', style: { marginTop: '10px' } }, e.email, e.name, e.pw, e.role, h('button', { class: 'btn primary', onclick: async () => { try { await post('/api/auth/users', { email: e.email.value, name: e.name.value, password: e.pw.value, role: e.role.value }); toast('User created', 'ok'); location.reload(); } catch (x) { fail(x); } } }, 'Add user')));
}

async function backups(S) {
  const { backups: list } = await get('/api/backups'); const media = h('input', { type: 'checkbox' });
  return h('div', { class: 'card' }, h('h2', {}, 'Backups'), h('p', { class: 'small muted' }, 'A backup is a consistent snapshot of the database (projects, scripts, versions, settings, analytics). Media files are separate — include the media archive for a full backup. Restore steps: docs/PRODUCTION_CHECKLIST.md.'),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: async () => { try { await post('/api/backups', { includeMedia: media.checked }); toast('Backup created', 'ok'); location.reload(); } catch (x) { fail(x); } } }, '💾 Back up now'), h('label', { class: 'check' }, media, 'include media archive (slow, large)')),
    list.length ? h('table', {}, h('tbody', {}, list.map((b) => h('tr', {}, h('td', {}, b.name), h('td', {}, fmtBytes(b.bytes)), h('td', { class: 'small' }, fmtDate(b.createdAt)), h('td', {}, h('a', { class: 'btn sm', href: `/api/backups/${b.name}` }, '⬇')))))) : h('p', { class: 'muted small' }, 'No backups yet.'));
}

async function system(S) {
  const [d, a] = await Promise.all([get('/api/diagnostics'), get('/api/audit')]);
  return h('div', { class: 'grid g2' }, h('div', { class: 'card' }, h('h2', {}, 'Diagnostics'), h('dl', { class: 'kv' }, h('dt', {}, 'Node'), h('dd', {}, d.node), h('dt', {}, 'Listening on'), h('dd', {}, d.bind, ' ', d.secureCookies ? badge('secure cookies', 'ok') : badge('local/dev cookies', 'neutral')), h('dt', {}, 'Environment'), h('dd', {}, d.env), h('dt', {}, 'Database'), h('dd', {}, fmtBytes(d.dbBytes)), h('dt', {}, 'Disk free'), h('dd', {}, d.disk ? `${fmtBytes(d.disk.freeBytes)} of ${fmtBytes(d.disk.totalBytes)}` : 'unknown'), h('dt', {}, 'FFmpeg'), h('dd', {}, d.capabilities.ffmpeg.ok ? d.capabilities.ffmpeg.version : 'missing'))),
    h('div', { class: 'card' }, h('h2', {}, 'Audit log'), h('div', { style: { maxHeight: '260px', overflow: 'auto' } }, a.entries.length ? a.entries.slice(0, 60).map((x) => h('div', { class: 'small', style: { padding: '2px 0', borderBottom: '1px dashed var(--line)' } }, h('b', {}, x.action), ' ', x.email || 'system', ' ', h('span', { class: 'muted' }, fmtDate(x.ts)))) : h('p', { class: 'muted' }, 'Nothing yet.'))));
}
