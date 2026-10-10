import sys, math, subprocess, numpy as np
from PIL import Image
import render4 as R
from timeline7 import *
W, H = 1280, 720
FW = 1280*0 + 270   # width of the overlay counting panel

def clip_frames(name):
    p = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", f"clips/IMG_{name}.mov", "-vf", "scale=1280:-2,crop=1280:720", "-r", str(FPS),
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    sz = W*H*3
    while True:
        b = p.stdout.read(sz)
        if len(b) < sz: break
        yield Image.frombytes("RGB", (W, H), b).convert("RGBA")
    p.wait()

def counting_overlay(im, n, tt, interval):
    """compact ten-frame + progress stars, top-right corner"""
    s = 0.6; cx, cy = 1115, 95
    R.paste_c(im, R.FRAME10, cx, cy, s)
    obj = R.OBJ_FOR(n)
    for k in range(n):
        at = tt - (0.6 + k*interval)
        if at < 0: continue
        r, c = divmod(k, 5)
        R.paste_c(im, obj, cx + (c-2)*88*s, cy + (r-0.5)*88*s, R.out_back(at/0.3, 2.6)*0.72*s)
    for k in range(10):
        R.paste_c(im, R.GOLD if k < n else R.GREY, cx + (k-4.5)*27, cy + 78, 0.46)

TITLE1 = R.text_sprite("Count with Endrick", 92, (255,112,176), pad=18)
TITLE2 = R.text_sprite("1 to 10", 120, (52,190,224), pad=18)
END1 = R.text_sprite("Great job!", 140, (94,201,89), pad=18)
END2 = R.text_sprite("See you next time!", 84, (255,159,67), pad=14)

def card_frame(kind, t, f, st):
    im = R.background(t, f).convert("RGBA"); tt = t - st
    if kind == "title":
        R.full(im, 330, 712, 0.5*R.out_back(tt/0.6), rot=3*math.sin(t*5.5))
        R.paste_c(im, TITLE1, 820, 250, R.out_back((tt-0.3)/0.5, 2.2)*0.84, rot=2*math.sin(t*3))
        R.paste_c(im, TITLE2, 840, 410, R.out_back((tt-0.7)/0.5, 2.4), rot=-2*math.sin(t*2.6))
    elif kind == "end":
        R.confetti(im, t, st, 90)
        R.full(im, 320, 712 - abs(math.sin(tt*3.2))*10, 0.5, rot=4*math.sin(t*6))
        R.paste_c(im, END1, 850, 270, R.out_back(tt/0.5, 2.4), rot=3*math.sin(t*3))
        R.paste_c(im, END2, 840, 450, R.out_back((tt-0.5)/0.5, 2.2)*0.85)
    return im

def frames():
    for (kind, name, dur, n), st in zip(SEG, START):
        nf = int(round(dur*FPS))
        if kind == "clip":
            gen = clip_frames(name); interval = 0.45 if dur > 5 else 0.38
            for k in range(nf):
                try: im = next(gen)
                except StopIteration: break
                tt = k/FPS
                if n >= 1: counting_overlay(im, n, tt, interval)
                yield im, st + tt
            for _ in gen: pass
        else:
            for k in range(nf):
                t = st + k/FPS; f = int(t*FPS)
                if kind == "six":
                    im = R.background(t, f).convert("RGBA")
                    R.number_scene(im, t, f, 6, lambda kk: (t - st) - (1.3 - 0.4 + kk*0.22) + 0.0, st)
                else:
                    im = card_frame(kind, t, f, st)
                yield im, t

def finish(im, t):
    # short dip-to-white at every cut (video only, audio untouched)
    for st in START[1:] + [DURATION]:
        d = t - st
        if -0.0 <= d < 0.12: im = Image.blend(Image.new("RGBA", (W, H), (255,255,255,255)), im, d/0.12)
    if t < 0.4: im = Image.blend(Image.new("RGBA", (W, H), (255,255,255,255)), im, t/0.4)
    if t > DURATION - 0.7: im = Image.blend(im, Image.new("RGBA", (W, H), (255,255,255,255)), (t-(DURATION-0.7))/0.7)
    return im.convert("RGB")

if __name__ == "__main__":
    if sys.argv[1] == "still":
        want = [float(x) for x in sys.argv[2:]]; i = 0
        for im, t in frames():
            for w in want:
                if abs(t - w) < 0.5/FPS: finish(im, t).save(f"work/s7_{w}.png")
        sys.exit()
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", sys.argv[1]], stdin=subprocess.PIPE)
    c = 0
    for im, t in frames():
        p.stdin.write(finish(im, t).tobytes()); c += 1
        if c % 120 == 0: print(c, int(DURATION*FPS), flush=True)
    p.stdin.close(); p.wait(); print("frames", c)
