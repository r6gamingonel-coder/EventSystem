import cv2, numpy as np
from PIL import Image
from rembg import remove, new_session
import motion
s = new_session("u2net"); R = motion.R
yy, xx = np.mgrid[0:R, 0:R].astype(np.float32)
for n, bgr in motion.STILL.items():
    a = np.array(remove(Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)), session=s))[..., 3].astype(np.float32)/255
    a = cv2.dilate(a, np.ones((3,3), np.uint8), iterations=1)
    a = cv2.dilate(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (101,101)))
    a = cv2.GaussianBlur(a, (0,0), 28)
    # number object sits lower-right: keep it still
    lr = np.clip((xx/R-0.56)/0.08, 0, 1) * np.clip((yy/R-0.50)/0.08, 0, 1)
    w = a * (1 - lr)
    np.save(f"work/mask_{n}.npy", w.astype(np.float16))
    cv2.imwrite(f"work/mask_{n}.png", (w*255).astype(np.uint8))
print("masks ok")
