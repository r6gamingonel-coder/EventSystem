import sherpa_onnx, soundfile as sf, numpy as np, json, itertools, re
m = "asr/sherpa-onnx-whisper-small.en/small.en"
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=m+"-encoder.int8.onnx", decoder=m+"-decoder.int8.onnx", tokens=m+"-tokens.txt", language="en", task="transcribe", num_threads=4)
def tx(y, sr=16000):
    s = rec.create_stream(); s.accept_waveform(sr, y.astype(np.float32)); rec.decode_stream(s); return s.result.text.strip().lower()
NUMW = {"0341":"one","0337":"two","0336":"three","0335":"four","0338":"five","0339":"six","0327":"seven","0324":"eight","0323":"nine","0320":"ten"}
ALT = {"two":["2","too","to"],"six":["sick","6","sex","sixth"],"eight":["8","ate","a"],"four":["4","for"],"one":["1","won"],"three":["3"],"five":["5"],"seven":["7"],"nine":["9"],"ten":["10"]}
def ok(text, w): 
    t = re.sub(r"[^a-z0-9 ]", "", text)
    return any(a in t.split() or a in t for a in [w]+ALT.get(w, []))
out = {}
for n, w in NUMW.items():
    y, sr = sf.read(f"work/asr_{n}.wav"); hop = 320  # 20 ms
    e = np.array([np.sqrt((y[i:i+hop*2]**2).mean()) for i in range(0, len(y)-hop*2, hop)])
    k = np.ones(5)/5; es = np.convolve(e, k, "same")
    mins = [i for i in range(3, len(es)-3) if es[i] == es[i-3:i+4].min()]
    mins = sorted(mins, key=lambda i: es[i])[:14]
    nwords = 4 if n == "0336" else 3
    best = None
    for combo in itertools.combinations(sorted(mins), nwords-1):
        ts = [c*0.02 for c in combo]
        if any(b-a < 0.5 for a, b in zip(ts, ts[1:])): continue
        if ts[0] < 0.6 or ts[-1] > 4.9: continue
        bounds = [0.0] + ts + [len(y)/sr]
        score = sum(es[c] for c in combo)
        if best is None or score < best[0]: best = (score, bounds)
    # verify top candidates by transcription
    cands = []
    for combo in itertools.combinations(sorted(mins), nwords-1):
        ts = [c*0.02 for c in combo]
        if any(b-a < 0.5 for a, b in zip(ts, ts[1:])): continue
        if ts[0] < 0.6 or ts[-1] > 4.9: continue
        cands.append((sum(es[c] for c in combo), [0.0]+ts+[len(y)/sr]))
    cands.sort(key=lambda c: c[0]); found = None
    for score, b in cands[:60]:
        parts = [tx(y[int(max(0, b[i]-0.05)*sr): int(min(len(y)/sr, b[i+1]+0.05)*sr)]) for i in range(len(b)-1)]
        good = all(ok(p, w) and "great" not in p and "job" not in p for p in parts[:nwords-1]) and ("job" in parts[-1] and "great" in parts[-1])
        if good: found = (b, parts); break
    out[n] = {"bounds": found[0] if found else None, "parts": found[1] if found else None}
    print(n, w, out[n], flush=True)
json.dump(out, open("work/bounds.json", "w"), indent=1)
