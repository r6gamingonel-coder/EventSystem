import cv2, numpy as np, glob, subprocess
stack = []
for f in sorted(glob.glob("clips/IMG_*.mov")):
    for t in [0.2, 0.8, 1.4, 2.0, 2.6, 3.2, 3.8, 4.4]:
        p = subprocess.run(["ffmpeg","-loglevel","error","-ss",str(t),"-i",f,"-frames:v","1","-vf","scale=1280:-2,crop=1280:720","-f","rawvideo","-pix_fmt","bgr24","-"], capture_output=True)
        if len(p.stdout) != 1280*720*3: continue
        im = np.frombuffer(p.stdout, np.uint8).reshape(720, 1280, 3)
        crop = im[0:120, 0:340].astype(np.float32)
        g = crop.mean(axis=2); sharp = g - cv2.GaussianBlur(g, (0, 0), 5)
        stack.append(sharp)
S = np.median(np.stack(stack), axis=0); print(len(stack), S.min(), S.max())
np.save("work/wm_sharp.npy", S)
vis = np.clip((S + 2)/12*255, 0, 255).astype(np.uint8)
cv2.imwrite("work/wm_sharp.png", cv2.resize(vis, None, fx=3, fy=3, interpolation=cv2.INTER_NEAREST))
