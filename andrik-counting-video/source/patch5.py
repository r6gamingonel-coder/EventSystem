s = open("render4.py").read()
s = s.replace("LOGO = text_sprite(", "import motion\nLOGO = text_sprite(", 1)
s = s.replace("def number_scene(im, t, f, i, grow, slide_start):\n    tsw = max(0.0, t - slide_start)\n    sc = out_back(tsw/0.55, 1.5)*(1 + (0.018*math.sin(t*14) if speaking(f) else 0))\n    paste_c(im, NUMIMG[i], 362, 360 - 6*math.sin(t*2.6), sc, rot=1.2*math.sin(t*2.1))",
"def number_scene(im, t, f, i, grow, slide_start):\n    tsw = max(0.0, t - slide_start)\n    sc = out_back(tsw/0.55, 1.5)\n    spr = motion.sprite(i, motion.clip_index((i*23) % 70, tsw))\n    paste_c(im, spr, 362, 360, sc)")
open("render5.py", "w").write(s)
