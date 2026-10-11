import sys, math, subprocess, numpy as np, cv2, soundfile as sf
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import render4 as R
import render2 as R2
from spec10 import *
import wm

W, H, FPS = 1280, 720, 30
SR = 24000
TITLE_DUR = 2.8
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
def counting_card(im, n, t, ons):
    if n <= 0: return
    t_on = ons[0]; pop = R.out_back((t - 0.1)/0.4, 2.2)
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

def draw_caption(im, units, t, vis=(0, 9e9)):
    """karaoke line: words appear dimmed, brighten when spoken, active one pops in gold"""
    if not (vis[0] <= t <= vis[1]): return
    f = R.font(56); gap = 22
    ws = [f.getlength(u[0]) for u in units]; total = sum(ws) + gap*(len(units) - 1)
    x = W/2 - total/2; y = 664
    d = ImageDraw.Draw(im, "RGBA")
    a_line = R.smooth((t - vis[0])/0.25) * (1 if t < vis[1] - 0.2 else max(0, (vis[1] - t)/0.2))
    for (txt, t0), w in zip(units, ws):
        dt = t - t0
        spoken = dt >= 0
        col = (255, 255, 255, int(255*a_line)) if spoken else (255, 255, 255, int(120*a_line))
        if spoken and dt < 0.55:
            k = dt/0.55; mix = 1 - R.smooth(k)
            col = tuple(int(c*(1 - mix) + g*mix) for c, g in zip((255, 255, 255), GOLD)) + (int(255*a_line),)
        sc = 1.0 + (0.10*math.sin(min(1, dt/0.25)*math.pi) if 0 <= dt < 0.25 else 0)
        # shadow
        d.text((x + w/2 + 2, y + 3), txt, font=f, fill=(0, 0, 0, int(150*a_line)), anchor="mm", stroke_width=2, stroke_fill=(0, 0, 0, int(120*a_line)))
        d.text((x + w/2, y), txt, font=f, fill=col, anchor="mm")
        x += w + gap

def units_for(item):
    n = item["n"]; ons = item["ons"]
    if n > 0:
        wd = NUMW[n] + "!"
        return [[(wd, ons[0]), (wd, ons[1]), ("Great job!", ons[2])]], [(0.0, 9e9)]
    return [[("Great job!", ons[0]), ("You did it!", ons[1])], [("See you next time!", ons[2]), ("Bye-bye!", ons[3])]], [(0.0, ons[2] - 0.1), (ons[2] - 0.1, 9e9)]

# ---------- title ----------
TITLE1 = R.text_sprite("Count with Endrick", 92, (255, 112, 166), pad=18)
TITLE2 = R.text_sprite("1 to 10", 120, (52, 190, 224), pad=18)
def title_frame(t):
    im = R.background(t, int(t*24)).convert("RGBA"); tt = t
    R.full(im, 330, 712, 0.5*R.out_back(tt/0.6), rot=3*math.sin(t*5.5))
    R.paste_c(im, TITLE1, 820, 250, R.out_back((tt - 0.3)/0.5, 2.2)*0.84, rot=2*math.sin(t*3))
    R.paste_c(im, TITLE2, 840, 400, R.out_back((tt - 0.7)/0.5, 2.4), rot=-2*math.sin(t*2.6))
    for i in range(10):
        R.paste_c(im, R.SMALLNUM[i], 600 + i*62, 560 + 6*math.sin(t*3 + i), R.out_back((tt - 1.0 - i*0.1)/0.4, 2.4)*0.62, rot=6*math.sin(t*2 + i))
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
        im.alpha_composite(brand_pill(), (22, 16))
        counting_card(im, item["n"], t, item["ons"])
        for units, v in zip(unit_lines, vis): draw_caption(im, units, t, v)
        yield im

def finish(im, t):
    if t < 0.35: im = Image.blend(Image.new("RGBA", (W, H), (255, 255, 255, 255)), im, t/0.35)
    if t > TOTAL - 0.8: im = Image.blend(im, Image.new("RGBA", (W, H), (255, 255, 255, 255)), (t - (TOTAL - 0.8))/0.8)
    # soft dip where the title card meets the first clip
    d = t - TITLE_DUR
    if 0 <= d < 0.14: im = Image.blend(Image.new("RGBA", (W, H), (255, 255, 255, 255)), im, d/0.14)
    if -0.14 < d < 0: im = Image.blend(im, Image.new("RGBA", (W, H), (255, 255, 255, 255)), -d/0.14)
    return im.convert("RGB")

def frames():
    for item in ITEMS:
        if item["kind"] == "title":
            for k in range(int(round(item["dur"]*FPS))): yield title_frame(k/FPS), item["st"] + k/FPS
        else:
            for k, im in enumerate(clip_frames(item)): yield im, item["st"] + k/FPS

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
