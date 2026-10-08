s = open("render3.py").read()
s = s.replace("Andrik", "Endrick")
s = s.replace("LOGO = text_sprite(", '''NUMIMG = {i: Image.open(f"numimgs/{i}.png").convert("RGBA") for i in range(1, 11)}
def mk_panel():
    k = 3; w, h = 520, 660
    im = Image.new("RGBA", (w*k, h*k), (0,0,0,0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w*k-1, h*k-1), 46*k, fill=(255,255,255,120), outline=(255,255,255,200), width=4*k)
    return im.resize((w, h), Image.LANCZOS)
PANEL = mk_panel()
def mk_frame10():
    k = 3; cell = 88; w, h = cell*5, cell*2
    im = Image.new("RGBA", (w*k+8*k, h*k+8*k), (0,0,0,0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, im.width-1, im.height-1), 26*k, fill=(255,255,255,215))
    for r in range(2):
        for c in range(5):
            d.rounded_rectangle((4*k+c*cell*k+5*k, 4*k+r*cell*k+5*k, 4*k+(c+1)*cell*k-5*k, 4*k+(r+1)*cell*k-5*k), 14*k, fill=(226,236,252,255))
    return im.resize((w+8, h+8), Image.LANCZOS)
FRAME10 = mk_frame10()
LOGO = text_sprite(''', 1)
a = s.index("def scene_count"); b = s.index("def scene_great")
new = '''def number_scene(im, t, f, i, grow, slide_start):
    tsw = max(0.0, t - slide_start)
    sc = out_back(tsw/0.55, 1.5)*(1 + (0.018*math.sin(t*14) if speaking(f) else 0))
    paste_c(im, NUMIMG[i], 362, 360 - 6*math.sin(t*2.6), sc, rot=1.2*math.sin(t*2.1))
    paste_c(im, PANEL, 995, 360)
    paste_c(im, WORDSPR[i-1], 995, 120, out_back((tsw-0.15)/0.45, 2.0)*1.35, rot=-1.5*math.sin(t*3))
    paste_c(im, FRAME10, 995, 330)
    obj = OBJ_FOR(i)
    for k in range(i):
        at = grow(k)
        if at < 0: continue
        r, c = divmod(k, 5)
        paste_c(im, obj, 995 + (c-2)*88, 330 + (r-0.5)*88, out_back(at/0.3, 2.6)*0.72)
    for k in range(10):
        lit = k < i
        sc2 = out_back(tsw/0.4, 3) if k == i-1 else 1.0
        paste_c(im, GOLD if lit else GREY, 995 + (k-4.5)*46, 610, sc2*0.8*(1+0.06*math.sin(t*5+k) if lit else 1), rot=t*25 if lit else 0)

def scene_count(im, t, f, i):
    t0 = TB + (i-1)*SLOT_B + 0.4
    number_scene(im, t, f, i, lambda k: (t - t0) - (0.9 + k*0.22), t0 - 0.05)
    praise_popup(im, t)

'''
s = s[:a] + new + s[b:]
a = s.index("def scene_repeat"); b = s.index("def scene_end")
rep = '''def scene_repeat(im, t, f, i):
    t0 = TC + (i-1)*SLOT_C
    number_scene(im, t, f, i, lambda k: (t - t0) - (0.1 + k*0.05), t0 - 0.05)
    if t - t0 > INFO[f"n{i}"] + 0.1:
        pulse = 1 + 0.06*math.sin(t*8)
        paste_c(im, SAY, 995, 505, out_back((t - t0 - INFO[f"n{i}"] - 0.1)/0.35, 2)*0.85*pulse, rot=-3)

'''
s = s[:a] + rep + s[b:]
s = s.replace("1085, 135 - 4*math.sin(t*6), out_back(tt/0.4, 2.6)*0.8*fade", "995, 515 - 4*math.sin(t*6), out_back(tt/0.4, 2.6)*0.9*fade")
s = s.replace("paste_c(im, STARS[(j*2) % 10], 1085 + 150*out_cubic(p)*math.cos(a), 135 + 90*out_cubic(p)*math.sin(a)", "paste_c(im, STARS[(j*2) % 10], 995 + 170*out_cubic(p)*math.cos(a), 515 + 60*out_cubic(p)*math.sin(a)")
s = s.replace("if t < TB - 0.2: scene_intro", "if t < TB + 0.35: scene_intro").replace("elif t < TC - 0.3: scene_great", "elif t < TC - 0.05: scene_great")
open("render4.py","w").write(s)
