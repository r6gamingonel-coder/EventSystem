import numpy as np, soundfile as sf, subprocess
from timeline7 import *
SR = 24000; N = int(DURATION*SR)
out = np.zeros(N); music = np.zeros(N); sfx = np.zeros(N)
def put(buf, t, s, g=1.0):
    i = int(t*SR); e = min(N, i+len(s))
    if i < N: buf[i:e] += s[:e-i]*g
def tone(f, d, decay=6, harm=(1,), amp=1.0):
    t = np.arange(int(d*SR))/SR
    return sum(np.sin(2*np.pi*f*h*t)/h for h in harm)*np.exp(-decay*t)*amp*np.minimum(1, t/0.004)
gains = {}
for (kind, name, dur, n), st in zip(SEG, START):
    if kind == "clip":
        subprocess.run(["ffmpeg","-y","-loglevel","error","-i",f"clips/IMG_{name}.mov","-vn","-ac","1","-ar",str(SR),f"work/ca_{name}.wav"], check=True)
        y, _ = sf.read(f"work/ca_{name}.wav")
        rms = np.sqrt((y**2).mean()); g = min(0.27/rms, 0.95/np.abs(y).max()); gains[name] = round(float(g), 2)
        y = y*g; f = int(0.02*SR); y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
        put(out, st, y)
    elif kind == "six":
        y, _ = sf.read("audio/n6.wav"); put(out, st + 0.4, y/np.abs(y).max()*0.9)
        for k in range(6):
            t = np.arange(int(0.12*SR))/SR; p = np.sin(2*np.pi*np.cumsum(380+900*t/0.12)/SR)*np.exp(-t*30)
            put(sfx, st + 1.3 + k*0.22, p, 0.35)
        put(sfx, st + 0.38, tone(1000, 0.9, 5, (1, 2.01, 3.5), 0.5), 0.3)
    elif kind == "title":
        for j, f in enumerate([784, 988, 1175, 1568]): put(sfx, st + 0.15 + j*0.09, tone(f, 0.8, 4, (1, 2), 0.6), 0.3)
    elif kind == "end":
        for j, f in enumerate([523, 659, 784, 1047]): put(sfx, st + 0.1 + j*0.1, tone(f, 0.9, 3.5, (1, 2), 0.6), 0.3)
# gentle music box only where there is no clip audio
pent = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]; pattern = [0,2,4,2,3,4,5,4]
for (kind, name, dur, n), st in zip(SEG, START):
    if kind in ("title", "six", "end"):
        t = st; k = 0
        while t < st + dur - 0.2:
            put(music, t, tone(pent[pattern[k % 8]], 1.0, 3.5, (1, 2, 3), 0.5), 0.5); t += 0.5; k += 1
mix = out + sfx*0.9 + music*0.12
mix = mix/np.abs(mix).max()*0.92
sf.write("work/mix7.wav", mix, SR); print("audio ok", round(DURATION, 1), gains)
