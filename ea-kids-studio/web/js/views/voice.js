import { get, post, put, patch, del, upload } from '../api.js';
import { h, field, select, toast, fail, badge, statusBadge, jobPanel, withCost, empty, modal, fmtDur } from '../ui.js';

const SAMPLE = { ar: 'مرحبًا يا أصدقائي! هيا نتعلّم الألوان معًا.', en: 'Hello friends! Let us learn colors together.' };

export async function render(root, S) {
  const p = S.project;
  const info = await get('/api/tts/providers');
  const refresh = async () => { root.replaceChildren(); await render(root, S); };
  const cur = info.settings;
  const lang = p?.language || 'ar';
  const provSel = select(info.providers.filter((x) => x.id !== 'import').map((x) => [x.id, `${x.label}${x.configured ? '' : ' — not configured'} · ${x.paid ? 'paid' : 'free'} · ${x.quality}`]), cur.provider);
  const voiceHolder = h('div'); const speed = h('input', { type: 'range', min: 0.6, max: 1.4, step: 0.05, value: cur.speed }); const speedLbl = h('b', {}, `${cur.speed}×`);
  speed.oninput = () => { speedLbl.textContent = `${speed.value}×`; };
  let voiceEl;
  const drawVoice = () => {
    const vs = info.voices[provSel.value]?.[lang] || [];
    voiceEl = provSel.value === 'elevenlabs' ? h('input', { value: cur.voice, placeholder: 'Voice id you are licensed to use' }) : select(vs.map((v) => [v.id, v.label]), cur.voice);
    const meta = info.providers.find((x) => x.id === provSel.value);
    voiceHolder.replaceChildren(field('Voice', voiceEl, meta?.configured ? '' : `Not configured: set ${meta?.env} in .env and restart.`),
      meta?.quality === 'draft' ? h('div', { class: 'callout warn small' }, 'espeak-ng is a free robotic voice for drafts and timing. Use a licensed cloud voice or your own recording for published episodes.') : null,
      meta?.paid ? h('div', { class: 'callout small' }, 'Paid: you will see an estimate and must confirm before anything is generated. Check the provider’s current terms for commercial use. Never use a cloned voice of a real person without written permission.') : null);
  };
  provSel.onchange = () => { cur.voice = ''; drawVoice(); }; drawVoice();
  const sample = h('input', { dir: 'auto', value: SAMPLE[lang] }); const player = h('audio', { controls: true, hidden: true }); const prevPanel = jobPanel();
  const preview = async () => {
    try {
      const r = await withCost((confirmCost) => post('/api/tts/preview', { provider: provSel.value, voice: voiceEl.value, speed: +speed.value, language: lang, text: sample.value, confirmCost }));
      if (!r) return; const j = await prevPanel.track(r.job.id, 'Voice preview');
      if (j?.status === 'succeeded') { player.src = `/api/assets/${j.result.assetId}/file`; player.hidden = false; player.play().catch(() => {}); }
    } catch (e) { fail(e); }
  };
  const save = async () => { try { await put('/api/tts/settings', { provider: provSel.value, voice: voiceEl.value, speed: +speed.value }); S.settings.providers.tts = provSel.value; toast('Narration defaults saved', 'ok'); refresh(); } catch (e) { fail(e); } };

  const lex = (await get(`/api/pronunciations?language=${lang}`)).entries; const w = h('input', { dir: 'auto', placeholder: 'word as written' }); const rep = h('input', { dir: 'auto', placeholder: 'how it should be said (e.g. add diacritics / respell)' });

  root.append(h('div', { class: 'stack-lg' }, h('h1', {}, '🎙️ Voice & narration'),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h2', {}, 'Narration voice'), h('div', { class: 'stack' }, field('Provider', provSel), voiceHolder, field('Speed', h('div', { class: 'row' }, speed, speedLbl)), field('Preview text', sample), h('div', { class: 'row' }, h('button', { class: 'btn', disabled: !S.can('generate'), onclick: preview }, '▶ Preview voice'), h('button', { class: 'btn primary', disabled: !S.can('write'), onclick: save }, 'Save as default')), prevPanel.node, player)),
      h('div', { class: 'card' }, h('h2', {}, 'Pronunciation corrections'), h('p', { class: 'small muted' }, 'Replace words before they reach the voice — e.g. add diacritics so a word is read correctly. Applies to new narration.'), lex.length ? h('table', {}, h('tbody', {}, lex.map((e) => h('tr', {}, h('td', { dir: 'auto' }, e.word), h('td', {}, '→'), h('td', { dir: 'auto' }, e.replacement), h('td', {}, h('button', { class: 'btn sm danger', onclick: async () => { await del(`/api/pronunciations/${e.id}`); refresh(); } }, '✕')))))) : h('p', { class: 'muted small' }, 'No corrections yet.'), h('div', { class: 'row', style: { marginTop: '8px' } }, w, rep, h('button', { class: 'btn', disabled: !S.can('write'), onclick: async () => { if (!w.value || !rep.value) return; try { await post('/api/pronunciations', { language: lang, word: w.value, replacement: rep.value }); refresh(); } catch (e) { fail(e); } } }, 'Add')))),
    p ? await sceneTable(S, p, provSel, () => voiceEl.value, speed, refresh) : empty('🎙️', 'Pick a project to narrate', ''),
    p ? await musicCard(S, p, refresh) : null));
}

async function sceneTable(S, p, provSel, voiceVal, speed, refresh) {
  const { status, assets } = await get(`/api/projects/${p.id}/narration`);
  const panel = jobPanel();
  const run = async (sceneIds, force) => {
    try {
      const r = await withCost((confirmCost) => post(`/api/projects/${p.id}/narration/generate`, { sceneIds, provider: provSel.value, voice: voiceVal(), speed: +speed.value, force, confirmCost }));
      if (!r) return; if (r.upToDate) return toast(r.message, 'info');
      const j = await panel.track(r.job.id, 'Narration'); if (j?.status === 'succeeded') refresh();
    } catch (e) { fail(e); }
  };
  const need = status.filter((s) => ['missing', 'stale'].includes(s.state)).length;
  return h('div', { class: 'card' }, h('div', { class: 'row spread' }, h('h2', {}, 'Scene narration'), h('div', { class: 'row' }, h('button', { class: 'btn primary', disabled: !S.can('generate') || !need, onclick: () => run(undefined, false) }, `🎙️ Generate missing/outdated (${need})`), h('button', { class: 'btn', disabled: !S.can('generate'), onclick: () => run(undefined, true) }, 'Regenerate all'))), panel.node,
    h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Scene', 'Text', 'State', 'Audio & timing', ''].map((x) => h('th', {}, x)))), h('tbody', {}, p.package.scenes.map((s, i) => {
      const st = status.find((x) => x.sceneId === s.id); const a = assets.find((x) => x.scene_id === s.id);
      const file = h('input', { type: 'file', accept: 'audio/wav,audio/mpeg,audio/ogg', hidden: true, onchange: async (e) => { const f = e.target.files[0]; if (!f) return; try { await upload(`/api/projects/${p.id}/scenes/${s.id}/narration-import?filename=${encodeURIComponent(f.name)}&licenseSource=Owner%20recording`, f); toast('Recording attached', 'ok'); refresh(); } catch (x) { fail(x); } } });
      return h('tr', {}, h('td', {}, `${i + 1}. `, h('span', { dir: 'auto' }, s.title)), h('td', { dir: 'auto', style: { maxWidth: '320px' }, class: 'small' }, s.narration), h('td', {}, statusBadge(st.state), st.imported && badge('your recording', 'info')),
        h('td', { style: { minWidth: '240px' } }, a ? h('div', { class: 'stack' }, h('audio', { controls: true, src: `/api/assets/${a.id}/file`, preload: 'none' }), h('span', { class: 'small muted' }, `${fmtDur((a.duration_ms || 0) / 1000)} · ${a.meta.cues?.length || 0} cues · ${a.provider}${a.meta.approximateTiming ? ' · approximate timing' : ' · measured timing'}`)) : h('span', { class: 'muted small' }, '—')),
        h('td', {}, st.state === 'not_needed' ? null : h('div', { class: 'row' }, h('button', { class: 'btn sm', disabled: !S.can('generate'), onclick: () => run([s.id], true) }, 'Generate'), file, h('button', { class: 'btn sm', disabled: !S.can('write'), onclick: () => file.click() }, '⬆ Import'))));
    })))));
}

async function musicCard(S, p, refresh) {
  const music = p.package.music; const assets = (await get(`/api/projects/${p.id}/assets?kind=music`)).assets;
  const vol = h('input', { type: 'range', min: 0, max: 0.5, step: 0.01, value: music.volume ?? 0.16 }); const volLbl = h('b', {}, `${Math.round((music.volume ?? 0.16) * 100)}%`); vol.oninput = () => { volLbl.textContent = `${Math.round(vol.value * 100)}%`; };
  const sel = select([['', 'In-house synthesised music (original, royalty-free)'], ...assets.filter((a) => a.mediaType !== 'synth_audio' && a.media_type !== 'synth_audio').map((a) => [a.id, `${a.filename} — ${a.license?.source || 'licence missing!'}`])], music.assetId || '');
  const file = h('input', { type: 'file', accept: 'audio/wav,audio/mpeg,audio/ogg', hidden: true }); const src = h('input', { placeholder: 'Licence source (e.g. YouTube Audio Library, purchase receipt…)' }); const lic = h('input', { placeholder: 'Licence terms' }); const commercial = h('input', { type: 'checkbox' });
  file.onchange = async () => { const f = file.files[0]; if (!f) return; try { const q = new URLSearchParams({ filename: f.name, kind: 'music', licenseSource: src.value, license: lic.value, commercialUse: String(commercial.checked) }); const { asset } = await upload(`/api/projects/${p.id}/assets?${q}`, f); await patch(`/api/projects/${p.id}/overview`, { music: { ...music, assetId: asset.id } }); toast('Music imported and selected', 'ok'); refresh(); } catch (e) { fail(e); } };
  return h('div', { class: 'card' }, h('h2', {}, '🎵 Background music'), h('p', { class: 'small muted' }, 'Music is automatically lowered while the narrator speaks (ducking) and the whole mix is loudness-normalised. The default track is composed in-house, so there is nothing to license.'),
    h('div', { class: 'grid g2' }, h('div', { class: 'stack' }, field('Track', sel), field('Volume under narration', h('div', { class: 'row' }, vol, volLbl)), h('button', { class: 'btn primary', disabled: !S.can('write'), onclick: async () => { try { await patch(`/api/projects/${p.id}/overview`, { music: { ...music, assetId: sel.value || null, volume: +vol.value } }); toast('Music settings saved', 'ok'); } catch (e) { fail(e); } } }, 'Save')),
      h('div', { class: 'stack' }, h('b', {}, 'Import a licensed track'), h('div', { class: 'callout warn small' }, 'Only import music you may use commercially (own work, purchased licence, or a library whose terms allow it). Record the licence — compliance checks it.'), src, lic, h('label', { class: 'check' }, commercial, 'Commercial use is permitted'), file, h('button', { class: 'btn', disabled: !S.can('write'), onclick: () => { if (!src.value || !commercial.checked) return toast('Fill in the licence source and confirm commercial use first.', 'warn'); file.click(); } }, '⬆ Choose audio file'))));
}
