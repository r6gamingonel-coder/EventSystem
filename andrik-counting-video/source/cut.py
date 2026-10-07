from PIL import Image
from rembg import remove, new_session
im = Image.open("ref.jpg").convert("RGB")
boxes = {"main":(0,0,622,1295),"talk":(627,0,917,400),"cheeks":(925,0,1210,400),"thumb":(627,405,908,852),"blocks":(915,405,1210,852)}
s = new_session("u2net")
for n,b in boxes.items():
    out = remove(im.crop(b), session=s)
    bb = out.getbbox(); out = out.crop(bb); out.save(f"work/{n}.png"); print(n,out.size)
