import json
INFO = json.load(open("audio/info.json"))
FPS = 24
# (start_time, clip_name, subtitle)
V = []
V.append((0.3, "hello", "Hello, boys and girls! My name is Andrik! I'm so happy to see you today!"))
V.append((5.4, "ready", "Are you ready to learn and have fun with me?"))
V.append((7.9, "today", "Today, we are going to learn how to count from ONE to TEN in English!"))
V.append((12.0, "come", "Come on, let's learn together!"))
TB = 14.5; SLOT_B = 3.0
for i in range(1, 11):
    V.append((TB + (i-1)*SLOT_B + 0.4, f"n{i}", ""))
T_GREAT = 45.0
V.append((T_GREAT, "great", "Great job! Now let's count together!"))
TC = 48.2; SLOT_C = 2.3
for i in range(1, 11):
    V.append((TC + (i-1)*SLOT_C, f"n{i}", ""))
T_WOW = 70.2; T_BYE = 72.8
V.append((T_WOW, "wow", "Wow! You did it! You are amazing!"))
V.append((T_BYE, "bye", "See you next time, friends! Bye-bye!"))
DURATION = 76.5
