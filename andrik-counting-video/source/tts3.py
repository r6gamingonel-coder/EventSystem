import soundfile as sf, numpy as np, json
from kokoro_onnx import Kokoro
k = Kokoro("models/kokoro-v1.0.onnx","models/voices-v1.0.bin")
lines = {
 "hello":"Hello, boys and girls! My name is Endrick! I'm so happy to see you today!",
 "ready":"Are you ready to learn and have fun with me?",
 "today":"Today, we are going to learn how to count from ONE to TEN in English!",
 "come":"Come on, let's learn together!",
 "n1":"One!","n2":"Two!","n3":"Three!","n4":"Four!","n5":"Five!","n6":"Six!","n7":"Seven!","n8":"Eight!","n9":"Nine!","n10":"Ten!",
 "p_good":"Good job!","p_great":"Great!","p_super":"Super!",
 "great":"Great job! Now let's count together!",
 "wow":"Wow! You did it! You are amazing!",
 "bye":"See you next time, friends! Bye-bye!",
}
info={}
for name,t in lines.items():
    s,sr = k.create(t, voice="af_heart", speed=0.88 if name.startswith("n") else 0.92, lang="en-us")
    sf.write(f"audio/{name}.wav", s, sr); info[name]=len(s)/sr
print(sr, json.dumps(info,indent=0))
json.dump(info,open("audio/info.json","w"))
