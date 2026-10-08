"""Transfer the motion of the reference clip (Endrick saying 'one') onto each number still via optical flow."""
import cv2, numpy as np, glob
from PIL import Image, ImageDraw
U = "/root/.claude/uploads/997aeacc-d5b9-59a5-9a59-9359735f4c5a/"
ORDER = ["fbdb32cd","8ce68b4c","1ca4cd31","87ad55bc","9e6a98ec","c8e7c528","f2e45995","c5658bdd","2ce4cd90","7500d0ef"]  # 10..1
PAL = [(255,92,92),(255,159,67),(255,206,43),(94,201,89),(52,190,224),(88,129,255),(165,104,240),(255,112,176),(38,198,168),(255,128,96)]
S, B, R = 676, 12, 1254
STILL = {10-k: cv2.imread(U+h+"-image.jpg") for k, h in enumerate(ORDER)}

files = sorted(glob.glob("ref/fr/*.png")); NF = len(files)
g0 = cv2.cvtColor(cv2.imread(files[0]), cv2.COLOR_BGR2GRAY)
dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
yy, xx = np.mgrid[0:576, 0:576].astype(np.float32)
edge = np.minimum(np.minimum(xx, 575-xx), np.minimum(yy, 575-yy))
ramp = np.clip(edge/26.0, 0, 1); ramp = ramp*ramp*(3-2*ramp)
FLOW = []
for f in files:
    gt = cv2.cvtColor(cv2.imread(f), cv2.COLOR_BGR2GRAY)
    fl = dis.calc(gt, g0, None)
    fl = cv2.GaussianBlur(fl, (0, 0), 2.5) * ramp[..., None]
    FLOW.append(fl.astype(np.float16))
# light temporal smoothing against flicker
FLOW = [((FLOW[max(0, i-1)].astype(np.float32) + 2*FLOW[i].astype(np.float32) + FLOW[min(NF-1, i+1)].astype(np.float32))/4).astype(np.float16) for i in range(NF)]
gy, gx = np.mgrid[0:R, 0:R].astype(np.float32)

# rounded frame templates
def _tmpl(n):
    k = 3; W2 = S + 2*B
    big = Image.new("L", (W2*k, W2*k), 0); ImageDraw.Draw(big).rounded_rectangle((0, 0, W2*k-1, W2*k-1), 50*k, fill=255)
    out = Image.new("RGBA", (W2, W2), (0,0,0,0)); out.paste(Image.new("RGBA", (W2, W2), PAL[n-1]+(255,)), (0,0), big.resize((W2, W2), Image.LANCZOS))
    m2 = Image.new("L", (S*k, S*k), 0); ImageDraw.Draw(m2).rounded_rectangle((0, 0, S*k-1, S*k-1), 40*k, fill=255)
    return out, m2.resize((S, S), Image.LANCZOS)
TMPL = {n: _tmpl(n) for n in range(1, 11)}

def clip_index(start, t_rel):
    """ping-pong playback through the reference clip at 30 fps"""
    k = int(max(0, t_rel)*30) + start
    p = 2*(NF-1); k %= p
    return k if k <= NF-1 else p-k

import os
MASK = {n: np.load(f'work/mask_{n}.npy').astype(np.float32) for n in range(1, 11)} if os.path.exists('work/mask_1.npy') else {}
AMP = 0.9

def sprite(n, idx):
    fl = cv2.resize(FLOW[idx].astype(np.float32), (R, R), interpolation=cv2.INTER_LINEAR) * (R/576.0) * AMP
    if n in MASK: fl = fl * MASK[n][..., None]
    out = cv2.remap(STILL[n], gx + fl[..., 0], gy + fl[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    out = cv2.resize(out, (S, S), interpolation=cv2.INTER_AREA)
    img = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
    frame, mask = TMPL[n]; fr = frame.copy(); fr.paste(img, (B, B), mask); return fr
