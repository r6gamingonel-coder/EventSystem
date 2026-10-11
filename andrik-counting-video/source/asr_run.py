import sherpa_onnx, soundfile as sf, numpy as np, glob, subprocess, json, os
m = "asr/sherpa-onnx-whisper-small.en/small.en"
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=m+"-encoder.int8.onnx", decoder=m+"-decoder.int8.onnx", tokens=m+"-tokens.txt", language="en", task="transcribe", num_threads=4)
def tx(y, sr=16000):
    s = rec.create_stream(); s.accept_waveform(sr, y.astype(np.float32)); rec.decode_stream(s); return s.result.text.strip()
res = {}
for f in sorted(glob.glob("clips/IMG_*.mov")):
    n = os.path.basename(f)[4:8]
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",f,"-vn","-ac","1","-ar","16000",f"work/asr_{n}.wav"], check=True)
    y, sr = sf.read(f"work/asr_{n}.wav")
    full = tx(y)
    e = np.array([np.sqrt((y[i:i+800]**2).mean()) for i in range(0, len(y)-800, 800)])  # 50 ms hops
    thr = max(0.03, e.max()*0.2); on = e > thr
    segs = []; s0 = None
    for i, v in enumerate(on):
        if v and s0 is None: s0 = i
        if (not v) and s0 is not None:
            if i - s0 >= 3: segs.append([s0*0.05, i*0.05])
            s0 = None
    if s0 is not None: segs.append([s0*0.05, len(on)*0.05])
    merged = []
    for a, b in segs:
        if merged and a - merged[-1][1] < 0.25: merged[-1][1] = b
        else: merged.append([a, b])
    parts = []
    for a, b in merged:
        seg = y[max(0, int((a-0.15)*sr)): int((b+0.15)*sr)]
        parts.append({"t0": round(a, 2), "t1": round(b, 2), "text": tx(seg)})
    res[n] = {"full": full, "parts": parts}
    print(n, "|", full, "|", [(p["t0"], p["t1"], p["text"]) for p in parts], flush=True)
json.dump(res, open("work/asr.json", "w"), indent=1)
