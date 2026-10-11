# Endrick counts 1 to 10

Current version: `endrick_counting_1_to_10_v4.mp4` (80.5 s, 1280x720, 16:9, 24 fps).

- Each number uses its own picture of Endrick (`source/number_images/`).
- The counted objects sit in a neat ten-frame grid.
- Voice: Kokoro TTS (`af_heart`), the same voice as v1, unchanged.

Earlier versions: v1 (`andrik_counting_1_to_10.mp4`), v2 (pitch-shifted voice, busier), v3 (v1 look with a few touches).

Swapping in a real child's voice: put one clip per line in `source/audio/` named `n1.wav` ... `n10.wav`,
`hello.wav`, `great.wav`, `wow.wav`, `bye.wav` and re-run `audio_build3.py` and `render4.py`.

## v5 (motion transfer)

`endrick_counting_1_to_10_v5_motion.mp4`: the motion of the reference clip (`source/reference_one_clip.mp4`,
Endrick saying "one") is transferred onto each number picture with optical flow (`source/motion.py`, `masks.py`, `render5.py`).
Only Endrick is moved; the background and the number stay still. The voice is still the Kokoro TTS voice.

## v6 (hybrid)

`endrick_counting_1_to_10_v6_hybrid.mp4`: number ONE is the real reference clip (original motion and audio, unedited,
including its watermark); numbers 2-10 use the clean v4 pictures with the TTS voice.
When clips for 2-10 exist, drop them in and replace `clip_sprite` usage for each number.

## v7 (real clips)

`endrick_counting_1_to_10_v7_real_clips.mp4` is built from the user's ten CapCut AI clips (IMG_0320 ... IMG_0347, not committed because of size):
title card, overview clip (IMG_0347), then ONE to TEN in order, an end card, plus a compact ten-frame and progress stars on top of each clip.
There is no clip for SIX: it is a picture slide with the TTS voice (`source/timeline7.py`, kind "six"). Replace it with a real clip when available.

## v8 (final structure)

`endrick_counting_1_to_10_v8_final.mp4`: title card, ONE to TEN from the real clips, and the real "See you next time, bye-bye!" clip (IMG_0347) at the end.
SIX still has no clip: it is a picture slide with the TTS voice. Build scripts: `source/timeline8.py`, `audio_build8.py`, `render8.py`.

## v9 (all ten real clips)

`endrick_counting_1_to_10_v9_final.mp4`: title card, ONE to TEN all from the real clips (SIX = IMG_0339), then the "See you next time, bye-bye!" clip (IMG_0347).
No placeholder slides remain. Build scripts: `source/timeline9.py`, `audio_build9.py`, `render9.py`.

## v10 (cleaned clips, captions, fingers)

`endrick_counting_1_to_10_v10_final.mp4` (57 s, 1280x720, 30 fps):
- CapCut mark removed from every clip (`source/wm_template.py`, mask `source/wm_mask.png`) and a "Count with Endrick" badge placed over the spot.
- Text burned into two source clips is hidden under a frosted caption strip; new karaoke-style captions show what is said (speech was recognised with Whisper small.en via sherpa-onnx, see `source/asr_run.py`, `source/words.py`).
- "Three!" is said twice (the third repetition and its video are cut with a short dissolve).
- Every number has a finger-counting card (hands + ten-frame) that fills in with the first spoken word.
- All edit points are in `source/spec10.py`; build with `source/build10.py` (`audio`, then `video <out.mp4>`).

## v11 (continuous)

`endrick_counting_1_to_10_v11_continuous.mp4`: same content as v10, but every join is a 0.35 s dissolve instead of a cut.
The previous clip holds its last frame while it fades out; the badge and counting card stay in place so only their contents change;
captions fade out/in separately. Audio is joined end to start with no overlap (no two voices at once).
Captions are now drawn from real alpha layers (Pillow ignores text alpha), so fades work and the shadow is soft. Build: `source/build11.py`.

## v12 (intro)

`endrick_counting_1_to_10_v12_intro.mp4` (61 s): a spoken intro replaces the silent title card: "Hello! I'm Endrick! Today, I will show you how to say the numbers from one to ten in English!"
The intro uses a still picture of Endrick waving and a synthesized voice (Kokoro, `source/tts_intro.py`), because no real intro clip exists yet.
When a real intro clip is available, add it as the first item in `source/build12.py` (like the other clips) and drop the synthesized voice-over.

## v13 (built on the user's own compilation IMG_0417)

`endrick_counting_1_to_10_v13_final.mp4` (61 s):
- the user's "Endrick - Let's Learn Numbers!" logo card as the opening (`source/brand/logo_card.png`),
- the user's "EA For Kids" badge (cut out of IMG_0417, `source/brand/badge_rgba.png`) on every clip, with the CapCut mark properly removed underneath,
- all earlier fixes (captions, "Three!" twice, finger cards, dissolves), a star burst on every "Great job!",
- a closing "Thanks for watching!" card with the badge and the numbers 1-10.
Build: `source/build13.py` (`audio`, then `video <out.mp4>`); the raw clips are not committed.

## v14 (clean)

`endrick_counting_1_to_10_v14_clean.mp4`: v13 without the dark caption strip and without the finger/ten-frame card.
Captions rely on a stronger outline/shadow instead. Only clips 1 and 7 (which carry text burned in by the generator) get a light blur, no darkening, under the captions. Build: `source/build14.py`.
