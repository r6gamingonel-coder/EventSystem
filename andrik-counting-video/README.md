# Andrik counts 1 to 10

`andrik_counting_1_to_10_v2.mp4` (current) is 83.5 s, 1280x720 (16:9), 24 fps. `andrik_counting_1_to_10.mp4` is the first version.

It is built from the character reference sheet with Python, Pillow and ffmpeg.
The voice is Kokoro TTS (`af_heart`). Sound effects and the music-box loop are synthesized.

Rebuild (`source/` scripts, run in order from a directory holding the Kokoro and u2net models):
`cut.py` (character cutouts), `tts.py`, `audio_build.py`, `render.py`, then mux `work/mix.wav` with ffmpeg.
