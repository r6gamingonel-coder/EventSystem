# Sample episode — «نتعلم الألوان مع أصدقاء الحيوانات | EA KIDS»

Produced end-to-end by the real pipeline (`npm run build:sample`): offline lesson kit → per-sentence narration → local animation render → QC → thumbnail → metadata.

| File | What it is |
|---|---|
| `colors-episode/episode.mp4` | the rendered episode (1920×1080, 30 fps, H.264/AAC, burned-in Arabic captions) |
| `colors-episode/script.md` | objective, scene-by-scene Arabic narration, visuals, camera, SFX, facts to verify |
| `colors-episode/storyboard.json` | the full machine-readable package (10 scenes, layers, timings, prompts) |
| `colors-episode/narration.txt` | the narration text only |
| `colors-episode/captions.srt` / `.vtt` | subtitles with measured timings |
| `colors-episode/audio-mix.mp3` | full mixed audio (narration + ducked music + SFX, −16 LUFS) |
| `colors-episode/thumbnail.png` (+ `thumbnail-A/B/C.png`) | 1280×720 concepts |
| `colors-episode/characters.md` | the characters used (Rayyan, Nunu, Zaqzaq, Sallouma) |
| `colors-episode/image-and-animation-prompts.md` | per-scene prompts + character-consistency block |
| `colors-episode/youtube-metadata.json` | title, description, tags, chapters, playlist, thumbnail filename |
| `colors-episode/audience-review.md` | audience assessment and the owner's pending decision |
| `colors-episode/production-checklist.md` | review checklist + what still blocks publishing |
| `colors-episode/render-report.json` | QC results, production summary, timings |

**Honest notes**
* The narration uses the free **espeak-ng** voice — it is robotic. It proves the pipeline and timing; replace it with your own recording or a licensed voice before publishing.
* The video is **motion graphics** drawn from the EA KIDS art library — not AI-generated video.
* The episode is **not approved for publishing**: scenes are unreviewed, facts unverified, the audience designation is undecided. That is intentional — a human must complete review in *Compliance & YouTube*.
* Music and sound effects are synthesised in-house (original, royalty-free).
