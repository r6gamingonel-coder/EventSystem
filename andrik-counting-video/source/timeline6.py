import json
INFO = json.load(open("audio/info.json"))
FPS = 24
CLIP_DUR = 5.23
V = []
V.append((0.3, "hello", "Hello, boys and girls! My name is Endrick! I'm so happy to see you today!"))
V.append((5.4, "ready", "Are you ready to learn and have fun with me?"))
V.append((7.9, "today", "Today, we are going to learn how to count from ONE to TEN in English!"))
V.append((12.0, "come", "Come on, let's learn together!"))
TB = 14.5; SLOT_B = 3.3; SLOT1 = 5.6
B_START = [TB + 0.4]
for k in range(1, 10): B_START.append(B_START[-1] + (SLOT1 if k == 1 else SLOT_B))
PRAISE_B = {3: "p_good", 6: "p_great", 9: "p_super"}
for i in range(1, 11):
    if i > 1: V.append((B_START[i-1], f"n{i}", ""))      # slide 1 uses the real clip audio
    if i in PRAISE_B: V.append((B_START[i-1] + 2.3, PRAISE_B[i], ""))
T_GREAT = B_START[9] + 3.2
V.append((T_GREAT, "great", "Great job! Now let's count together!"))
TC = T_GREAT + 3.0; SLOT_C = 2.3
C_START = [TC + k*SLOT_C for k in range(10)]
for i in range(1, 11): V.append((C_START[i-1], f"n{i}", ""))
T_WOW = C_START[9] + 3.0; T_BYE = T_WOW + 2.6
V.append((T_WOW, "wow", "Wow! You did it! You are amazing!"))
V.append((T_BYE, "bye", "See you next time, friends! Bye-bye!"))
DURATION = T_BYE + 2.28 + 1.4
PRAISE_TEXT = {"p_good": ("Good job!", (94,201,89)), "p_great": ("Great!", (255,112,176)), "p_super": ("Super!", (255,159,67))}
