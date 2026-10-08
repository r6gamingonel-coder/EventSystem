# Endrick counts 1 to 10

Current version: `endrick_counting_1_to_10_v4.mp4` (80.5 s, 1280x720, 16:9, 24 fps).

- Each number uses its own picture of Endrick (`source/number_images/`).
- The counted objects sit in a neat ten-frame grid.
- Voice: Kokoro TTS (`af_heart`), the same voice as v1, unchanged.

Earlier versions: v1 (`andrik_counting_1_to_10.mp4`), v2 (pitch-shifted voice, busier), v3 (v1 look with a few touches).

Swapping in a real child's voice: put one clip per line in `source/audio/` named `n1.wav` ... `n10.wav`,
`hello.wav`, `great.wav`, `wow.wav`, `bye.wav` and re-run `audio_build3.py` and `render4.py`.
