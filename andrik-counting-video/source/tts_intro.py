import soundfile as sf, numpy as np, json
from kokoro_onnx import Kokoro
k = Kokoro("models/kokoro-v1.0.onnx", "models/voices-v1.0.bin")
LINES = ["Hello! I'm Endrick!", "Today, I will show you", "how to say the numbers", "from one to ten in English!"]
info = []
for i, t in enumerate(LINES):
    s, sr = k.create(t, voice="af_heart", speed=0.97, lang="en-us")
    # trim leading/trailing silence
    idx = np.where(np.abs(s) > 0.01)[0]; s = s[idx[0]:idx[-1] + 1]
    sf.write(f"audio/intro_{i}.wav", s, sr); info.append({"text": t, "dur": len(s)/sr}); print(i, t, round(len(s)/sr, 2))
json.dump(info, open("audio/intro_info.json", "w"))
