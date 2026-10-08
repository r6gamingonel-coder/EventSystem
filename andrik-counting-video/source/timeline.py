import json
INFO = json.load(open("audio/info.json"))
FPS = 24
V = []  # (start_time, clip_name, subtitle)
V.append((0.3, "hello", "Hello, boys and girls! My name is Andrik! I'm so happy to see you today!"))
V.append((5.0, "ready", "Are you ready to learn and have fun with me?"))
V.append((7.4, "today", "Today, we are going to learn how to count from ONE to TEN in English!"))
V.append((11.3, "come", "Come on, let's learn together!"))
TB = 13.8; SLOT_B = 3.3
PRAISE_B = {2: "p_good", 4: "p_super", 6: "p_great", 8: "p_almost", 10: "p_hooray"}
for i in range(1, 11):
    V.append((TB + (i-1)*SLOT_B + 0.4, f"n{i}", ""))
    if i in PRAISE_B: V.append((TB + (i-1)*SLOT_B + 2.5, PRAISE_B[i], ""))
T_GREAT = 47.0
V.append((T_GREAT, "great", "Great job! Now let's count together!"))
TC = 49.8; SLOT_C = 2.6
PRAISE_C = {3: "r_right", 5: "r_loud", 7: "r_keep", 9: "r_one"}
for i in range(1, 11):
    V.append((TC + (i-1)*SLOT_C, f"n{i}", ""))
    if i in PRAISE_C: V.append((TC + (i-1)*SLOT_C + 1.45, PRAISE_C[i], ""))
T_WOW = 76.2; T_BYE = 79.8
V.append((T_WOW, "wow", "Wow! You did it! You are amazing! I'm so proud of you!"))
V.append((T_BYE, "bye", "See you next time, friends! Bye-bye!"))
DURATION = 83.5
PRAISE_TEXT = {"p_good": ("Good job!", (94,201,89)), "p_super": ("Super!", (255,159,67)), "p_great": ("You're doing great!", (255,112,176)),
               "p_almost": ("Almost there!", (52,190,224)), "p_hooray": ("Hooray!", (165,104,240)),
               "r_right": ("That's right!", (94,201,89)), "r_loud": ("Louder!", (255,92,92)), "r_keep": ("Keep going!", (255,159,67)), "r_one": ("One more!", (88,129,255))}
