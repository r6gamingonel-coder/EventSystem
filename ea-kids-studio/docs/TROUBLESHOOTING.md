# Troubleshooting

Start with `npm run doctor` — it checks Node, FFmpeg (+ the filters/codecs used), espeak-ng, fonts, disk space and which providers have keys.

| Problem | Cause / fix |
|---|---|
| `Cannot find module 'node:sqlite'` / SyntaxError on start | Node is too old. Use Node ≥ 22.13. |
| *"FFmpeg is not configured"* when rendering | Install FFmpeg 6+ and make sure `ffmpeg`/`ffprobe` are on PATH, or set `FFMPEG_PATH`/`FFPROBE_PATH`. |
| *"FFmpeg subtitle support (libass)"* | Your FFmpeg build lacks libass. Use a full build (Windows: gyan.dev "full"; macOS `brew install ffmpeg`; Linux distro package). |
| Arabic captions/text look like boxes or disconnected letters | Run via the bundled-font path (default). On Windows install the fonts in `assets/fonts`, or use WSL2/Docker. Check `npm run doctor` → "Arabic text rendering". |
| Caption punctuation on the wrong side | Fixed by the RLM marker in `server/media/ass.js`; if you edit captions elsewhere, keep it. |
| Narration step: *"espeak-ng is not configured"* | Install espeak-ng, or choose another provider / import recordings. |
| Final render: *"Narration is missing or out of date"* | Voice & narration → Generate. Editing a scene's text makes its audio stale on purpose. |
| *"Cannot render yet: … rejected"* | A scene was rejected in review; revise or approve it. |
| Render failed halfway | Click **Retry** — scenes that already rendered are cached and reused. *Clear render cache* frees disk. |
| Paid provider says *"no spending limit is set"* | Costs & limits → set a daily/monthly limit (owner only). |
| *"Confirmation required"* | Expected: confirm the shown estimate. Nothing is bought automatically. |
| Login throttled | 8 failed attempts per IP+email per 15 minutes; wait or restart. |
| Locked out (lost owner password) | `npm run create-owner -- you@example.com` works only when no users exist. Otherwise delete `data/studio.db` *only if you accept losing data*, or reset the hash with SQLite. Keep backups. |
| "Missing or invalid CSRF token" | Reload the page (session expired). |
| First-run setup says it needs `SETUP_TOKEN` | You are not on localhost. Set `SETUP_TOKEN` in `.env`, restart, enter it; or run `npm run create-owner` on the server. |
| YouTube problems | See `docs/GOOGLE_OAUTH_SETUP.md` (troubleshooting table). |
| Job stuck "running" after a crash | On restart, interrupted jobs are re-queued automatically (attempt counters prevent loops). |
| Disk full | Clear render cache, delete old renders/previews, prune backups. Intermediate clips are cached per scene. |
| Tests fail only on one machine | `npm test` needs `ffmpeg`, `ffprobe`, `espeak-ng` for the media suites; those tests are skipped if missing. |

Logs: `data/logs/app.log` (JSON lines, secrets redacted) and the **Production log** drawer in the dashboard.
