# Feature status

Legend — **✅ Verified**: exercised by automated tests or a real run in the authoring environment. **🧪 Mock-tested**: tested only against a local stand-in for the provider, never the live service. **◐ Partial**. **✗ Not implemented**.

## Platform
| Feature | Status | Notes |
|---|---|---|
| Local web dashboard (17 screens), responsive, RTL-aware content | ✅ | headless-Chromium smoke test, no console errors; desktop + 390 px mobile layout checked |
| SQLite database + forward-only migrations, backups (`VACUUM INTO`), restore procedure | ✅ | `npm run backup`; restore documented |
| Auth: scrypt passwords, HttpOnly SameSite=Strict cookie, CSRF token, login throttling, roles (owner/editor/reviewer/viewer), audit log | ✅ | tests incl. role matrix |
| Secrets only in env; redacted logs; tokens encrypted at rest; no secrets in API/static files | ✅ | tests scan responses, web files, source tree, logs |
| Safe file handling: magic-byte type checks, size cap, filename sanitising, path-traversal guard, argv-only subprocesses, ASS-injection guard | ✅ | tests |
| Persistent job queue: retries with backoff, cancel, retry, restart recovery, per-lane concurrency, per-job logs | ✅ | tests |
| Two-factor auth, SSO, password reset by email | ✗ | |
| UI translated to Arabic | ✗ | content fields are RTL-aware; UI chrome is English |

## Content
| Feature | Status | Notes |
|---|---|---|
| 10 offline lesson kits (colours ar/en, numbers ar/en, Arabic letters*, shapes, animals & sounds, habits, plants, days, original story, original song) | ✅ | *13 letters that have artwork; full 28 needs more art |
| Landscape + Shorts layouts for every kit | ✅ | |
| AI script/storyboard via Claude | 🧪 | SDK streaming, refusal/auth/garbage handling, cost settling tested against a mock Messages API |
| AI via OpenAI / local OpenAI-compatible | ◐ | implemented, not run against a live endpoint |
| Output validation/normalisation of AI content; claims start "unverified" | ✅ | |
| Per-scene editing, reorder, duplicate, delete, lock, review (approve/reject + reason) | ✅ | |
| Per-scene AI revision (only that scene changes; version saved first) | 🧪 | |
| Versions: auto-snapshots, diff, non-destructive restore | ✅ | |
| Character library with versions, approved prompts, reference images; characters referenced by scenes | ✅ | 4 mascots + 6 supporting animals (original art) |
| Idea library → project | ✅ | |
| Fact-checking workflow (human verification required) | ✅ | the tool does not verify facts itself |

## Production
| Feature | Status | Notes |
|---|---|---|
| Local animation pipeline: layered motion graphics, camera moves, transitions, SFX | ✅ | real 1080p renders |
| Media types kept distinct (motion graphics / animated still / imported video / AI clip); production summary never calls a slideshow "AI video" | ✅ | |
| AI video-generation APIs | ✗ | attach clips you generated elsewhere (licence recorded) |
| AI image-generation APIs | ✗ | local art library or imports |
| TTS: espeak-ng | ✅ | draft quality, robotic |
| TTS: Azure, OpenAI, ElevenLabs, Google | ◐ | implemented to documented REST APIs, not run live |
| Own-recording import, pronunciation lexicon, speed | ✅ | |
| Per-sentence synthesis → measured caption timing | ✅ | imported recordings use proportional (flagged approximate) timing |
| Original in-house music + SFX; ducking; loudness normalisation (two-pass, −16 LUFS) | ✅ | musical quality is simple — judged by ear is up to you |
| Captions burned in (Arabic shaping + RTL punctuation), SRT + VTT export, MP3 mix export | ✅ | |
| 1920×1080 and 1080×1920, 24–60 fps (30 default), preview renders, single-scene preview | ✅ | |
| Automated QC: valid MP4, size, fps, duration, black frames, clipping, loudness, audibility, narration coverage, caption speed, A/V sync | ✅ | independent re-verification in tests |
| Render progress, cancel, retry with cached scenes | ✅ | |
| Forced alignment / lip-sync | ✗ | |

## Publishing & business
| Feature | Status | Notes |
|---|---|---|
| Thumbnails: 10 templates × 3 variants, parametric editing, upload own, ≤ 2 MB JPEG export, 16:9 check | ✅ | no free-form canvas editor |
| Metadata generation + validation (clickbait, stuffing, limits), chapters from real timeline | ✅ | |
| Compliance gate (25+ checks), audience designation, owner confirmations, similarity detection, stale-approval handling | ✅ | heuristics — a human is always the decider |
| Monetization readiness checklist with sourced, status-labelled policy facts | ✅ | facts need your verification |
| YouTube OAuth (PKCE), encrypted tokens, dry-run, owner approval, resumable upload with retry/resume, thumbnail, playlists, scheduling | 🧪 | never run against live Google |
| Captions upload to YouTube | ✗ | export SRT/VTT, add in Studio |
| Analytics: API sync (daily, per-video, retention), CSV import/export, per-topic/format, production cost per video | 🧪 / ✅ | revenue only via optional scope, always labelled *estimated* |
| Impressions / CTR | ◐ | not in the API → manual CSV import |
| Cost estimator, daily/monthly limits (default $0), mandatory confirmation, verified/unverified price labels | ✅ | |
| Content calendar | ◐ | month view + notes + scheduled uploads; no drag-and-drop |
| Multi-channel, team workflows, email notifications | ✗ | |

## Environment
| Item | Status |
|---|---|
| Linux (Ubuntu), Node 22, FFmpeg 6.1, Chromium | ✅ authored & tested here |
| macOS | ✗ untested |
| Windows | ✗ untested (use WSL2 or Docker; fonts via fontconfig may need manual install) |
| Docker image | ✗ written, never built in the authoring sandbox |
