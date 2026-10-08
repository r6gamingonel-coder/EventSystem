import soundfile as sf, numpy as np, json, subprocess
from kokoro_onnx import Kokoro
k = Kokoro("models/kokoro-v1.0.onnx","models/voices-v1.0.bin")
PITCH = 1.32
lines = {
 "hello":"Hello, boys and girls! My name is Andrik! I'm so happy to see you today!",
 "ready":"Are you ready to learn and have fun with me?",
 "today":"Today, we are going to learn how to count from ONE to TEN in English!",
 "come":"Come on, let's learn together!",
 "n1":"One!","n2":"Two!","n3":"Three!","n4":"Four!","n5":"Five!","n6":"Six!","n7":"Seven!","n8":"Eight!","n9":"Nine!","n10":"Ten!",
 "p_good":"Good job!","p_super":"Super!","p_great":"You're doing great!","p_almost":"Almost there!","p_hooray":"Hooray! Ten!",
 "r_right":"That's right!","r_loud":"Louder!","r_keep":"Yes! Keep going!","r_one":"One more!",
 "great":"Great job! Now let's count together!",
 "wow":"Wow! You did it! You are amazing! I'm so proud of you!",
 "bye":"See you next time, friends! Bye-bye!",
}
info = {}
for name, t in lines.items():
    sp = 0.95 if name.startswith("n") else 1.02
    s, sr = k.create(t, voice="af_heart", speed=sp, lang="en-us")
    sf.write(f"audio_raw/{name}.wav", s, sr)
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",f"audio_raw/{name}.wav","-af",f"rubberband=pitch={PITCH}:formant=shifted:transients=smooth","-ar","24000",f"audio/{name}.wav"],check=True)
    y, sr2 = sf.read(f"audio/{name}.wav"); info[name] = len(y)/sr2
json.dump(info, open("audio/info.json","w"))
def f0(path):
    y, sr = sf.read(path); y = y[:int(sr*0.6)] if len(y) > sr else y
    seg = y[int(len(y)*0.2):int(len(y)*0.2)+2048]; seg = seg - seg.mean()
    ac = np.correlate(seg, seg, "full")[len(seg)-1:]
    lo, hi = int(sr/500), int(sr/100); p = lo + np.argmax(ac[lo:hi]); return sr/p
print("f0 before/after:", round(f0("audio_raw/hello.wav")), round(f0("audio/hello.wav")))
print({n: round(v,2) for n, v in info.items()})
