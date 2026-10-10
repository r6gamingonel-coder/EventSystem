// Thumbnails, metadata/SEO helpers and the compliance gate that must pass before anything is uploaded.
import { now, j, parse, getSetting, setSetting } from '../db.js';
import { newId, sha256 } from '../lib/security.js';
import { AppError, notFound } from '../lib/errors.js';
import { composeThumbnail, THUMB_VARIANTS } from '../art/thumbnail.js';
import { sharp } from '../lib/imaging.js';
import { ORIGINAL_LICENSE } from './media.js';
import { FORMATS } from '../content/registry.js';
import { POLICY, READINESS } from '../config/policy.js';

// ----------------------------------------------------------------------------- text safety lexicons (ar + en)
const LEX = {
  dangerous: ['سكين', 'نار', 'حرق', 'مسدس', 'سلاح', 'قتل', 'دم', 'تحدي خطير', 'تسلق', 'knife', 'fire', 'gun', 'weapon', 'kill', 'blood', 'dangerous challenge', 'dare'],
  scary: ['وحش', 'شبح', 'رعب', 'مخيف', 'جثة', 'monster', 'ghost', 'horror', 'scary', 'zombie'],
  personal: ['اكتب اسمك', 'رقم هاتفك', 'عنوانك', 'بريدك', 'أرسل لنا صورة', 'your name', 'phone number', 'your address', 'send us a photo', 'your email'],
  cta: ['اشترك الآن', 'اضغط على', 'اترك تعليق', 'لا تنس الاشتراك', 'subscribe now', 'click the', 'comment below', 'smash the', 'tell your parents to buy'],
  clickbait: ['لن تصدق', 'صدمة', 'فضيحة', 'قبل الحذف', "you won't believe", 'shocking', 'must watch before deleted'],
};
const hits = (text, words) => words.filter((w) => text.toLowerCase().includes(w.toLowerCase()));

const shingles = (text, n = 3) => {
  const w = String(text).replace(/[ً-ٰٟ]/g, '').split(/[\s.,،؟!?:؛]+/).filter(Boolean);
  const s = new Set(); for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(' ')); return s;
};
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };

export function createPublishing(ctx) {
  const { db, media, projects, narration, render } = ctx;

  // ============================================================================= thumbnails
  async function generateThumbnails(projectId, { variants = THUMB_VARIANTS, overrides = {} } = {}) {
    const p = projects.must(projectId);
    const t = { ...p.package.thumbnail, ...overrides };
    const out = [];
    for (const v of variants) {
      const params = { template: t.template, title: t.title || p.title, glyph: t.glyph, accent: t.accent, characters: t.characters, variant: v, format: p.format };
      const png = await composeThumbnail(params);
      media.removeWhere(projectId, null, 'thumbnail', `thumb-${v}`);
      out.push(await media.create({ projectId, kind: 'thumbnail', mediaType: 'motion_graphics', relPath: `projects/${projectId}/thumbs/thumb-${v}-${Date.now()}.png`, buffer: png, mime: 'image/png', provider: 'local_svg', license: ORIGINAL_LICENSE, meta: { key: `thumb-${v}`, variant: v, params } }));
    }
    if (!p.package.thumbnail.selectedAssetId && out[0]) projects.setThumbnail(projectId, { ...overrides, selectedAssetId: out[0].id });
    else if (Object.keys(overrides).length) projects.setThumbnail(projectId, overrides);
    return out;
  }
  function selectThumbnail(projectId, assetId) {
    const a = media.get(assetId);
    if (!a || a.project_id !== projectId || !['thumbnail', 'image'].includes(a.kind)) throw notFound('Thumbnail');
    projects.setThumbnail(projectId, { selectedAssetId: assetId });
    projects.setMetadata(projectId, { thumbnailFilename: a.filename });
    return a;
  }
  /** YouTube accepts ≤ 2 MB images; export the selected thumbnail as JPEG (or PNG if already small). */
  async function exportThumbnail(projectId) {
    const p = projects.must(projectId);
    const a = p.package.thumbnail.selectedAssetId && media.get(p.package.thumbnail.selectedAssetId);
    if (!a) return null;
    const src = media.abs(a.path);
    let buf = await sharp(src).resize(1280, 720, { fit: 'cover' }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    for (let q = 86; buf.length > 2_000_000 && q > 50; q -= 8) buf = await sharp(src).resize(1280, 720, { fit: 'cover' }).jpeg({ quality: q }).toBuffer();
    return { buffer: buf, mime: 'image/jpeg', bytes: buf.length, sourceAssetId: a.id };
  }
  async function checkThumbnail(project) {
    const id = project.package.thumbnail.selectedAssetId; const a = id && media.get(id);
    if (!a) return { ok: false, detail: 'No thumbnail selected.' };
    const exp = await exportThumbnail(project.id);
    const ratio = a.width / a.height;
    const ok = a.width >= 640 && Math.abs(ratio - 16 / 9) < 0.02 && exp.bytes <= 2_000_000;
    return { ok, detail: `${a.width}×${a.height}, ${(exp.bytes / 1024).toFixed(0)} KB as JPEG` };
  }

  // ============================================================================= metadata
  function timelineFor(project) {
    const fmt = FORMATS[project.format]; const nb = {};
    narration.status(project).forEach((s) => { if (s.assetId) nb[s.sceneId] = media.get(s.assetId); });
    return render.planTimeline(project, { mode: 'final', width: fmt.width, height: fmt.height, fps: 30, narrationByScene: nb });
  }
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const chapterName = (t) => ({ Intro: 'المقدمة', Recap: 'مراجعة', Outro: 'الخاتمة' }[t] || t);

  /** Re-derive chapters/description from the real timeline and disclosure state. Does not save. */
  function suggestMetadata(project) {
    const plan = timelineFor(project); const pkg = project.package;
    const chapters = []; let lastT = -99;
    plan.items.forEach((it, i) => { if (i === 0 || it.start - lastT >= 10) { chapters.push({ time: Math.round(it.start), title: chapterName(it.scene.title) }); lastT = it.start; } });
    const useChapters = project.format === 'landscape' && plan.total >= 60 && chapters.length >= 3;
    const synthetic = plan.items.some((it) => it.narration && it.narration.provider !== 'imported');
    const description = [
      pkg.objective, '', `العمر المناسب: ${project.age_min}–${project.age_max} سنوات.`,
      ...(useChapters ? ['', 'محتوى الفيديو:', ...chapters.map((c) => `${mmss(c.time)} ${c.title}`)] : []),
      '', 'فيديو تعليمي أصلي من إنتاج EA KIDS: الرسوم والشخصيات من تصميمنا.',
      synthetic ? 'الصوت في هذا الفيديو مُولَّد بالحاسوب.' : '',
      'يُنصح بمشاهدة الأطفال برفقة أحد الوالدين أو المربّين.',
    ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n');
    const lists = db.all('SELECT title FROM playlists ORDER BY created_at').map((x) => x.title);
    return { title: pkg.metadata.title || project.title, description, tags: pkg.metadata.tags, chapters: useChapters ? chapters : [], language: project.language, playlistSuggestions: [...new Set([pkg.metadata.playlist, ...lists].filter(Boolean))], thumbnailFilename: pkg.metadata.thumbnailFilename || `${pkg.meta.kit || 'video'}-thumbnail.jpg` };
  }

  function validateMetadata(project) {
    const m = project.package.metadata; const issues = [];
    const add = (id, level, text) => issues.push({ id, level, text });
    if (!m.title) add('title_missing', 'fail', 'Title is empty.');
    if (m.title.length > 100) add('title_len', 'fail', `Title is ${m.title.length} characters (YouTube limit is 100).`);
    if (hits(m.title, LEX.clickbait).length) add('clickbait', 'warn', `Title looks like clickbait (${hits(m.title, LEX.clickbait).join(', ')}).`);
    if (/[!?؟]{3,}/.test(m.title) || (/[A-Z]{4,}/.test(m.title) && m.title.replace(/[^A-Z]/g, '').length > m.title.replace(/[^A-Za-z]/g, '').length * 0.6)) add('shouting', 'warn', 'Title uses shouting capitals or excessive punctuation.');
    if (!m.description || m.description.length < 40) add('desc_short', 'warn', 'Description is very short; explain what children will learn.');
    if (m.description.length > 5000) add('desc_long', 'fail', 'Description exceeds 5,000 characters.');
    const tagLen = m.tags.join(',').length;
    if (tagLen > 500) add('tags_len', 'fail', `Tags total ${tagLen} characters (limit 500).`);
    if (m.tags.length > 15) add('tags_many', 'warn', `${m.tags.length} tags — keep to the few that are accurate (avoid keyword stuffing).`);
    if (new Set(m.tags.map((t) => t.toLowerCase())).size !== m.tags.length) add('tags_dupe', 'warn', 'Duplicate tags.');
    const words = (m.description.toLowerCase().match(/[\p{L}]{4,}/gu) || []); const freq = {};
    words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
    const stuffed = Object.entries(freq).filter(([, n]) => n >= 8).map(([w]) => w);
    if (stuffed.length) add('stuffing', 'warn', `Description repeats words many times (${stuffed.slice(0, 3).join(', ')}) — looks like keyword stuffing.`);
    if (!m.language) add('lang', 'warn', 'Set the video language.');
    return issues;
  }

  // ============================================================================= playlists (local; synced to YouTube on request)
  const playlists = {
    list: () => db.all('SELECT * FROM playlists ORDER BY created_at'),
    create: ({ title, description = '' }) => { const id = newId('pl_'); db.run('INSERT INTO playlists(id,title,description,created_at) VALUES (?,?,?,?)', id, title, description, now()); return db.get('SELECT * FROM playlists WHERE id = ?', id); },
    remove: (id) => db.run('DELETE FROM playlists WHERE id = ?', id),
  };

  // ============================================================================= compliance
  const reviewRow = (projectId) => db.get('SELECT * FROM compliance_reviews WHERE project_id = ? ORDER BY created_at DESC LIMIT 1', projectId);
  const hydrateReview = (r) => r && ({ ...r, checks: parse(r.checks, {}), audience: parse(r.audience, {}) });
  const latestRender = (projectId) => media.list({ projectId, kind: 'render' }).find((a) => a.meta.key === 'final') || null;

  const KIDS_CATEGORIES = new Set(['colors', 'numbers', 'alphabet', 'shapes', 'animals', 'nature', 'story', 'habits', 'general', 'songs']);
  /** Heuristic only — the owner makes (and is responsible for) the final decision. */
  function assessAudience(project) {
    const signals = [];
    if (project.age_max <= 12) signals.push(`Target age range ${project.age_min}–${project.age_max} is within children's ages.`);
    if (KIDS_CATEGORIES.has(project.category)) signals.push(`Category "${project.category}" is educational content for children.`);
    if (project.package.characters?.length) signals.push('Features animated characters likely to appeal to children.');
    if (/ألوان|حروف|أرقام|أغنية|قصة|kids|children/i.test(project.title)) signals.push('Title/topic is aimed at children.');
    const likely = signals.length >= 2 || project.age_max <= 12;
    return { likelyMadeForKids: likely, signals, guidance: likely ? 'This looks like content made for kids. YouTube requires you to designate it as "Yes, it\'s made for kids". That turns off comments, personalised ads, notifications and some other features (contextual ads can still run). Do not choose "No" to avoid those restrictions.' : 'Review YouTube\'s audience guidance carefully; if the video is directed at children it must be set as made for kids.' };
  }

  function similarity(project) {
    const mine = shingles(narrationText(project));
    const others = db.all('SELECT id, title, package FROM projects WHERE id != ?', project.id).map((r) => ({ id: r.id, title: r.title, score: jaccard(mine, shingles(narrationText({ package: parse(r.package, { scenes: [] }) }))) }));
    const top = others.sort((a, b) => b.score - a.score)[0];
    const sameKit = db.all('SELECT package FROM projects').filter((r) => parse(r.package, {}).meta?.kit === project.package.meta?.kit && project.package.meta?.kit).length;
    return { top, sameKit };
  }
  const narrationText = (p) => (p.package.scenes || []).map((s) => s.narration).join(' ');

  async function evaluate(projectId) {
    const project = projects.must(projectId); const pkg = project.package;
    const items = []; const add = (id, section, label, status, detail = '', severity = 'blocker', fix = '') => items.push({ id, section, label, status, detail, severity, fix });
    const text = narrationText(project) + ' ' + pkg.metadata.title + ' ' + pkg.metadata.description;

    // --- content review
    const scenes = pkg.scenes;
    const pending = scenes.filter((s) => s.review.status !== 'approved');
    add('scenes_approved', 'Review', 'Every scene reviewed and approved', pending.length ? 'fail' : 'pass', pending.length ? `${pending.length} not approved: ${pending.slice(0, 3).map((s) => s.title).join(', ')}` : '', 'blocker', 'Open Storyboard → approve each scene after checking characters and text.');
    const openFacts = pkg.factCheck.filter((f) => f.status !== 'verified');
    add('facts_verified', 'Review', 'All factual claims verified by a human', openFacts.length ? 'fail' : 'pass', openFacts.length ? `${openFacts.length} unverified claim(s)` : '', 'blocker', 'Overview → Facts to verify: check each claim against a reliable source and mark it verified.');
    const openList = pkg.reviewChecklist.filter((c) => !c.done);
    add('checklist', 'Review', 'Production review checklist completed', openList.length ? 'fail' : 'pass', openList.length ? `${openList.length} item(s) open` : '', 'blocker', 'Complete the checklist in Overview → Review checklist.');

    // --- text safety
    const danger = hits(text, LEX.dangerous); const scary = hits(text, LEX.scary); const personal = hits(text, LEX.personal); const cta = hits(text, LEX.cta);
    add('no_personal_info', 'Child safety', 'No request for children\'s personal information', personal.length ? 'fail' : 'pass', personal.join(', '), 'blocker', 'Remove prompts that ask children to share names, photos, contact details or locations.');
    add('no_danger', 'Child safety', 'No dangerous activities or imagery', danger.length ? 'warn' : 'pass', danger.length ? `Words found: ${danger.join(', ')} — confirm context is safe.` : '', 'warning', 'Rephrase or remove anything a child might imitate unsafely.');
    add('not_scary', 'Child safety', 'Nothing frightening for young children', scary.length ? 'warn' : 'pass', scary.join(', '), 'warning');
    add('no_manipulative_cta', 'Child safety', 'No manipulative calls to action', cta.length ? 'warn' : 'pass', cta.join(', '), 'warning', 'Avoid pressuring children to subscribe, click or comment.');

    // --- licensing
    const used = media.list({ projectId }).filter((a) => ['music', 'sfx', 'audio', 'image', 'video'].includes(a.kind) && a.meta.key !== 'preview');
    const thirdParty = used.filter((a) => a.provider === 'upload' || ['imported_image', 'imported_video', 'imported_audio'].includes(a.media_type) || a.media_type === 'ai_image');
    const missingLic = thirdParty.filter((a) => !a.license.source || a.license.commercialUse !== true);
    add('licences', 'Copyright & licensing', 'Imported/third-party assets have a recorded commercial licence', missingLic.length ? 'fail' : 'pass', missingLic.length ? `Missing licence info: ${missingLic.slice(0, 4).map((a) => a.filename).join(', ')}` : (thirdParty.length ? `${thirdParty.length} imported asset(s) documented` : 'All media is original or generated in-house'), 'blocker', 'Assets → open the asset → record source, licence, and confirm commercial use (keep proof URL).');
    const draftVoice = used.some((a) => a.meta.quality === 'draft');
    add('voice_quality', 'Quality', 'Narration voice is publishable quality', draftVoice ? 'warn' : 'pass', draftVoice ? 'The draft espeak-ng voice is robotic — fine for previews, not recommended for publishing.' : '', 'warning', 'Use a licensed cloud voice, or record/import your own narration.');
    add('no_unlicensed_music', 'Copyright & licensing', 'No unlicensed songs', 'pass', 'Music is synthesised in-house unless you imported a track (checked above).', 'info');

    // --- render & QC
    const rnd = latestRender(projectId);
    add('render_exists', 'Video', 'Final video rendered', rnd ? 'pass' : 'fail', rnd ? rnd.filename : '', 'blocker', 'Render → Final render.');
    if (rnd) {
      const stale = rnd.meta.packageHash !== sha256(JSON.stringify(pkg.scenes)).slice(0, 12);
      add('render_fresh', 'Video', 'Video matches the current storyboard', stale ? 'fail' : 'pass', stale ? 'The storyboard changed after the last final render.' : '', 'blocker', 'Render the final video again.');
      add('render_qc', 'Video', 'Automated quality checks passed', rnd.meta.qc?.passed ? 'pass' : 'fail', (rnd.meta.qc?.checks || []).filter((c) => c.status !== 'pass').map((c) => c.label).join('; '), 'blocker', 'Open the render report and fix the failing checks.');
      const sm = rnd.meta.summary || {};
      add('ai_disclosure', 'Disclosure', 'Altered/synthetic content disclosure considered', 'manual', `Production: ${Object.entries(sm.sceneMediaTypes || {}).map(([k, v]) => `${v}× ${k}`).join(', ')}; narration: ${(sm.narration || []).join(', ')}. ${sm.aiGeneratedVideoScenes ? 'This video includes AI-generated video — consider disclosure.' : 'Stylised cartoon animation generally does not require disclosure; you decide.'}`, 'info');
    }
    const subs = media.list({ projectId, kind: 'subtitle' });
    add('captions', 'Video', 'Caption files (SRT/VTT) exported', subs.length ? 'pass' : 'warn', '', 'warning', 'Final render creates SRT and VTT files automatically.');

    // --- thumbnail & metadata
    if (project.format === 'landscape') { const th = await checkThumbnail(project); add('thumbnail', 'Metadata', 'Thumbnail selected, 16:9 and ≤ 2 MB', th.ok ? 'pass' : 'fail', th.detail, 'blocker', 'Thumbnails → generate and select one.'); }
    for (const m of validateMetadata(project)) add(`meta_${m.id}`, 'Metadata', m.text, m.level === 'fail' ? 'fail' : 'warn', '', m.level === 'fail' ? 'blocker' : 'warning');

    // --- originality / repetition
    const sim = similarity(project);
    if (sim.top && sim.top.score >= 0.45) add('similar_script', 'Originality', 'Script is sufficiently different from your other videos', sim.top.score >= 0.7 ? 'fail' : 'warn', `${Math.round(sim.top.score * 100)}% word-sequence overlap with "${sim.top.title}".`, sim.top.score >= 0.7 ? 'blocker' : 'warning', 'Add original content: a new story, different examples, your own teaching idea. YouTube may treat near-identical template videos as inauthentic content.');
    else add('similar_script', 'Originality', 'Script is sufficiently different from your other videos', 'pass', sim.top ? `Highest overlap ${Math.round(sim.top.score * 100)}%` : 'No other videos to compare yet.', 'warning');
    add('template_volume', 'Originality', 'Not many near-identical template videos', sim.sameKit >= 4 ? 'warn' : 'pass', sim.sameKit >= 4 ? `${sim.sameKit} videos use the same lesson kit — vary the format, story and ideas.` : '', 'warning');

    // --- audience designation + manual confirmations (stored review)
    const rev = hydrateReview(reviewRow(projectId));
    const audience = rev?.audience || {};
    add('audience_decided', 'Audience', 'Audience designation reviewed and chosen by the owner', typeof audience.madeForKids === 'boolean' && audience.rationale ? 'pass' : 'fail', typeof audience.madeForKids === 'boolean' ? `Owner chose: ${audience.madeForKids ? 'made for kids' : 'not made for kids'}` : '', 'blocker', 'Compliance → Audience: choose and explain your decision.');
    const assessment = assessAudience(project);
    if (assessment.likelyMadeForKids && audience.madeForKids === false) add('audience_mismatch', 'Audience', 'Audience matches the content', 'fail', 'The content looks child-directed but is marked "not made for kids".', 'blocker', 'Set "made for kids" unless you are certain the video is not directed at children.');
    const manual = rev?.checks?.manual || {};
    for (const [id, label] of MANUAL) add(`manual_${id}`, 'Owner confirmations', label, manual[id] ? 'pass' : 'fail', '', 'blocker', 'Tick this box once you have actually done it.');
    const blockers = items.filter((i) => i.severity === 'blocker' && i.status === 'fail');
    const approvedRow = rev?.status === 'approved' ? rev : null;
    const fp = fingerprint(project);
    const valid = !!approvedRow && approvedRow.checks.fingerprint === fp;
    return { items, blockers: blockers.length, warnings: items.filter((i) => i.status === 'warn').length, audienceAssessment: assessment, review: rev, approval: { approved: valid, stale: !!approvedRow && !valid, approvedAt: approvedRow?.approved_at || null }, fingerprint: fp, canApprove: blockers.length === 0 };
  }

  const MANUAL = [
    ['watched_full', 'I watched the complete final video from start to end.'],
    ['accuracy', 'I am confident everything taught is accurate and age-appropriate.'],
    ['value_add', 'This video contains original creative input from me (ideas, script edits, voice, story) and is not a mass-produced re-skin.'],
    ['licences_ok', 'I confirm I have the right to use every voice, sound, music track, image and character in this video commercially.'],
    ['no_child_data', 'This video does not collect or request personal information from children.'],
  ];
  const fingerprint = (project) => sha256(JSON.stringify({ scenes: project.package.scenes, metadata: project.package.metadata, thumb: project.package.thumbnail.selectedAssetId, render: latestRender(project.id)?.id })).slice(0, 16);

  function saveReview(projectId, { audience, manual, notes }, user) {
    const project = projects.must(projectId);
    const cur = hydrateReview(reviewRow(projectId));
    const checks = { ...(cur?.checks || {}), manual: { ...(cur?.checks?.manual || {}), ...(manual || {}) } };
    delete checks.fingerprint; // any edit to the review invalidates a previous approval
    const aud = { ...(cur?.audience || {}), ...(audience ? { ...audience, reviewedBy: user.email, reviewedAt: now() } : {}) };
    if (cur && cur.status !== 'pending') db.run('UPDATE compliance_reviews SET status = ? WHERE id = ?', 'pending', cur.id);
    if (cur) db.run('UPDATE compliance_reviews SET checks = ?, audience = ?, notes = ?, status = ?, approved_at = NULL, reviewer_id = ?, version_no = ? WHERE id = ?', j(checks), j(aud), notes ?? cur.notes, 'pending', user.id, project.current_version, cur.id);
    else db.run('INSERT INTO compliance_reviews(id,project_id,version_no,checks,audience,status,notes,reviewer_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)', newId('cr_'), projectId, project.current_version, j(checks), j(aud), 'pending', notes || '', user.id, now());
    return hydrateReview(reviewRow(projectId));
  }
  async function approve(projectId, user) {
    const ev = await evaluate(projectId);
    if (!ev.canApprove) throw new AppError(409, 'COMPLIANCE_BLOCKED', `${ev.blockers} blocking item(s) must be fixed before approval.`, { details: ev.items.filter((i) => i.severity === 'blocker' && i.status === 'fail').map((i) => i.label), hint: 'Open Compliance and work through the failing checks.' });
    const rev = hydrateReview(reviewRow(projectId));
    const checks = { ...rev.checks, fingerprint: ev.fingerprint, approvedItems: ev.items.length };
    db.run('UPDATE compliance_reviews SET status = ?, checks = ?, approved_at = ?, reviewer_id = ? WHERE id = ?', 'approved', j(checks), now(), user.id, rev.id);
    projects.setStatus(projectId, 'approved');
    return evaluate(projectId);
  }
  async function requestChanges(projectId, notes, user) {
    const rev = hydrateReview(reviewRow(projectId)) || saveReview(projectId, {}, user);
    db.run('UPDATE compliance_reviews SET status = ?, notes = ?, approved_at = NULL WHERE id = ?', 'changes_requested', notes || '', rev.id);
    return evaluate(projectId);
  }
  async function isApproved(projectId) { return (await evaluate(projectId)).approval.approved; }

  // ============================================================================= monetization readiness
  const readiness = {
    get() {
      const saved = getSetting(db, 'monetization', { answers: {}, overrides: {} });
      const lookup = (path) => path.split('.').reduce((o, k) => o?.[k], { ...POLICY, ...(saved.overrides || {}) });
      const items = READINESS.map((r) => {
        const target = r.policy ? lookup(r.policy)?.value : null;
        const v = saved.answers[r.id];
        const done = r.kind === 'metric' ? (typeof v === 'number' && v >= target) : !!v;
        return { ...r, value: v ?? (r.kind === 'metric' ? 0 : false), target, done, source: r.policy ? lookup(r.policy)?.source : undefined, status: r.policy ? lookup(r.policy)?.status : undefined };
      });
      return { items, progress: Math.round((items.filter((i) => i.done).length / items.length) * 100), policy: POLICY, concepts: CONCEPTS, note: 'Progress is only your own checklist — it is not a prediction of acceptance, views or income.' };
    },
    save(answers) { const s = getSetting(db, 'monetization', { answers: {}, overrides: {} }); setSetting(db, 'monetization', { ...s, answers: { ...s.answers, ...answers } }); return readiness.get(); },
  };
  const CONCEPTS = [
    { title: 'YouTube Partner Program (monetization eligibility)', body: 'Channel-level programme that unlocks ads/fan funding. Needs subscriber and watch-hour (or Shorts-view) thresholds, policy compliance, 2-Step Verification and an approved application. Kids content can be monetised with contextual ads.' },
    { title: 'Made for kids (audience designation)', body: 'A per-video legal setting (COPPA etc.) you must set truthfully. It switches off comments, personalised ads, notifications and some other features. It is NOT the same as being eligible for monetization.' },
    { title: 'YouTube Kids app inclusion', body: 'A separate curated app. There is no application: being made for kids is only a prerequisite; selection is by human review, curation and filtering. It cannot be requested or guaranteed.' },
  ];

  return { generateThumbnails, selectThumbnail, exportThumbnail, checkThumbnail, suggestMetadata, validateMetadata, playlists, evaluate, saveReview, approve, requestChanges, isApproved, assessAudience, readiness, MANUAL, timelineFor, fingerprint };
}
