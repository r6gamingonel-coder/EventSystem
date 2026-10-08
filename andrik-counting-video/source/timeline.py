import json
INFO = json.load(open("audio/info.json"))
FPS = 24
V = []
V.append((0.3, "hello", "Hello, boys and girls! My name is Endrick! I'm so happy to see you today!"))
V.append((5.4, "ready", "Are you ready to learn and have fun with me?"))
V.append((7.9, "today", "Today, we are going to learn how to count from ONE to TEN in English!"))
V.append((12.0, "come", "Come on, let's learn together!"))
TB = 14.5; SLOT_B = 3.3
PRAISE_B = {3: "p_good", 6: "p_great", 9: "p_super"}
for i in range(1, 11):
    V.append((TB + (i-1)*SLOT_B + 0.4, f"n{i}", ""))
    if i in PRAISE_B: V.append((TB + (i-1)*SLOT_B + 2.7, PRAISE_B[i], ""))
T_GREAT = 47.8
V.append((T_GREAT, "great", "Great job! Now let's count together!"))
TC = 50.8; SLOT_C = 2.3
for i in range(1, 11):
    V.append((TC + (i-1)*SLOT_C, f"n{i}", ""))
T_WOW = 74.3; T_BYE = 76.9
V.append((T_WOW, "wow", "Wow! You did it! You are amazing!"))
V.append((T_BYE, "bye", "See you next time, friends! Bye-bye!"))
DURATION = 80.5
PRAISE_TEXT = {"p_good": ("Good job!", (94,201,89)), "p_great": ("Great!", (255,112,176)), "p_super": ("Super!", (255,159,67))}
