// App shell: auth screens, navigation, project selector, router, production-log drawer.
import { get, post, setCsrf } from './api.js';
import { h, clear, toast, fail, modal, field, select, activeJobs, progressBar, fmtDate } from './ui.js';

const ROUTES = [
  { group: 'Create', path: 'overview', icon: '🏠', title: 'Overview', view: 'overview' },
  { path: 'ideas', icon: '💡', title: 'Video ideas', view: 'ideas' },
  { path: 'script', icon: '📝', title: 'Script generator', view: 'script' },
  { path: 'storyboard', icon: '🎞️', title: 'Storyboard', view: 'storyboard' },
  { path: 'media', icon: '🖼️', title: 'Scenes & media', view: 'media' },
  { path: 'voice', icon: '🎙️', title: 'Voice & narration', view: 'voice' },
  { path: 'render', icon: '🎬', title: 'Render & preview', view: 'render' },
  { path: 'thumbnails', icon: '🌟', title: 'Thumbnails', view: 'thumbnails' },
  { path: 'metadata', icon: '🏷️', title: 'Titles & SEO', view: 'metadata' },
  { group: 'Publish', path: 'youtube', icon: '🚀', title: 'Compliance & YouTube', view: 'youtube' },
  { path: 'calendar', icon: '🗓️', title: 'Content calendar', view: 'calendar' },
  { path: 'monetization', icon: '💰', title: 'Monetization', view: 'monetization' },
  { group: 'Insights', path: 'analytics', icon: '📈', title: 'Analytics', view: 'analytics' },
  { path: 'costs', icon: '🧾', title: 'Costs & limits', view: 'costs' },
  { group: 'Library', path: 'characters', icon: '🦁', title: 'Characters', view: 'characters' },
  { path: 'brand', icon: '🎨', title: 'Brand kit', view: 'brand' },
  { group: 'System', path: 'providers', icon: '🔌', title: 'AI providers', view: 'providers' },
  { path: 'settings', icon: '⚙️', title: 'Settings & backup', view: 'settings' },
];

export const S = { user: null, perms: [], project: null, projectId: null, projects: [], settings: null, registry: null, caps: null,
  can: (p) => S.perms.includes(p),
  async loadProject(id = S.projectId) {
    if (!id) { S.project = null; return null; }
    try { const d = await get(`/api/projects/${id}`); S.project = d.project; S.projectData = d; S.projectId = id; return d.project; }
    catch (e) { if (e.status === 404) { S.projectId = null; S.project = null; localStorage.removeItem('eak.project'); } else throw e; }
  },
  async loadProjects() { S.projects = (await get('/api/projects')).projects; return S.projects; },
};
const app = document.getElementById('app');
const boot = document.getElementById('boot');

// ------------------------------------------------------------------ auth screens
function authScreen(kind) {
  const err = h('div', { class: 'callout bad', hidden: true });
  const email = h('input', { type: 'email', autocomplete: 'username', required: true, placeholder: 'you@example.com' });
  const pass = h('input', { type: 'password', autocomplete: kind === 'setup' ? 'new-password' : 'current-password', required: true });
  const name = h('input', { type: 'text', placeholder: 'Your name' });
  const token = h('input', { type: 'password', placeholder: 'SETUP_TOKEN (only if not on this machine)' });
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault(); err.hidden = true;
    try {
      if (kind === 'setup') await post('/api/auth/setup', { email: email.value, name: name.value, password: pass.value, setupToken: token.value || undefined });
      const r = await post('/api/auth/login', { email: email.value, password: pass.value });
      setCsrf(r.csrf); await start();
    } catch (x) { err.hidden = false; err.replaceChildren(x.message, x.hint ? h('div', { class: 'small' }, x.hint) : ''); }
  } },
    h('img', { class: 'logo', src: '/brand-assets/logo-main.png', alt: 'EA KIDS', onerror: (e) => e.target.remove() }),
    h('h1', { class: 'center' }, kind === 'setup' ? 'Create the owner account' : 'Sign in'),
    kind === 'setup' && h('p', { class: 'muted small center' }, 'First run. This account controls publishing, spending and settings. Use a strong password (10+ characters, letters and numbers). No Google password is ever requested.'),
    err, kind === 'setup' && field('Name', name), field('Email', email), field('Password', pass), kind === 'setup' && field('Setup token', token, 'Needed only when creating the owner remotely.'),
    h('button', { class: 'btn primary', type: 'submit' }, kind === 'setup' ? 'Create owner & sign in' : 'Sign in'));
  clear(app).hidden = false; boot.hidden = true;
  app.append(h('div', { class: 'login' }, h('div', { class: 'card' }, form)));
}

// ------------------------------------------------------------------ shell
let currentView = null;
async function renderShell() {
  clear(app); app.hidden = false; boot.hidden = true;
  const side = h('aside', { class: 'side', 'aria-label': 'Main navigation' },
    h('div', { class: 'brand' }, h('img', { src: '/brand-assets/profile-800x800.png', alt: '' }), h('div', {}, h('b', {}, 'EA KIDS'), h('small', {}, 'Studio'))),
    h('nav', { class: 'nav' }, ROUTES.map((r) => [r.group && h('div', { class: 'nav-group' }, r.group), h('a', { href: `#/${r.path}`, 'data-path': r.path, onclick: () => side.classList.remove('open') }, h('span', { class: 'ic' }, r.icon), r.title)])));
  const picker = h('select', { 'aria-label': 'Current project', onchange: async (e) => { await setProject(e.target.value || null); route(); } });
  const jobsBtn = h('button', { class: 'btn sm', id: 'jobs-btn', onclick: () => drawer.classList.toggle('min') }, '⏳ Activity');
  const top = h('header', { class: 'top' },
    h('button', { class: 'btn sm menu-btn', 'aria-label': 'Menu', onclick: () => side.classList.toggle('open') }, '☰'),
    h('span', { class: 'muted small' }, 'Project'), picker,
    h('button', { class: 'btn sm primary', onclick: () => newProjectModal() }, '＋ New'),
    h('div', { class: 'grow' }), jobsBtn,
    h('span', { class: 'small muted' }, `${S.user.email} · ${S.user.role}`),
    h('button', { class: 'btn sm', onclick: async () => { await post('/api/auth/logout'); setCsrf(null); location.hash = ''; location.reload(); } }, 'Sign out'));
  const content = h('main', { class: 'content', id: 'view', tabindex: '-1' });
  const drawer = h('div', { class: 'drawer min', id: 'drawer' });
  app.append(h('div', { class: 'shell' }, side, h('div', { class: 'main' }, top, content)), drawer);
  S.picker = picker; S.content = content; S.drawer = drawer;
  fillPicker(); wireDrawer();
}
function fillPicker() {
  clear(S.picker).append(h('option', { value: '' }, S.projects.length ? '— choose a project —' : '— no projects yet —'), ...S.projects.map((p) => h('option', { value: p.id, selected: p.id === S.projectId }, `${p.title} (${p.format === 'shorts' ? 'Short' : 'video'}, ${p.status})`)));
}
async function setProject(id) {
  S.projectId = id; id ? localStorage.setItem('eak.project', id) : localStorage.removeItem('eak.project');
  await S.loadProject(id);
}
function wireDrawer() {
  const render = async () => {
    const jobs = activeJobs(); const btn = document.getElementById('jobs-btn');
    if (btn) btn.textContent = jobs.length ? `⏳ ${jobs.length} running` : '⏳ Activity';
    let logs = [];
    if (S.projectId && !S.drawer.classList.contains('min')) { try { logs = (await get(`/api/projects/${S.projectId}/logs?limit=60`)).logs; } catch { /* ignore */ } }
    S.drawer.replaceChildren(
      h('div', { class: 'dhead', onclick: () => { S.drawer.classList.toggle('min'); render(); } }, h('b', {}, 'Production log'), h('span', { class: 'small', style: { opacity: .8 } }, jobs.length ? jobs.map((j) => `${j.label} ${Math.round((j.progress || 0) * 100)}%`).join(' · ') : 'idle'), h('div', { class: 'grow' }), h('span', {}, S.drawer.classList.contains('min') ? '▲' : '▼')),
      h('div', { class: 'dbody' }, h('div', { class: 'log' }, logs.length ? logs.map((l) => h('div', { class: l.level }, `${new Date(l.ts).toLocaleTimeString()} ${l.message}`)) : 'No log lines for this project yet.')));
  };
  window.addEventListener('jobs-changed', render); setInterval(() => { if (!S.drawer.classList.contains('min')) render(); }, 3000); render();
}

export function newProjectModal() {
  const title = h('input', { placeholder: 'e.g. نتعلم الألوان مع أصدقاء الحيوانات', dir: 'auto' });
  const cat = select((S.registry?.categories || []).map((c) => [c.id, c.label]), 'colors');
  const fmt = select([['landscape', 'YouTube video 16:9'], ['shorts', 'YouTube Short 9:16']], S.settings?.defaultFormat || 'landscape');
  modal((close) => [h('h2', {}, 'New project'), h('div', { class: 'stack' }, field('Title', title), h('div', { class: 'grid g2' }, field('Category', cat), field('Format', fmt)),
    h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn', onclick: close }, 'Cancel'), h('button', { class: 'btn primary', onclick: async () => {
      if (!title.value.trim()) return toast('Give the project a title.', 'warn');
      try { const { project } = await post('/api/projects', { title: title.value.trim(), category: cat.value, format: fmt.value, language: S.settings?.defaultLanguage || 'ar' }); await S.loadProjects(); await setProject(project.id); fillPicker(); close(); toast('Project created', 'ok'); location.hash = '#/script'; route(); } catch (e) { fail(e); }
    } }, 'Create')))]);
}
window.addEventListener('new-project', newProjectModal);

// ------------------------------------------------------------------ router
async function route() {
  const path = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'overview';
  const def = ROUTES.find((r) => r.path === path) || ROUTES[0];
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.path === def.path));
  document.title = `${def.title} — EA KIDS Studio`;
  const root = clear(S.content); root.append(h('div', { class: 'empty' }, h('span', { class: 'spinner' })));
  currentView = def.path;
  try {
    if (S.projectId) await S.loadProject();
    const mod = await import(`./views/${def.view}.js`);
    if (currentView !== def.path) return;
    clear(root);
    await mod.render(root, S, { navigate: (p) => { location.hash = `#/${p}`; }, refresh: route });
    root.focus({ preventScroll: true });
  } catch (e) { clear(root).append(h('div', { class: 'card bad' }, h('h2', {}, 'Something went wrong'), h('p', {}, e.message), e.hint && h('p', { class: 'muted' }, e.hint), h('button', { class: 'btn', onclick: route }, 'Retry'))); console.error(e); }
}
window.addEventListener('hashchange', route);
window.addEventListener('auth-lost', () => { setCsrf(null); start(); });

async function start() {
  boot.hidden = false;
  const st = await get('/api/auth/status');
  if (st.needsSetup) return authScreen('setup');
  if (!st.user) return authScreen('login');
  S.user = st.user; S.perms = st.permissions; setCsrf(st.csrf);
  [S.settings, S.registry] = await Promise.all([get('/api/system/settings').then((r) => r.settings), get('/api/registry')]);
  await S.loadProjects();
  const saved = localStorage.getItem('eak.project');
  S.projectId = S.projects.find((p) => p.id === saved)?.id || S.projects[0]?.id || null;
  if (S.projectId) await S.loadProject();
  await renderShell(); await route();
}
start().catch((e) => { boot.textContent = `Cannot start: ${e.message}`; console.error(e); });
