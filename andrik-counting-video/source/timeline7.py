# Segment table for the final video built from the user's real clips.
# kind, name, duration, number (for counted clips)
SEG = [
 ("title", None,   2.6, None),
 ("clip",  "0347",  5.2, 0),    # overview of 1..10 (intro)
 ("clip",  "0341",  5.2, 1),
 ("clip",  "0337",  5.2, 2),
 ("clip",  "0336",  5.2, 3),
 ("clip",  "0335",  5.2, 4),
 ("clip",  "0338",  5.2, 5),
 ("six",   None,    3.4, 6),    # no clip for SIX yet: clean picture slide + TTS
 ("clip",  "0327",  4.5, 7),
 ("clip",  "0324",  5.2, 8),
 ("clip",  "0323",  5.2, 9),
 ("clip",  "0320",  5.2, 10),
 ("end",   None,    3.6, None),
]
START = []; t = 0.0
for s in SEG: START.append(t); t += s[2]
DURATION = t
FPS = 24
