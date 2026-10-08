import math, random, subprocess, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from timeline import *

W, H = 1280, 720
FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
def font(sz): return ImageFont.truetype(FONT, sz)
PAL = [(255,92,92),(255,159,67),(255,206,43),(94,201,89),(52,190,224),(88,129,255),(165,104,240),(255,112,176),(38,198,168),(255,128,96)]
NUMS = ["ONE","TWO","THREE","FOUR","FIVE","SIX","SEVEN","EIGHT","NINE","TEN"]

# ---------- easing ----------
def clamp(x, a=0, b=1): return max(a, min(b, x))
def out_back(x, s=1.9):
    x = clamp(x)-1; return 1 + (s+1)*x**3 + s*x**2
def out_cubic(x): x = clamp(x); return 1-(1-x)**3
def smooth(x): x = clamp(x); return x*x*(3-2*x)

# ---------- sprite helpers (supersampled) ----------
def ss_draw(w, h, fn, k=3):
    im = Image.new("RGBA", (w*k, h*k), (0,0,0,0)); d = ImageDraw.Draw(im); fn(d, k)
    return im.resize((w, h), Image.LANCZOS)
def star_pts(cx, cy, R, r, rot=-math.pi/2):
    return [(cx+(R if i%2==0 else r)*math.cos(rot+i*math.pi/5), cy+(R if i%2==0 else r)*math.sin(rot+i*math.pi/5)) for i in range(10)]
def mk_star(size, col, outline=True):
    def fn(d, k):
        c = size*k/2
        if outline: d.polygon(star_pts(c, c*1.06, c*0.97, c*0.43), fill=(255,255,255,255))
        d.polygon(star_pts(c, c*1.06, c*0.84, c*0.37), fill=col+(255,))
        d.polygon(star_pts(c*0.92, c*0.95, c*0.4, c*0.17), fill=tuple(min(255,v+60) for v in col)+(255,))
    return ss_draw(size, size, fn)
def mk_ball(size, col):
    def fn(d, k):
        s = size*k
        d.ellipse((s*0.03, s*0.03, s*0.97, s*0.97), fill=(255,255,255,255))
        d.ellipse((s*0.08, s*0.08, s*0.92, s*0.92), fill=col+(255,))
        d.ellipse((s*0.2, s*0.16, s*0.45, s*0.36), fill=(255,255,255,170))
        d.arc((s*0.14, s*0.14, s*0.86, s*0.86), 20, 100, fill=tuple(int(v*0.7) for v in col)+(255,), width=int(s*0.05))
    return ss_draw(size, size, fn)
def mk_apple(size):
    def fn(d, k):
        s = size*k
        d.ellipse((s*0.05, s*0.18, s*0.95, s*0.98), fill=(255,255,255,255))
        d.ellipse((s*0.1, s*0.23, s*0.9, s*0.93), fill=(236,56,64,255))
        d.ellipse((s*0.22, s*0.3, s*0.42, s*0.5), fill=(255,255,255,150))
        d.rectangle((s*0.47, s*0.05, s*0.54, s*0.28), fill=(120,78,40,255))
        d.ellipse((s*0.52, s*0.04, s*0.85, s*0.24), fill=(94,201,89,255))
    return ss_draw(size, size, fn)
def mk_heart(size, col):
    def fn(d, k):
        s = size*k
        pts = []
        for i in range(120):
            t = i/120*2*math.pi
            x = 16*math.sin(t)**3; y = -(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))
            pts.append((s/2 + x*s/36, s*0.47 + y*s/36))
        d.polygon(pts, fill=col+(255,))
        d.ellipse((s*0.2, s*0.2, s*0.34, s*0.32), fill=(255,255,255,170))
    return ss_draw(size, size, fn)
def mk_cloud(w, h, alpha=235):
    def fn(d, k):
        for (x, y, r) in [(0.22,0.62,0.26),(0.42,0.42,0.34),(0.66,0.5,0.3),(0.82,0.66,0.22),(0.5,0.7,0.3)]:
            d.ellipse(((x-r)*w*k, (y-r*1.2)*h*k, (x+r)*w*k, (y+r*1.2)*h*k), fill=(255,255,255,alpha))
    return ss_draw(w, h, fn)
def mk_shape(kind, size, col):
    def fn(d, k):
        s = size*k
        if kind == "tri": d.polygon([(s/2, s*0.1), (s*0.92, s*0.85), (s*0.08, s*0.85)], fill=col+(255,))
        elif kind == "sq": d.rounded_rectangle((s*0.12, s*0.12, s*0.88, s*0.88), s*0.14, fill=col+(255,))
        elif kind == "circ": d.ellipse((s*0.1, s*0.1, s*0.9, s*0.9), fill=col+(255,))
        elif kind == "dia": d.polygon([(s/2, s*0.06), (s*0.94, s/2), (s/2, s*0.94), (s*0.06, s/2)], fill=col+(255,))
    return ss_draw(size, size, fn)
def text_sprite(txt, sz, fill, stroke=(255,255,255), sw=None, shadow=True, pad=24):
    sw = sw if sw is not None else max(4, sz//14)
    f = font(sz)
    l, t, r, b = f.getbbox(txt, stroke_width=sw)
    w, h = r-l+pad*2, b-t+pad*2
    im = Image.new("RGBA", (w+8, h+14), (0,0,0,0))
    if shadow:
        sh = Image.new("RGBA", im.size, (0,0,0,0)); ImageDraw.Draw(sh).text((pad-l+0, pad-t+8), txt, font=f, fill=(40,40,90,110), stroke_width=sw, stroke_fill=(40,40,90,110))
        im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(3)))
    ImageDraw.Draw(im).text((pad-l, pad-t), txt, font=f, fill=fill, stroke_width=sw, stroke_fill=stroke)
    return im
def tint_text(words, sz):
    """multi-colour title sprite: list of (txt,color)"""
    parts = [text_sprite(t, sz, c, stroke=(255,255,255), pad=6) for t, c in words]
    w = sum(p.width for p in parts); h = max(p.height for p in parts)
    im = Image.new("RGBA", (w, h), (0,0,0,0)); x = 0
    for p in parts: im.alpha_composite(p, (x, (h-p.height)//2)); x += p.width
    return im
def scaled(im, s): 
    w, h = max(1, int(im.width*s)), max(1, int(im.height*s)); return im.resize((w, h), Image.BILINEAR) if s != 1 else im
def paste_c(base, sp, cx, cy, scale=1.0, rot=0, alpha=1.0):
    if scale <= 0.01 or alpha <= 0.01: return
    if scale != 1: sp = sp.resize((max(1,int(sp.width*scale)), max(1,int(sp.height*scale))), Image.BILINEAR)
    if rot: sp = sp.rotate(rot, Image.BICUBIC, expand=True)
    if alpha < 1:
        a = sp.getchannel("A").point(lambda v: int(v*alpha)); sp = sp.copy(); sp.putalpha(a)
    base.paste(sp, (int(cx-sp.width/2), int(cy-sp.height/2)), sp)
def paste_b(base, sp, cx, by, scale=1.0, rot=0, sx=1.0, sy=1.0):
    """paste anchored at bottom-centre (cx, by)"""
    w, h = int(sp.width*scale*sx), int(sp.height*scale*sy)
    s = sp.resize((max(1,w), max(1,h)), Image.BICUBIC)
    if rot:
        pad = Image.new("RGBA", (s.width*2, s.height*2), (0,0,0,0)); pad.paste(s, (s.width//2, s.height))
        pad = pad.rotate(rot, Image.BICUBIC, center=(s.width, s.height*2))
        base.paste(pad, (int(cx-s.width), int(by-s.height*2)), pad); return
    base.paste(s, (int(cx-s.width/2), int(by-s.height)), s)

# ---------- assets ----------
CH = {n: Image.open(f"work/{n}.png").convert("RGBA") for n in ["main","talk","cheeks","thumb","blocks"]}
STARS = [mk_star(96, c) for c in PAL]
BALLS = [mk_ball(96, c) for c in PAL]
APPLE = mk_apple(96)
HEARTS = [mk_heart(96, c) for c in PAL]
OBJ_FOR = lambda i: [STARS, BALLS, [APPLE], HEARTS][(i-1) % 4][(i-1) % len([STARS, BALLS, [APPLE], HEARTS][(i-1) % 4])]
GOLD = mk_star(56, (255,206,43)); GREY = mk_star(56, (200,208,225), outline=False)
GREY.putalpha(GREY.getchannel("A").point(lambda v: int(v*0.7)))
NUMSPR = [text_sprite(str(i), 340 if i < 10 else 300, PAL[i-1], pad=30) for i in range(1, 11)]
WORDSPR = [text_sprite(w, 84, PAL[i], pad=14) for i, w in enumerate(NUMS)]
SMALLNUM = [text_sprite(str(i), 100, PAL[i-1], pad=14) for i in range(1, 11)]
CLOUD = [mk_cloud(300, 140), mk_cloud(220, 110), mk_cloud(380, 170, 200)]
SHAPES = [mk_shape(k, 64, PAL[(j*3+1) % 10]) for j, k in enumerate(["tri","sq","circ","dia","tri","sq","circ","dia","tri","circ"])]
TITLE_HELLO = text_sprite("Hello!", 150, (255,112,176), pad=20)
TITLE_NAME = text_sprite("I'm Andrik!", 96, (52,190,224), pad=16)
TITLE_COUNT = tint_text([("Let's ", (255,159,67)), ("Count ", (94,201,89)), ("1 ", (255,92,92)), ("to ", (165,104,240)), ("10!", (52,190,224))], 88)
SAY = text_sprite("Say it with me!", 66, (255,112,176), pad=12)
GREAT = text_sprite("Great job!", 120, (94,201,89), pad=18)
DID = text_sprite("You did it!", 124, (255,159,67), pad=18)
BYE = text_sprite("Bye-bye!", 150, (165,104,240), pad=18)

from PIL import ImageOps
SKIN = (255, 208, 172); SKIN_O = (205, 140, 105)
def mk_hand(n):
    def fn(d, k):
        def line(p0, p1, w, col):
            d.line([(p0[0]*k, p0[1]*k), (p1[0]*k, p1[1]*k)], fill=col, width=int(w*k))
            for p in (p0, p1): d.ellipse(((p[0]-w/2)*k, (p[1]-w/2)*k, (p[0]+w/2)*k, (p[1]+w/2)*k), fill=col)
        xs = [58, 92, 126, 160]; Ls = [125, 145, 128, 100]
        shapes = []
        # sleeve + palm
        for col, grow in ((SKIN_O, 6), (SKIN, 0)):
            d.rounded_rectangle(((38-grow)*k, (170-grow)*k, (182+grow)*k, (300+grow)*k), (55+grow)*k, fill=col+(255,))
            for i, x in enumerate(xs):
                if i < min(n, 4): line((x, 180), (x, 170-Ls[i]+16), 30+2*grow, col+(255,))
                else: d.ellipse(((x-16-grow)*k, (150-grow)*k, (x+16+grow)*k, (196+grow)*k), fill=col+(255,))
            if n >= 5: line((52, 250), (14, 178), 32+2*grow, col+(255,))
            else: d.ellipse(((46-grow)*k, (212-grow)*k, (122+grow)*k, (258+grow)*k), fill=col+(255,))
        for x in xs[:4]:  # tiny finger-nail highlights on raised fingers
            pass
        d.rounded_rectangle((30*k, 292*k, 190*k, 330*k), 14*k, fill=(150, 176, 232, 255))
        d.rounded_rectangle((30*k, 292*k, 190*k, 306*k), 8*k, fill=(176, 198, 240, 255))
    return ss_draw(220, 334, fn, 3)
HANDS = [mk_hand(n) for n in range(6)]
HANDS_R = [ImageOps.mirror(h) for h in HANDS]
PRAISE_SPR = {k: text_sprite(v[0], 74, v[1], pad=14) for k, v in PRAISE_TEXT.items()}
def burst(im, t, t0, cx, cy, n=12, R=260, life=0.9):
    tt = t - t0
    if not (0 < tt < life): return
    p = tt/life
    for j in range(n):
        a = j*2*math.pi/n + 0.3
        paste_c(im, STARS[(j*3) % 10], cx + R*out_cubic(p)*math.cos(a), cy + R*out_cubic(p)*math.sin(a), 0.5*(1-p)+0.1, rot=tt*300, alpha=1-p)

LOGO = text_sprite("Count with Andrik", 44, (88,129,255), pad=10)

# static background
def make_bg():
    bg = Image.new("RGB", (W, H)); px = ImageDraw.Draw(bg)
    for y in range(H):
        t = y/H
        c = (int(120+ (255-120)*t**1.2), int(205+(240-205)*t), int(255+(220-255)*t))
        px.line([(0, y), (W, y)], fill=c)
    # soft wall stripes
    ov = Image.new("RGBA", (W, H), (0,0,0,0)); od = ImageDraw.Draw(ov)
    for x in range(-40, W, 160): od.rectangle((x, 0, x+80, H), fill=(255,255,255,26))
    for i, col in enumerate([(255,92,92),(255,159,67),(255,206,43),(94,201,89),(52,190,224),(88,129,255),(165,104,240)]):
        r = 340 - i*26
        od.arc((1020-r, 610-r, 1020+r, 610+r), 180, 360, fill=col+(170,), width=28)
    od.pieslice((1000, 560, 1400, 840), 180, 360, fill=(120,210,120,170))
    # shelf with books bottom right
    od.rectangle((0, 548, W, 600), fill=(255,225,170,0))
    bg.paste(Image.alpha_composite(bg.convert("RGBA"), ov).convert("RGB"))
    d = ImageDraw.Draw(bg)
    # floor / rug
    d.rectangle((0, 640, W, H), fill=(255,233,190))
    for i, x in enumerate(range(-20, W, 120)): d.polygon([(x, 640), (x+60, 640), (x+40, H), (x-20, H)], fill=PAL[i % 10] if False else (255, 224-6*(i%3), 170))
    d.rectangle((0, 636, W, 646), fill=(255,190,110))
    return bg
BG = make_bg()
rng = random.Random(3)
CLOUDS = [(rng.uniform(0, W+300), rng.uniform(30, 300), rng.choice([0,1,2]), rng.uniform(8, 22)) for _ in range(5)]
FLOAT = [(rng.uniform(40, W-40), rng.uniform(90, 600), rng.randrange(len(SHAPES)), rng.uniform(0, 6.28), rng.uniform(0.6, 1.4)) for _ in range(14)]
TWINK = [(rng.uniform(20, W-20), rng.uniform(20, 560), rng.randrange(10), rng.uniform(0, 6.28)) for _ in range(16)]
BGNUM = [(120+ i*118, 470 + 40*math.sin(i*1.3), i) for i in range(10)]

def background(t, frame):
    im = BG.copy()
    for (x0, y, k, sp) in CLOUDS:
        x = (x0 + sp*t) % (W+400) - 200
        paste_c(im, CLOUD[k], x, y)
    for (x, y, k, ph, fs) in FLOAT:
        yy = y + 12*math.sin(t*fs+ph); paste_c(im, SHAPES[k], x, yy, 1.0 + 0.1*math.sin(t*2+ph), rot=18*math.sin(t*fs*0.8+ph), alpha=0.6)
    for (x, y, c, ph) in TWINK:
        s = 0.35 + 0.18*math.sin(t*3+ph); paste_c(im, STARS[c], x, y, max(0.1, s), rot=t*20+ph*10, alpha=0.9)
    return im

# ---------- character ----------
def envelope():
    v = np.load("work/voice_env_src.npy"); SR = 24000
    n = int(DURATION*FPS); env = np.zeros(n)
    for f in range(n):
        seg = v[int(f/FPS*SR): int((f+1)/FPS*SR)]
        env[f] = np.sqrt((seg**2).mean()) if len(seg) else 0
    return env
ENV = envelope()
def speaking(f):
    # flap: speaking when env above threshold; mouth open pattern toggled by frame parity block
    e = ENV[min(f, len(ENV)-1)]
    return e > 0.035

def bust(base, f, t, cx, scale=1.43, closed="thumb"):
    sp = speaking(f)
    bob = 7*math.sin(t*4.2)
    img = CH["talk"] if (sp and (f//3) % 2 == 0) else CH[closed if not sp else "talk" if (f//3) % 2 == 0 else closed]
    if sp and (f//3) % 2 == 1: img = CH[closed]
    sq = 1 + 0.012*math.sin(t*8) if sp else 1
    paste_b(base, img, cx, H+14+bob, scale, rot=2.5*math.sin(t*2.3), sy=sq)

def full(base, cx, by, scale, rot=0, sy=1.0, sx=1.0):
    paste_b(base, CH["main"], cx, by, scale, rot=rot, sx=sx, sy=sy)

def confetti(im, t, t0, n=70):
    r = random.Random(11)
    for i in range(n):
        x0 = r.uniform(0, W); sp = r.uniform(120, 260); ph = r.uniform(0, 6.28); k = r.randrange(10); sz = r.uniform(0.25, 0.55)
        tt = t - t0 - r.uniform(0, 1.2)
        if tt < 0: continue
        y = -40 + sp*tt
        if y > H+40: y = (y % (H+80)) - 40
        paste_c(im, SHAPES[k] if i % 2 else STARS[k], x0 + 40*math.sin(tt*2+ph), y, sz, rot=tt*160+ph*40)

def subtitle(im, txt, t, t0):
    if not txt: return
    f = font(36); d = ImageDraw.Draw(im, "RGBA")
    # wrap
    words, lines, cur = txt.split(), [], ""
    for w in words:
        trial = (cur+" "+w).strip()
        if f.getlength(trial) > W-140: lines.append(cur); cur = w
        else: cur = trial
    lines.append(cur)
    h = len(lines)*48+24; wmax = max(f.getlength(l) for l in lines)+60
    a = int(255*smooth((t-t0)/0.25))
    y = 22 - int(20*(1-smooth((t-t0)/0.25)))
    d.rounded_rectangle((W/2-wmax/2, y, W/2+wmax/2, y+h), 28, fill=(255,255,255,int(a*0.88)), outline=(255,255,255,a), width=3)
    for i, l in enumerate(lines): d.text((W/2, y+12+i*48+24), l, font=f, fill=(60,70,140,a), anchor="mm")

# ---------- active speech lookup ----------
def clip_at(t):
    cur = None
    for (s, n, sub) in V:
        e = s + INFO[n]
        if s - 0.05 <= t <= e + 0.6 and sub: cur = (s, n, sub)
    return cur

# ---------- scenes ----------
def scene_intro(im, t, f):
    # full figure, left-centre, sways/waves
    wave = math.sin(t*5.5)
    bounce = abs(math.sin(t*3.2))*14
    enter = out_back((t-0.0)/0.7)
    full(im, 320, 710 - bounce, 0.5*enter, rot=3.2*wave, sy=1+0.012*math.sin(t*6.4))
    # title popups
    if t >= 0.6: paste_c(im, TITLE_HELLO, 860, 255, out_back((t-0.6)/0.5, 2.4), rot=5*math.sin(t*3))
    if t >= 2.4: paste_c(im, TITLE_NAME, 860, 385, out_back((t-2.4)/0.5, 2.4), rot=-3*math.sin(t*2.6))
    # floating numbers on "today"
    if t >= 8.4:
        for i in range(10):
            tt = t - (8.5 + i*0.28)
            if tt < 0: continue
            cx = 590 + i*64; cy = 620
            sc = out_back(tt/0.5, 2.2)*0.62
            paste_c(im, SMALLNUM[i], cx, cy + 12*math.sin(t*3+i), sc, rot=8*math.sin(t*2.2+i))
    if t >= 8.2:
        a = smooth((t-8.2)/0.4)
        paste_c(im, TITLE_COUNT, 880, 505, out_back((t-8.2)/0.6, 1.6)*0.82, rot=0)

def praise_popup(im, t, cx, cy, scale=1.0):
    for (st, nm, _) in V:
        if nm in PRAISE_SPR and st - 0.05 <= t <= st + 1.6:
            tt = t - st
            paste_c(im, PRAISE_SPR[nm], cx, cy - 6*math.sin(t*6), out_back(tt/0.4, 2.6)*scale*(1 if tt < 1.3 else 1-(tt-1.3)/0.3), rot=-4+5*math.sin(t*5))

def scene_count(im, t, f, i):
    t0 = TB + (i-1)*SLOT_B + 0.4
    tt = t - t0
    bust(im, f, t, 270, 1.45, closed="thumb" if i % 2 == 0 else "cheeks")
    burst(im, t, t0, 700, 280)
    for (st, nm, _) in V:
        if nm in PRAISE_SPR and TB-1 < st < T_GREAT: burst(im, t, st, 1060, 160, n=10, R=170)
    for k in range(6):
        ang = k*1.05 + t*0.8; r = 210 + 30*math.sin(t*3+k)
        paste_c(im, STARS[(i+k) % 10], 700 + r*math.cos(ang)*1.1, 280 + r*math.sin(ang)*0.8, 0.28 + 0.1*math.sin(t*5+k), rot=t*60+k*30, alpha=0.9)
    sc = out_back(tt/0.55, 2.4)
    paste_c(im, NUMSPR[i-1], 700, 265 - 8*math.sin(t*3.5), sc*0.9, rot=4*math.sin(t*4))
    if tt > 0.25: paste_c(im, WORDSPR[i-1], 700, 462, out_back((tt-0.25)/0.4, 2), rot=-1.5*math.sin(t*3))
    # finger counting: one finger per popped object
    shown = sum(1 for k in range(i) if tt - (0.9 + k*0.2) > 0)
    last_at = (tt - (0.9 + (shown-1)*0.2)) if shown else 9
    popk = 1 + 0.12*max(0, 1 - last_at/0.2)
    if i <= 5:
        paste_c(im, HANDS[shown], 1080, 380 - 6*math.sin(t*3), 1.0*popk, rot=3*math.sin(t*2.5))
    else:
        paste_c(im, HANDS[5], 975, 390, 0.82, rot=-3*math.sin(t*2.5))
        paste_c(im, HANDS_R[max(0, shown-5)], 1165, 390 - 6*math.sin(t*3), 0.82*(popk if shown > 5 else 1), rot=3*math.sin(t*2.5))
    # objects
    cols = 5
    obj = OBJ_FOR(i)
    for k in range(i):
        at = tt - (0.9 + k*0.2)
        if at < 0: continue
        row, col = divmod(k, cols); n_in_row = min(cols, i - row*cols)
        total_rows = (i-1)//cols + 1
        spacing = 96
        x = 700 + (col - (n_in_row-1)/2)*spacing
        y = (610 if total_rows == 1 else 548 + row*84)
        s2 = out_back(at/0.35, 2.8)*(0.78 if total_rows == 1 else 0.7)
        paste_c(im, obj, x, y - 6*math.sin(t*4+k), s2)
    praise_popup(im, t, 1060, 150)

def scene_great(im, t, f):
    bust(im, f, t, 270, 1.45, closed="thumb")
    paste_c(im, GREAT, 760, 250, out_back((t-T_GREAT)/0.5, 2.4), rot=4*math.sin(t*3))
    paste_c(im, text_sprite("Let's count together!", 70, (52,190,224), pad=12), 760, 410, out_back((t-T_GREAT-0.9)/0.5, 2.2), rot=-2*math.sin(t*3))
    for k in range(10):
        paste_c(im, STARS[k], 500 + k*80, 600, out_back((t-T_GREAT-1.2-k*0.08)/0.4, 2.5)*0.7, rot=t*30+k*20)

def scene_repeat(im, t, f, i):
    t0 = TC + (i-1)*SLOT_C; tt = t - t0
    bust(im, f, t, 270, 1.45, closed="thumb" if i % 2 == 0 else "cheeks")
    burst(im, t, t0, 700, 290, n=10, R=230)
    sc = out_back(tt/0.5, 2.4)
    paste_c(im, NUMSPR[i-1], 700, 270 - 8*math.sin(t*3.5), sc*0.95, rot=4*math.sin(t*4))
    paste_c(im, WORDSPR[i-1], 700, 470, out_back((tt-0.2)/0.4, 2), rot=-1.5*math.sin(t*3))
    if tt > INFO[f"n{i}"] + 0.1 and tt < 1.5:
        pulse = 1 + 0.06*math.sin(t*8)
        paste_c(im, SAY, 1030, 190, out_back((tt-INFO[f'n{i}']-0.1)/0.35, 2)*0.85*pulse, rot=-4)
    praise_popup(im, t, 1030, 330)
    for (st, nm, _) in V:
        if nm in PRAISE_SPR and TC-1 < st < T_WOW: burst(im, t, st, 1030, 330, n=10, R=170)
    for k in range(10):
        lit = k < i
        spr = GOLD if lit else GREY
        sc2 = out_back(tt/0.4, 3) if k == i-1 else 1.0
        paste_c(im, spr, 500 + k*80, 640, sc2*(1+0.06*math.sin(t*5+k) if lit else 1), rot=t*25 if lit else 0)

def scene_end(im, t, f):
    confetti(im, t, T_WOW - 0.1, 110)
    if t < T_WOW + 0.8: burst(im, t, T_WOW, 850, 300, n=16, R=330, life=1.2)
    # jump: two jumps during wow, then wave
    if t < T_BYE - 0.3:
        tj = (t - T_WOW)*1.9
        jump = abs(math.sin(clamp(tj, 0, 2.6)*math.pi))*110 if tj < 2.6 else 0
        full(im, 320, 710 - jump, 0.5, rot=3*math.sin(t*9), sy=1.0 + (0.03*math.sin(clamp(tj,0,2.6)*math.pi*2)))
        paste_c(im, DID, 850, 260, out_back((t-T_WOW)/0.5, 2.4), rot=3*math.sin(t*4))
        paste_c(im, text_sprite("You are amazing!", 76, (255,112,176), pad=14), 850, 430, out_back((t-T_WOW-0.9)/0.5, 2.2), rot=-2*math.sin(t*3.4))
    else:
        full(im, 330, 710 - abs(math.sin(t*3.2))*10, 0.5, rot=4*math.sin(t*6))
        paste_c(im, BYE, 850, 270, out_back((t-T_BYE+0.3)/0.5, 2.4), rot=4*math.sin(t*3))
        paste_c(im, text_sprite("See you next time!", 70, (52,190,224), pad=12), 850, 450, out_back((t-T_BYE-0.4)/0.5, 2.2))

def frame(f):
    t = f/FPS
    im = background(t, f).convert("RGBA")
    if t < TB - 0.2: scene_intro(im, t, f)
    elif t < T_GREAT - 0.05:
        i = max(1, sum(1 for k in range(10) if TB + k*SLOT_B + 0.4 - 0.05 <= t))
        scene_count(im, t, f, i)
    elif t < TC - 0.3: scene_great(im, t, f)
    elif t < T_WOW - 0.3:
        i = max(1, sum(1 for k in range(10) if TC + k*SLOT_C - 0.05 <= t))
        scene_repeat(im, t, f, i)
    else: scene_end(im, t, f)
    c = clip_at(t)
    if c: subtitle(im, c[2], t, c[0])
    paste_c(im, LOGO, W-190, H-34, 0.8, alpha=0.8)
    # fade in/out
    if t < 0.5: im = Image.blend(Image.new("RGBA", (W, H), (255,255,255,255)), im, smooth(t/0.5))
    if t > DURATION-0.8: im = Image.blend(im, Image.new("RGBA", (W, H), (255,255,255,255)), smooth((t-(DURATION-0.8))/0.8))
    return im.convert("RGB")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "still":
        for ts in [float(x) for x in sys.argv[2:]]:
            frame(int(ts*FPS)).save(f"work/still_{ts}.png")
        sys.exit()
    out = sys.argv[1] if len(sys.argv) > 1 else "work/video_silent.mp4"
    N = int(DURATION*FPS)
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", out], stdin=subprocess.PIPE)
    for f in range(N):
        p.stdin.write(frame(f).tobytes())
        if f % 120 == 0: print(f, N, flush=True)
    p.stdin.close(); p.wait()
