# Prioritised roadmap

**P0 — before relying on it for a channel**
1. Run the YouTube flow live once (private upload) and fix anything the mocks missed; confirm quota and unverified-project behaviour.
2. Replace the draft voice: validate one Arabic voice (own recording, Azure `ar-IQ-*`, or another) and add it as the default; add diacritization support for better pronunciation.
3. Review the sample episode with real children/parents or an educator; adjust pacing and difficulty.
4. Verify the monetization/payment facts in `server/config/policy.js` against the live pages and update the `checkedAt`/status fields.

**P1 — quality**
5. More artwork: remaining Arabic letters (28), more animals/objects, more backgrounds; character poses (walk, wave) and mouth shapes synced to speech.
6. Better motion: eased sprite-sheet animation, parallax layers, particle effects.
7. Forced alignment (word-level highlight/karaoke captions).
8. English kits for every category; add other languages (Kurdish, Turkish, French).
9. Real image/video generation adapters behind the existing media-type labels, with automatic licence/terms capture and disclosure prompts.

**P2 — workflow**
10. Free-form thumbnail canvas editor; A/B thumbnail tracking.
11. Drag-and-drop calendar, recurring series planning, batch rendering queue with priorities.
12. Captions upload via API, end-screen/cards planning, playlist sync both ways.
13. Arabic UI, accessibility audit, dark mode.
14. 2FA, email/Telegram notifications, multi-channel support.

**P3 — scale & ops**
15. Pluggable object storage (S3-compatible) for media; worker processes for rendering on another machine.
16. Packaged installers / verified Docker image, CI pipeline running the test suite and a headless render.
