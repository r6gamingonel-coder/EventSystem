import { get, put } from '../api.js';
import { h, field, select, toast, fail, badge, empty } from '../ui.js';

const GUIDE = {
  anthropic: 'Create a key at console.anthropic.com → set ANTHROPIC_API_KEY (optional ANTHROPIC_MODEL, default claude-opus-5-5). Paid per token.',
  openai: 'Create a key at platform.openai.com → set OPENAI_API_KEY (optional OPENAI_TEXT_MODEL). Paid per token.',
  openai_compatible: 'Run a local server such as Ollama, then set OPENAI_COMPAT_BASE_URL=http://localhost:11434/v1 and OPENAI_COMPAT_MODEL=<your model>. Free; quality depends on the model.',
  offline_templates: 'Built in. Curated Arabic lesson kits (colours, numbers, letters, shapes, animals, habits, plants, days, a story, a song).',
  espeak: 'Free local draft voice. Linux: sudo apt install espeak-ng · macOS: brew install espeak-ng. Robotic — for drafts only.',
  import: 'Record your own narration (best quality, no licence issues) and import it per scene.',
  azure: 'Azure AI Speech → create a Speech resource → set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION. Has Iraqi Arabic voices (ar-IQ). Free tier may exist; verify pricing.',
  elevenlabs: 'Set ELEVENLABS_API_KEY and enter a voice id you are licensed to use. Commercial use needs a paid plan — verify. Never clone a real person’s voice without permission.',
  google: 'Enable Cloud Text-to-Speech, create an API key → set GOOGLE_TTS_API_KEY.',
  local_svg: 'Built in. Draws backgrounds, characters and props from the EA KIDS art library.',
};

export async function render(root, S) {
  const st = await get('/api/system/status'); const c = st.capabilities; const prov = S.settings.providers;
  const sel = (kind, cur) => select(Object.entries(c.providers[kind]).map(([k, v]) => [k, `${k}${v.configured ? '' : ' — not configured'}${v.paid ? ' (paid)' : ' (free)'}`]), cur);
  const llm = sel('llm', prov.llm); const tts = sel('tts', prov.tts); const img = sel('image', prov.image);
  const table = (kind) => h('table', {}, h('thead', {}, h('tr', {}, ['Provider', 'Status', 'Cost', 'How to configure'].map((x) => h('th', {}, x)))), h('tbody', {}, Object.entries(c.providers[kind]).map(([k, v]) => h('tr', {}, h('td', {}, h('b', {}, k)), h('td', {}, v.configured ? badge('ready', 'ok') : badge('not configured', 'warn')), h('td', {}, v.paid ? badge('paid', 'warn') : badge('free', 'ok')), h('td', { class: 'small' }, GUIDE[k] || '', v.env && !v.configured && h('div', { class: 'mono' }, v.env))))));
  root.append(h('div', { class: 'stack-lg' }, h('h1', {}, '🔌 AI & media providers'),
    h('div', { class: 'callout' }, 'API keys live only in the server’s environment (', h('code', {}, '.env'), '). They are never sent to the browser or logged — this page shows whether a variable is set, not its value. Restart the server after editing ', h('code', {}, '.env'), '.'),
    h('div', { class: 'card' }, h('h2', {}, 'Defaults'), h('div', { class: 'grid g3' }, field('Script generation', llm), field('Narration', tts), field('Images', img)), h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn primary', disabled: !S.can('admin'), onclick: async () => { try { const r = await put('/api/system/settings', { ...S.settings, providers: { llm: llm.value, tts: tts.value, image: img.value } }); S.settings = r.settings; toast('Defaults saved', 'ok'); } catch (e) { fail(e); } } }, 'Save defaults'))),
    h('div', { class: 'card' }, h('h2', {}, 'Script & storyboard (LLM)'), table('llm')), h('div', { class: 'card' }, h('h2', {}, 'Narration (text-to-speech)'), table('tts')),
    h('div', { class: 'card' }, h('h2', {}, 'Images & video'), table('image'), h('div', { class: 'callout warn', style: { marginTop: '10px' } }, h('b', {}, 'Video generation: '), c.providers.video_generation.note), h('p', { class: 'small muted' }, 'Scene art is drawn locally. The OpenAI image option is listed for roadmap parity but scenes currently use the local library or files you import.')),
    h('div', { class: 'card' }, h('h2', {}, 'Local tools'), h('dl', { class: 'kv' }, h('dt', {}, 'FFmpeg'), h('dd', {}, c.ffmpeg.ok ? [badge('ready', 'ok'), ' ', c.ffmpeg.version] : [badge('missing', 'bad'), ' ', c.ffmpeg.install]), h('dt', {}, 'FFmpeg filters'), h('dd', {}, c.ffmpeg.filters ? Object.entries(c.ffmpeg.filters).map(([k, v]) => badge(`${k}: ${v ? 'yes' : 'no'}`, v ? 'ok' : 'bad')) : '—'), h('dt', {}, 'ffprobe'), h('dd', {}, c.ffprobe.ok ? badge('ready', 'ok') : badge('missing', 'bad')), h('dt', {}, 'espeak-ng'), h('dd', {}, c.espeak.ok ? badge('ready', 'ok') : [badge('not installed', 'warn'), ' ', c.espeak.install]), h('dt', {}, 'Bundled fonts'), h('dd', {}, c.fonts.files.join(', ')), h('dt', {}, 'Node'), h('dd', {}, st.node))),
    h('p', { class: 'small muted' }, 'Setup guide: docs/PROVIDERS.md.')));
}
