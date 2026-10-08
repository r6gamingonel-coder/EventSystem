import numpy as np, soundfile as sf
from timeline import *
SR = 24000
N = int(DURATION*SR)
voice = np.zeros(N); sfx = np.zeros(N); music = np.zeros(N)
def put(buf, t, s, g=1.0):
    i = int(t*SR); e = min(N, i+len(s)); buf[i:e] += s[:e-i]*g
for t, name, _ in V:
    s, sr = sf.read(f"audio/{name}.wav"); assert sr == SR
    put(voice, t, s)
voice /= np.abs(voice).max()/0.9
np.save("work/voice_env_src.npy", voice)
def tone(f, d, decay=6, harm=(1,), amp=1.0):
    t = np.arange(int(d*SR))/SR
    s = sum(np.sin(2*np.pi*f*h*t)/h for h in harm)
    return s*np.exp(-decay*t)*amp*np.minimum(1, t/0.004)
def pop(): 
    t = np.arange(int(0.12*SR))/SR
    f = 380 + 900*t/0.12
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*30)
def bell(f=880): return tone(f, 0.9, 5, (1, 2.01, 3.5), 0.5)
# sfx: bell on number voice start, pops for objects in scene B
for i in range(1, 11):
    tb = TB + (i-1)*SLOT_B + 0.4
    put(sfx, tb-0.02, bell(660 + 40*i), 0.35)
    for k in range(i):
        put(sfx, tb + 0.9 + k*0.22, pop()*(0.8 + 0.03*k), 0.4)
    tc = TC + (i-1)*SLOT_C
    put(sfx, tc-0.02, bell(660 + 40*i), 0.25)
for tt, nm, _ in V:
    if nm.startswith("p_"):
        for j, f in enumerate([880, 1175, 1568]): put(sfx, tt + j*0.07, tone(f, 0.4, 7, (1, 2), 0.5), 0.2)
# tada at wow + at start
for j, f in enumerate([523, 659, 784, 1047]):
    put(sfx, T_WOW-0.05 + j*0.09, tone(f, 0.8, 4, (1, 2), 0.6), 0.35)
for j, f in enumerate([784, 988, 1175]):
    put(sfx, 0.05 + j*0.07, tone(f, 0.5, 6, (1, 2), 0.6), 0.2)
# music-box background: pentatonic loop
rng = np.random.RandomState(7)
pent = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]
pattern = [0,2,4,2, 3,4,5,4, 2,3,4,2, 1,2,0,2]
beat = 0.5
bar = 0
t = 0.0; idx = 0
while t < DURATION - 0.5:
    n = pattern[idx % len(pattern)]
    put(music, t, tone(pent[n], 1.2, 3.5, (1, 2, 3), 0.5), 0.9)
    if idx % 4 == 0:
        base = [130.8, 130.8, 174.6, 196.0][(idx//4) % 4]
        put(music, t, tone(base, 1.9, 1.6, (1, 2), 0.5), 0.8)
    idx += 1; t += beat
fade = np.minimum(1, np.minimum(np.arange(N)/(SR*1.5), (N-np.arange(N))/(SR*2.0)))
mix = voice*1.0 + sfx*0.9 + music*0.10*fade
mix = mix/np.abs(mix).max()*0.92
sf.write("work/mix.wav", mix, SR)
print("ok", DURATION)
