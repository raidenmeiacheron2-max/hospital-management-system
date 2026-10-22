# -*- coding: utf-8 -*-
"""Verify rendered E2E screenshots against design tokens: sidebar dark, primary blue, light header."""
import os
from PIL import Image
from collections import Counter

shots = r"F:\Project-Astra\tests\e2e\shots"

def analyze(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    side = im.crop((0, 0, min(220, w), h)).resize((55, h // 4))
    side_cnt = Counter(side.getdata())
    blues = Counter()
    small = im.resize((w // 6, h // 6))
    for (r, g, b) in small.getdata():
        if 60 < b < 250 and 40 < r < 240 and b > r + 25 and b > g + 15:
            blues[(r, g, b)] += 1
    return {
        "size": [w, h],
        "sidebar_top": [list(c) for c, _ in side_cnt.most_common(4)],
        "blues_top": [list(c) + [n] for c, n in blues.most_common(5)]
    }

for f in sorted(os.listdir(shots)):
    if not f.endswith(".png") or f.startswith("fail"):
        continue
    info = analyze(os.path.join(shots, f))
    print(f, info)
