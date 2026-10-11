import sys, math, subprocess, numpy as np, cv2, soundfile as sf
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import render4 as R
import render2 as R2
from spec10 import *
import wm

W, H, FPS = 1280, 720, 30
SR = 24000
TITLE_DUR = 3.0
OUTRO_DUR = 3.8
GOLD = (255, 214, 90)

# ---------- clip plan ----------
def plan():
    items = []; t = 0.0
    items.append(dict(kind="title", st=t, dur=TITLE_DUR)); t += TITLE_DUR
    for (name, n, dur, pieces, ons) in CLIPS:
        # output geometry of the pieces (cross-dissolve overlap between pieces)
        outs = []; o = 0.0
        for i, (a, b) in enumerate(pieces):
            if i > 0: o -= XF
            outs.append((o, a, b)); o += (b - a)
        total = round(o*FPS)/FPS
        first_src = pieces[0][0]
        def to_out(ts):
            for (o0, a, b) in outs:
                if a - 1e-6 <= ts <= b + 1e-6: return o0 + (ts - a)
            return max(0, ts - first_src)
        items.append(dict(kind="clip", name=name, n=n, st=t, dur=total, pieces=pieces, outs=outs, ons=[to_out(x) for x in ons]))
        t += total
    items.append(dict(kind="outro", st=t, dur=OUTRO_DUR)); t += OUTRO_DUR
    return items, t
ITEMS, TOTAL = plan()

# ---------- video ----------
def read_all(name):
    p = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", f"clips/IMG_{name}.mov", "-vf", "scale=1280:-2,crop=1280:720", "-r", "30",
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], capture_output=True)
    return np.frombuffer(p.stdout, np.uint8).reshape(-1, 720, 1280, 3)

# watermark removal on the corner crop only
CROP = (0, 120, 0, 340)
_M = cv2.imread("work/wm_mask.png", 0)[0:120, 0:340]
_Md = cv2.dilate(_M, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
_valid = (_Md == 0).astype(np.float32)
_feather = cv2.GaussianBlur((_Md > 0).astype(np.float32), (0, 0), 1.3)[..., None]
_SIG = [2.5, 5, 10, 20, 40]; _den = [cv2.GaussianBlur(_valid, (0, 0), s) for s in _SIG]
def clean_corner(img):
    c = img[0:120, 0:340].astype(np.float32); fill = np.zeros_like(c); done = np.zeros(c.shape[:2], bool)
    for s, d in zip(_SIG, _den):
        num = cv2.GaussianBlur(c*_valid[..., None], (0, 0), s); ok = (d > 0.12) & ~done
        fill[ok] = num[ok]/d[ok][:, None]; done |= ok
    fill[~done] = c[~done]
    img[0:120, 0:340] = np.clip(c*(1 - _feather) + fill*_feather, 0, 255).astype(np.uint8)
    return img

# frosted caption strip (also hides any text burned into the source clips)
SY = 584
_ramp = np.clip((np.arange(H - SY) - 0)/18.0, 0, 1); _ramp = (_ramp*_ramp*(3 - 2*_ramp))[:, None, None].astype(np.float32)
def frost(img, sy=SY):
    ramp = np.clip((np.arange(H - sy))/18.0, 0, 1); ramp = (ramp*ramp*(3 - 2*ramp))[:, None, None].astype(np.float32)
    strip = img[sy:H].astype(np.float32)
    bl = cv2.GaussianBlur(img[sy - 20:H], (0, 0), 22)[20:].astype(np.float32)*0.5
    img[sy:H] = np.clip(strip*(1 - ramp) + bl*ramp, 0, 255).astype(np.uint8)
    return img

# ---------- overlays ----------
BRAND = None
def brand_pill():
    global BRAND
    if BRAND is None:
        f = R.font(30); txt = "Count with Endrick"; w = int(f.getlength(txt)) + 44; h = 52; k = 3
        im = Image.new("RGBA", (w*k, h*k), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rounded_rectangle((0, 0, w*k - 1, h*k - 1), 26*k, fill=(70, 110, 240, 238))
        im = im.resize((w, h), Image.LANCZOS); d = ImageDraw.Draw(im)
        d.text((w/2, h/2 + 1), txt, font=f, fill=(255, 255, 255, 255), anchor="mm")
        BRAND = im
    return BRAND
PANEL = None
def panel_sprite():
    global PANEL
    if PANEL is None:
        w, h, k = 292, 262, 3
        im = Image.new("RGBA", (w*k, h*k), (0, 0, 0, 0)); ImageDraw.Draw(im).rounded_rectangle((0, 0, w*k - 1, h*k - 1), 30*k, fill=(255, 255, 255, 214), outline=(255, 255, 255, 255), width=3*k)
        PANEL = im.resize((w, h), Image.LANCZOS)
    return PANEL
def counting_card(im, n, t, ons, first=False):
    if n <= 0: return
    t_on = ons[0]; pop = R.out_back((t - 0.1)/0.4, 2.2) if first else 1.0
    pulse = 1.0
    if len(ons) > 1:
        d = t - ons[1]
        if 0 <= d < 0.35: pulse = 1 + 0.07*math.sin(d/0.35*math.pi)
    cx, cy = 1118, 150
    R.paste_c(im, panel_sprite(), cx, cy, pop*pulse)
    if pop < 0.5: return
    step = 0.1; k_vis = sum(1 for k in range(n) if t - (t_on + k*step) > 0)
    s = pop*pulse
    # hands: fingers rise with the count
    if n <= 5:
        R.paste_c(im, R2.HANDS[k_vis], cx, cy - 60*s, 0.36*s)
    else:
        R.paste_c(im, R2.HANDS[5], cx - 44*s, cy - 60*s, 0.30*s)
        R.paste_c(im, R2.HANDS_R[max(0, k_vis - 5)], cx + 44*s, cy - 60*s, 0.30*s)
    # neat ten-frame with the counted objects
    R.paste_c(im, R.FRAME10, cx, cy + 66*s, 0.52*s)
    obj = R.OBJ_FOR(n)
    for k in range(n):
        at = t - (t_on + k*step)
        if at < 0: continue
        r, c = divmod(k, 5)
        R.paste_c(im, obj, cx + (c - 2)*88*0.52*s, cy + 66*s + (r - 0.5)*88*0.52*s, R.out_back(at/0.25, 2.6)*0.72*0.52*s)

def _scale_alpha(layer, k):
    al = layer.getchannel("A").point(lambda v: int(v*k)); layer.putalpha(al); return layer

def draw_caption(im, units, t, vis=(0, 9e9), mul=1.0):
    """karaoke line built from real alpha layers: soft shadow, dim (not yet said) words, bright (said) words"""
    if not (vis[0] <= t <= vis[1]): return
    a_line = R.smooth((t - vis[0])/0.25) * (1 if t < vis[1] - 0.2 else max(0, (vis[1] - t)/0.2)) * mul
    if a_line <= 0.012: return
    f = R.font(56); gap = 22; LH = 150; cy = LH//2
    ws = [f.getlength(u[0]) for u in units]; total = sum(ws) + gap*(len(units) - 1)
    x = W/2 - total/2
    sh = Image.new("RGBA", (W, LH), (0, 0, 0, 0)); dim = Image.new("RGBA", (W, LH), (0, 0, 0, 0)); bright = Image.new("RGBA", (W, LH), (0, 0, 0, 0))
    ds, dd, db = ImageDraw.Draw(sh), ImageDraw.Draw(dim), ImageDraw.Draw(bright)
    for (txt, t0), w in zip(units, ws):
        dts = t - t0
        cx = x + w/2
        if dts < 0:
            dd.text((cx, cy), txt, font=f, fill=(255, 255, 255, 255), anchor="mm")
        else:
            col = (255, 255, 255)
            if dts < 0.55:
                mix = 1 - R.smooth(dts/0.55); col = tuple(int(c*(1 - mix) + g*mix) for c, g in zip(col, GOLD))
            sc = 1.0 + (0.10*math.sin(min(1, dts/0.25)*math.pi) if dts < 0.25 else 0)
            ff = R.font(int(56*sc)) if sc != 1.0 else f
            db.text((cx, cy), txt, font=ff, fill=col + (255,), anchor="mm")
        ds.text((cx + 2, cy + 3), txt, font=f, fill=(0, 0, 0, 255), anchor="mm", stroke_width=2, stroke_fill=(0, 0, 0, 255))
        x += w + gap
    sh = sh.filter(ImageFilter.GaussianBlur(2.2))
    for lay, k in ((sh, 0.55*a_line), (dim, 0.5*a_line), (bright, a_line)):
        im.alpha_composite(_scale_alpha(lay, k), (0, 664 - cy))

def units_for(item):
    n = item["n"]; ons = item["ons"]
    if n > 0:
        wd = NUMW[n] + "!"
        return [[(wd, ons[0]), (wd, ons[1]), ("Great job!", ons[2])]], [(0.0, 9e9)]
    return [[("Great job!", ons[0]), ("You did it!", ons[1])], [("See you next time!", ons[2]), ("Bye-bye!", ons[3])]], [(0.0, ons[2] - 0.1), (ons[2] - 0.1, 9e9)]

# ---------- brand assets (from the user's own video) ----------
LOGO_CARD = Image.open("work/logo_card.png").convert("RGBA")
_b = cv2.imread("work/badge_rgba.png", cv2.IMREAD_UNCHANGED)
BADGE_FULL = Image.fromarray(cv2.cvtColor(_b, cv2.COLOR_BGRA2RGBA))
BADGE_SMALL = BADGE_FULL.resize((176, int(BADGE_FULL.height*176/BADGE_FULL.width)), Image.LANCZOS)
def star_burst(im, t, t0, cx, cy, n=12, R0=170, life=0.9):
    tt = t - t0
    if not (0 < tt < life): return
    p = tt/life
    for j in range(n):
        a = j*2*math.pi/n + 0.25
        r = R0*R.out_cubic(p)
        R.paste_c(im, R.STARS[(j*3) % 10], cx + r*math.cos(a), cy + r*math.sin(a), 0.5*(1 - p) + 0.12, rot=tt*260, alpha=max(0.0, 1 - p*1.1))

# ---------- title ----------
TITLE1 = R.text_sprite("Count with Endrick", 92, (255, 112, 166), pad=18)
TITLE2 = R.text_sprite("1 to 10", 120, (52, 190, 224), pad=18)
def sparkle_layer(im, t, seed=0):
    r = np.random.RandomState(seed)
    for i in range(14):
        x, y, ph = r.uniform(40, 1240), r.uniform(30, 690), r.uniform(0, 6.28)
        k = 0.22 + 0.16*math.sin(t*3 + ph)
        R.paste_c(im, R.STARS[i % 10], x, y, max(0.05, k), rot=t*40 + ph*30, alpha=0.9)
def title_frame(t):
    im = Image.new("RGBA", (W, H), (252, 252, 252, 255))
    sparkle_layer(im, t, 3)
    sc = R.out_back(t/0.9, 1.5)*(1 + 0.012*math.sin(t*3))
    R.paste_c(im, LOGO_CARD, 640, 360 + 4*math.sin(t*2.4), sc*0.93, rot=0.8*math.sin(t*1.9))
    return im

OUTRO1 = R.text_sprite("Thanks for watching!", 84, (255, 112, 166), pad=16)
OUTRO2 = R.text_sprite("See you in the next video!", 56, (52, 190, 224), pad=14)
def outro_frame(t):
    im = R.background(t, int(t*24)).convert("RGBA")
    R.confetti(im, t, 0.0, 70)
    R.paste_c(im, BADGE_FULL, 330, 360 + 6*math.sin(t*2.6), 2.0*R.out_back(t/0.7, 1.6), rot=2*math.sin(t*1.8))
    R.paste_c(im, OUTRO1, 905, 250, R.out_back((t - 0.35)/0.5, 2.2)*0.82, rot=2*math.sin(t*3))
    R.paste_c(im, OUTRO2, 905, 360, R.out_back((t - 0.75)/0.5, 2.2)*0.9)
    for i in range(10):
        R.paste_c(im, R.SMALLNUM[i], 600 + i*62, 520 + 6*math.sin(t*3 + i), R.out_back((t - 1.1 - i*0.08)/0.4, 2.4)*0.62, rot=6*math.sin(t*2 + i))
    return im

def clip_frames(item):
    fr = read_all(item["name"]); nfr = len(fr)
    unit_lines, vis = units_for(item)
    for k in range(int(round(item["dur"]*FPS))):
        t = k/FPS
        # pick source frame(s)
        srcs = []
        for (o0, a, b) in item["outs"]:
            if o0 - 1e-6 <= t <= o0 + (b - a) + 1e-6: srcs.append((o0, a, b))
        def getf(o0, a):
            return fr[min(nfr - 1, max(0, int(round((a + (t - o0))*30))))].copy()
        if len(srcs) == 2:
            (o1, a1, b1), (o2, a2, b2) = srcs; al = (t - o2)/XF
            img = cv2.addWeighted(getf(o1, a1), 1 - al, getf(o2, a2), al, 0)
        else:
            img = getf(srcs[-1][0], srcs[-1][1])
        img = clean_corner(img); img = frost(img, 556 if item['name'] == '0341' else SY)
        im = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).convert("RGBA")
        im.alpha_composite(BADGE_SMALL, (10, 4))
        counting_card(im, item["n"], t, item["ons"], first=(item["name"] == CLIPS[0][0]))
        if item["n"] > 0: star_burst(im, t, item["ons"][2], 1118, 150)
        yield im

TX = 0.35   # dissolve length at every join

def finish(im, t):
    if t < 0.35: im = Image.blend(Image.new("RGBA", (W, H), (255, 255, 255, 255)), im, t/0.35)
    if t > TOTAL - 0.8: im = Image.blend(im, Image.new("RGBA", (W, H), (255, 255, 255, 255)), (t - (TOTAL - 0.8))/0.8)
    return im.convert("RGB")

def frames():
    prev = None   # (last base frame, last local time, caption data of that item)
    for item in ITEMS:
        if item["kind"] == "title":
            gen = (title_frame(k/FPS) for k in range(int(round(item["dur"]*FPS))))
            cap = None
        elif item["kind"] == "outro":
            gen = (outro_frame(k/FPS) for k in range(int(round(item["dur"]*FPS)))); cap = None
        else:
            gen = clip_frames(item); cap = units_for(item)
        for k, base in enumerate(gen):
            tl = k/FPS; im = base
            if prev is not None and tl < TX:
                al = R.smooth(tl/TX)
                im = Image.blend(prev[0], base, al)
                if prev[2] is not None:
                    for units, v in zip(*prev[2]): draw_caption(im, units, prev[1], (v[0], 9e9), mul=max(0.0, 1 - al*2.2))
                if cap is not None:
                    for units, v in zip(*cap): draw_caption(im, units, tl, v, mul=max(0.0, (al - 0.45)*1.8))
            elif cap is not None:
                im = base.copy()
                for units, v in zip(*cap): draw_caption(im, units, tl, v)
            last = (base, tl, cap)
            yield im, item["st"] + tl
        prev = last

# ---------- audio ----------
def build_audio(path):
    N = int(TOTAL*SR) + SR; out = np.zeros(N); sfx = np.zeros(N); music = np.zeros(N)
    def put(buf, t, s, g=1.0):
        i = int(t*SR); e = min(N, i + len(s))
        if i < N: buf[i:e] += s[:e - i]*g
    def tone(f, d, decay=6, harm=(1,), amp=1.0):
        tt = np.arange(int(d*SR))/SR
        return sum(np.sin(2*np.pi*f*h*tt)/h for h in harm)*np.exp(-decay*tt)*amp*np.minimum(1, tt/0.004)
    for item in ITEMS:
        if item["kind"] == "outro":
            for j, f in enumerate([523, 659, 784, 1047]): put(sfx, item["st"] + 0.15 + j*0.1, tone(f, 0.9, 3.5, (1, 2), 0.6), 0.3)
            pent = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]; pat = [0, 2, 4, 2, 3, 4, 5, 4]; t = item["st"]; k = 0
            while t < item["st"] + item["dur"] - 0.3:
                put(music, t, tone(pent[pat[k % 8]], 1.0, 3.5, (1, 2, 3), 0.5), 0.5); t += 0.5; k += 1
            continue
        if item["kind"] == "title":
            for j, f in enumerate([784, 988, 1175, 1568]): put(sfx, 0.15 + j*0.09, tone(f, 0.8, 4, (1, 2), 0.6), 0.3)
            pent = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]; pat = [0, 2, 4, 2, 3, 4, 5, 4]; t = 0.0; k = 0
            while t < TITLE_DUR - 0.2:
                put(music, t, tone(pent[pat[k % 8]], 1.0, 3.5, (1, 2, 3), 0.5), 0.5); t += 0.5; k += 1
            continue
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"clips/IMG_{item['name']}.mov", "-vn", "-ac", "1", "-ar", str(SR), "work/ca.wav"], check=True)
        y, _ = sf.read("work/ca.wav"); y = y*min(0.27/np.sqrt((y**2).mean()), 0.95/np.abs(y).max())
        seg_total = int(round(item["dur"]*SR + 1)); buf = np.zeros(seg_total + SR)
        for i, (o0, a, b) in enumerate(item["outs"]):
            piece = y[int(a*SR):int(b*SR)].copy(); L = len(piece); fi = int(XF*SR) if i > 0 else int(0.02*SR); fo = int(XF*SR) if i < len(item["outs"]) - 1 else int(0.02*SR)
            piece[:fi] *= np.linspace(0, 1, fi); piece[-fo:] *= np.linspace(1, 0, fo)
            s0 = int(o0*SR); buf[s0:s0 + L] += piece
        put(out, item["st"], buf[:seg_total])
    mix = out + sfx*0.9 + music*0.12; mix = mix/np.abs(mix).max()*0.92
    sf.write(path, mix[:int(TOTAL*SR)], SR)

if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "audio": build_audio("work/mix10.wav"); print("audio ok", round(TOTAL, 2)); sys.exit()
    if mode == "still":
        want = [float(x) for x in sys.argv[2:]]
        for im, t in frames():
            for w in want:
                if abs(t - w) < 0.5/FPS: finish(im, t).save(f"work/s10_{w}.png")
        sys.exit()
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", sys.argv[2]], stdin=subprocess.PIPE)
    c = 0
    for im, t in frames():
        p.stdin.write(finish(im, t).tobytes()); c += 1
        if c % 150 == 0: print(c, int(TOTAL*FPS), flush=True)
    p.stdin.close(); p.wait(); print("frames", c)
