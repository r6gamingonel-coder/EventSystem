# EA KIDS Studio

A local-first production system for **original children's educational videos** (Arabic first, English-ready): ideas → script → storyboard → narration → animated render → thumbnail → compliance review → YouTube (dry-run, approval, upload) → analytics, with cost limits and a human in the loop at every publishing step.

It does **not** promise monetization, views or income, never publishes anything automatically, never asks for your Google password, and never describes a drawn animation as "AI video".

> Lives in its own folder next to the unrelated `Brotherhood/` project in this repository; nothing there was touched.

## Quick start

Prerequisites: **Node.js ≥ 22.13**, **FFmpeg 6+** (with libass — standard builds have it). Optional: `espeak-ng` (free draft voice).

```bash
cd ea-kids-studio
npm ci
cp .env.example .env          # all providers are optional
npm run doctor                # checks Node, FFmpeg + filters, fonts, espeak-ng, disk, provider keys
npm start                     # http://127.0.0.1:4300  — first visit creates the owner account
```
Try the sample episode: `npm run build:sample` (renders `نتعلم الألوان مع أصدقاء الحيوانات | EA KIDS` at 1080p, writes `samples/colors-episode/`, and adds it to the dashboard).
Run the tests: `npm test` (≈ 4 min; media suites need FFmpeg + espeak-ng) · browser smoke test: `node scripts/ui-smoke.mjs [screenshot-dir]`.

Windows: use **WSL2** or **Docker** (`Dockerfile` included, never built in the authoring sandbox). macOS/Windows are untested.

## Daily workflow
1. **Ideas** → **Script generator**: pick category, age, length, format; choose a free offline lesson kit, or an AI provider (shows a cost estimate and asks you to confirm).
2. **Storyboard**: review each scene preview; approve/reject (with reason), edit text/visuals/camera/audio, revise one scene with AI, restore earlier versions.
3. **Voice & narration**: choose a voice, add pronunciation fixes, generate narration per scene (or import your recording), set music volume.
4. **Render & preview**: fast preview, then final MP4 with captions, SRT/VTT, loudness-normalised audio and an automated quality report.
5. **Thumbnails**, **Titles & SEO**: three concepts, honest metadata, chapters from the real timeline.
6. **Compliance & YouTube**: fact-check, audience designation, owner confirmations → approve → **dry run** → owner types `UPLOAD` → private upload (or manual export if the API isn't configured).
7. **Analytics / Costs / Monetization**: real API or CSV data only, spending limits, a sourced readiness checklist.

## What's inside
| Area | Where |
|---|---|
| Server (Express 5, `node:sqlite`, no native build) | `server/` — `app.js`, `routes/`, `services/`, `providers/`, `media/`, `content/`, `art/`, `migrations/` |
| Dashboard (vanilla ES modules, no build step) | `web/` — `js/app.js`, `js/views/*` (17 screens), `css/app.css` |
| Brand kit (original) + generator | `brand/`, `server/art/`, `npm run build:brand` |
| Bundled OFL fonts (Tajawal, Cairo, Baloo Bhaijaan 2, Fredoka) | `assets/fonts/` |
| Policy facts (sourced, status-labelled) | `server/config/policy.js` |
| Tests (54) | `tests/` — core, content, pipeline (real FFmpeg), publishing/compliance, YouTube + Claude against mocks, security |
| Scripts | `scripts/` — `doctor`, `backup`, `create-owner`, `build-brand`, `build-sample`, `ui-smoke`, `migrate` |
| Docs | `docs/` |

### Architecture in brief
* **One Node process** serves the API, the static dashboard and a **SQLite-backed job queue** (retries with backoff, cancel, restart recovery, lanes so a render never blocks quick jobs). No Redis/Postgres/cloud needed; `127.0.0.1` by default.
* **Project package** (JSON): objective, outcomes, facts-to-verify, scenes (narration, drawn layers, camera, audio, review state), metadata, thumbnail, checklist. Every write passes one normaliser, so AI output and hand edits can only reference things the renderer can draw. Immutable **versions** make every destructive action reversible.
* **Rendering** is local FFmpeg: layers (characters/props/text) become animated overlays with camera moves; scenes are joined with `xfade`; narration (synthesised **per sentence** so caption timing is measured) is mixed with ducked in-house music and SFX, loudness-normalised in two passes; captions are burned with libass (correct Arabic shaping + RTL punctuation); a QC pass re-probes the result.
* **Why this stack:** the repo had no existing tooling for this, the machine had FFmpeg/Node but no GPU, and the goal is free local operation. Dependencies are four runtime packages (`express`, `zod`, `sharp`, `@anthropic-ai/sdk`).

## Configuration
See `.env.example` (placeholders only) and:
* `docs/PROVIDERS.md` — Claude/OpenAI/local LLM, TTS providers, what's not integrated
* `docs/GOOGLE_OAUTH_SETUP.md` — Google Cloud project, API enablement, OAuth consent, quotas, permissions
* `docs/COMPLIANCE_AND_MONETIZATION.md` — made-for-kids vs monetization vs YouTube Kids, Iraq payment notes (with verification status)
* `docs/COSTS.md` — realistic monthly costs · `docs/FEATURES.md` — implemented / partial / not implemented
* `docs/TROUBLESHOOTING.md` · `docs/PRODUCTION_CHECKLIST.md` · `docs/ROADMAP.md` · `brand/BRAND_GUIDELINES.md`

## Honest limits
* The built-in Arabic voice (espeak-ng) is **robotic** — good for drafts. Use your own recording or a licensed cloud voice for published episodes.
* YouTube, Claude-in-production, Azure/OpenAI/ElevenLabs/Google TTS code paths are tested **against local mocks only**; the first live run should be a private upload.
* Music/SFX are simple in-house synthesis (royalty-free by construction, modest musically).
* Policy/payment facts were checked via search-result snippets on 2026-10-10, not the official pages, and change often — verify them (the app labels each one).
* Template-based videos with little variation can hurt monetization ("inauthentic content"); the studio warns, but original ideas are your job.
