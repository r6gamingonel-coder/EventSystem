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
