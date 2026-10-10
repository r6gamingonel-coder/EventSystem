// Builds the sample episode "نتعلم الألوان مع أصدقاء الحيوانات | EA KIDS" end-to-end with the real pipeline:
// offline lesson kit → narration (espeak-ng, if installed) → 1080p render + QC → thumbnail → exports in samples/colors-episode/.
// The project also appears in the dashboard. It is deliberately NOT approved for publishing: a human must review it.
// Usage: npm run build:sample [-- --preview]   (--preview renders a fast 480p version instead of the final 1080p)
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { ROOT } from '../server/config.js';
import { CHARACTERS } from '../server/art/characters.js';
import { toSrt, toVtt } from '../server/content/timing.js';

const TITLE = 'نتعلم الألوان مع أصدقاء الحيوانات | EA KIDS';
const preview = process.argv.includes('--preview');
const out = path.join(ROOT, 'samples', 'colors-episode'); fs.mkdirSync(out, { recursive: true });
const { ctx } = await createApp();
await ctx.seedPromise; ctx.jobs.start();
const log = (m) => console.log(`[sample] ${m}`);
const caps = await ctx.caps.detect(true);
if (!caps.ffmpeg.ok) { console.error('FFmpeg is missing — cannot render. Install FFmpeg, then run again.\n' + caps.ffmpeg.install); process.exit(2); }

let project = ctx.projects.list({ q: TITLE }).map((p) => ctx.projects.get(p.id)).find((p) => p.package.meta?.sample);
if (!project) {
  project = ctx.projects.create({ title: TITLE, category: 'colors', language: 'ar', ageMin: 3, ageMax: 6, targetDurationSec: 90, topic: 'Teach children the colors using friendly animal characters.', visualStyle: 'flat-friendly', narrationStyle: 'warm-teacher', difficulty: 'easy', format: 'landscape' }, null);
  const job = ctx.jobs.enqueue('generate_package', { projectId: project.id, payload: { projectId: project.id, provider: 'offline_templates', brief: { kit: 'colors', language: 'ar', format: 'landscape', targetDurationSec: 90, ageMin: 3, ageMax: 6, category: 'colors', title: TITLE, syntheticVoice: true }, costEstimate: {} } });
  const d = await ctx.jobs.waitFor(job.id, 60000); if (d.status !== 'succeeded') throw new Error(d.error?.message);
  const pkg = ctx.projects.get(project.id).package; pkg.meta.sample = true; ctx.projects.savePackage(project.id, pkg, { snap: true, label: 'Sample episode created' });
  project = ctx.projects.get(project.id);
}
log(`project ${project.id} — ${project.package.scenes.length} scenes`);

// narration (free local voice if available; otherwise the render will stop with a clear message)
const st = ctx.narration.status(project);
if (st.some((s) => ['missing', 'stale'].includes(s.state))) {
  if (!caps.espeak.ok) { console.error('No narration voice: install espeak-ng (free) or configure a TTS provider / import recordings, then run again.\n' + caps.espeak.install); process.exit(3); }
  log('synthesising narration with espeak-ng (draft-quality voice)…');
  const j = ctx.jobs.enqueue('synthesize_narration', { projectId: project.id, payload: { projectId: project.id, provider: 'espeak', voice: '', speed: 1, force: false, costEstimate: {} } });
  const d = await ctx.jobs.waitFor(j.id, 300000); if (d.status !== 'succeeded') throw new Error(d.error?.message);
}
log(`rendering ${preview ? 'preview (480p)' : 'final 1080p'}… (this takes a few minutes)`);
const t0 = Date.now();
const rj = ctx.jobs.enqueue('render_video', { projectId: project.id, payload: { projectId: project.id, mode: preview ? 'preview' : 'final', exportAudio: !preview } });
const rd = await ctx.jobs.waitFor(rj.id, 3_600_000);
if (rd.status !== 'succeeded') { console.error('Render failed:', rd.error?.message, '\n', rd.error?.hint || ''); process.exit(4); }
log(`render finished in ${((Date.now() - t0) / 1000).toFixed(0)}s — QC ${rd.result.qc.passed ? 'PASSED' : 'FAILED'}`);
rd.result.qc.checks.forEach((c) => log(`  ${c.status.toUpperCase().padEnd(4)} ${c.label}${c.detail ? ' — ' + c.detail : ''}`));

// thumbnails
await ctx.publishing.generateThumbnails(project.id);
project = ctx.projects.get(project.id);
const pkg = project.package;
const copy = (assetId, name) => { const a = ctx.media.get(assetId); fs.copyFileSync(ctx.media.abs(a.path), path.join(out, name)); return a; };
const render = ctx.media.get(rd.result.assetId); fs.copyFileSync(ctx.media.abs(render.path), path.join(out, preview ? 'episode-preview.mp4' : 'episode.mp4'));
ctx.media.list({ projectId: project.id, kind: 'thumbnail' }).forEach((a) => copy(a.id, `thumbnail-${a.meta.variant}.png`));
fs.copyFileSync(path.join(out, `thumbnail-A.png`), path.join(out, 'thumbnail.png'));
for (const a of ctx.media.list({ projectId: project.id, kind: 'subtitle' })) copy(a.id, `captions.${a.filename.split('.').pop()}`);
if (!preview) { const mp3 = ctx.media.list({ projectId: project.id, kind: 'audio' }).find((a) => a.meta.key === 'master-mp3'); if (mp3) copy(mp3.id, 'audio-mix.mp3'); }
// narration text + per-scene audio timings
const narr = ctx.narration.status(project).map((s) => ({ ...s, asset: s.assetId && ctx.media.get(s.assetId) }));
fs.writeFileSync(path.join(out, 'narration.txt'), pkg.scenes.map((s, i) => `[${i + 1}] ${s.title}\n${s.narration}\n`).join('\n'));

fs.writeFileSync(path.join(out, 'storyboard.json'), JSON.stringify({ meta: pkg.meta, objective: pkg.objective, outcomes: pkg.outcomes, factCheck: pkg.factCheck, scenes: pkg.scenes }, null, 2));
fs.writeFileSync(path.join(out, 'script.md'), [`# ${pkg.meta.title}`, '', `**Objective:** ${pkg.objective}`, '', `**Ages:** ${pkg.meta.ageMin}–${pkg.meta.ageMax} · **Language:** Arabic · **Length:** ${Math.round(render.meta.durationSec)} s`, '', ...pkg.scenes.map((s, i) => `## Scene ${i + 1} — ${s.title} (${s.kind})\n\n**Narration (Arabic):** ${s.narration}\n\n**Visuals:** background \`${s.visual.background.preset}\`; layers: ${s.visual.layers.map((l) => `${l.type}:${l.ref || l.text}${l.anim !== 'none' ? ` (${l.anim})` : ''}`).join(', ')}\n\n**Camera:** ${s.camera.move} (${s.camera.amount}) · **Transition in:** ${s.transition} · **SFX:** ${s.audio.sfx.map((x) => `${x.name}@${x.at}s`).join(', ') || '—'}\n`), '## Facts to verify (human review required)', ...pkg.factCheck.map((f) => `- [ ] ${f.claim}`)].join('\n'));
const used = [...new Set(pkg.scenes.flatMap((s) => s.visual.layers.filter((l) => l.type === 'character').map((l) => l.ref)))];
fs.writeFileSync(path.join(out, 'characters.md'), ['# Characters in this episode', '', ...used.map((k) => { const c = CHARACTERS[k]; return `## ${c.nameAr} — ${c.nameEn} (${c.species})\n\n${c.description}\n\n- **Look:** ${c.features}\n- **Colours:** ${Object.entries(c.colors).map(([a, b]) => `${a} ${b}`).join(', ')}\n- **Personality:** ${c.personality}\n- **Educational role:** ${c.eduRole}\n- **Voice:** ${c.voice.style}. ${c.voice.note}\n`; })].join('\n'));
fs.writeFileSync(path.join(out, 'image-and-animation-prompts.md'), ['# Image & animation prompts', '', 'The episode was drawn locally from the EA KIDS art library (media type: **motion graphics** — no AI video). These prompts describe each scene for use with an external image/video tool you are licensed to use, keeping the characters consistent.', '', '## Character consistency block', '', ctx.characters.consistencyBlock(used), '', ...pkg.scenes.map((s, i) => `## Scene ${i + 1} — ${s.title}\n\n**Image prompt:** ${s.visual.prompt}\n\n**Animation:** ${s.animationNotes}\n\n**Character notes:** ${s.characterNotes}\n`)].join('\n'));
const meta = { ...ctx.publishing.suggestMetadata(project), audienceDesignation: 'NOT YET DECIDED — the owner must choose and justify it in Compliance', privacy: 'private (recommended for first upload)', thumbnailConcept: pkg.thumbnail.concept, thumbnailFile: 'thumbnail.png (1280×720)' };
fs.writeFileSync(path.join(out, 'youtube-metadata.json'), JSON.stringify(meta, null, 2));
const ev = await ctx.publishing.evaluate(project.id);
fs.writeFileSync(path.join(out, 'audience-review.md'), ['# Audience designation review', '', `**Assessment (heuristic, not a decision):** ${ev.audienceAssessment.likelyMadeForKids ? 'likely MADE FOR KIDS' : 'unclear'}`, '', ...ev.audienceAssessment.signals.map((s) => `- ${s}`), '', ev.audienceAssessment.guidance, '', '## The three different questions', '', '1. **Monetization eligibility (YouTube Partner Program)** — channel-level: thresholds, policies, approval. Kids content can be monetised, with contextual (non-personalised) ads.', '2. **Made for kids** — per-video legal designation you must set truthfully; turns off comments, personalised ads, notifications, etc.', '3. **YouTube Kids app inclusion** — separate curated app; no application exists; made-for-kids is only a prerequisite.', '', '## Decision', '', '- [ ] Yes, it\'s made for kids  - [ ] No — reason: ________________', '', '*Not decided by the tool. Record it in the dashboard under Compliance & YouTube.*'].join('\n'));
fs.writeFileSync(path.join(out, 'production-checklist.md'), ['# Production checklist — current status', '', `Final render QC: **${rd.result.qc.passed ? 'passed' : 'FAILED'}** (${rd.result.qc.checks.length} automated checks)`, '', '## Review checklist (human)', ...pkg.reviewChecklist.map((c) => `- [ ] ${c.text}`), '', '## Compliance gate right now', ...ev.items.filter((i) => i.status !== 'pass').map((i) => `- ${i.status === 'fail' ? '❌' : i.status === 'warn' ? '🟡' : '👁️'} ${i.label}${i.detail ? ` — ${i.detail}` : ''}`), '', `**${ev.blockers} blocking item(s)** remain, as expected: a human must review before this can be published.`].join('\n'));
fs.writeFileSync(path.join(out, 'render-report.json'), JSON.stringify({ project: project.id, mode: preview ? 'preview' : 'final', width: render.width, height: render.height, fps: render.meta.fps, durationSec: render.meta.durationSec, bytes: render.bytes, qc: rd.result.qc, production: rd.result.summary, narrationDraftVoiceNote: 'Narration uses the free espeak-ng draft voice (robotic). Replace it with a licensed voice or your own recording before publishing.', timings: narr.map((n, i) => ({ scene: i + 1, state: n.state, durationMs: n.asset?.duration_ms })) }, null, 2));
log(`done → ${path.relative(ROOT, out)} (${fs.readdirSync(out).length} files). The project is also in the dashboard.`);
await ctx.close();
process.exit(0);
