#!/usr/bin/env python3
"""Génère les bruitages 8-bit (onde carrée) — mêmes notes que audio.cpp du firmware."""
import math, os, struct, wave

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx')
SFX = {
    'tap':    [(880, 35)],
    'eat':    [(660, 45), (0, 12), (660, 45)],
    'play':   [(784, 45), (988, 60)],
    'heart':  [(1047, 55), (1319, 90)],
    'hatch':  [(523, 80), (659, 80), (784, 110), (1047, 170)],
    'evolve': [(523, 80), (659, 80), (784, 80), (1047, 90), (1319, 230)],
    'medal':  [(784, 70), (0, 25), (784, 70), (0, 25), (1047, 200)],
    'deny':   [(300, 110), (200, 170)],
    'bye':    [(784, 150), (659, 150), (523, 280)],
    'level':  [(784, 70), (1047, 130)],
}

os.makedirs(OUT, exist_ok=True)
for name, notes in SFX.items():
    frames = bytearray()
    for freq, ms in notes:
        n = int(RATE * ms / 1000)
        for i in range(n):
            if freq == 0:
                v = 0.0
            else:
                env = min(1.0, i / 60) * min(1.0, (n - i) / 200)  # anti-clic
                v = (1 if math.sin(2 * math.pi * freq * i / RATE) >= 0 else -1) * 0.28 * env
            frames += struct.pack('<h', int(v * 32767))
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE); w.writeframes(bytes(frames))
print('sfx ok')
