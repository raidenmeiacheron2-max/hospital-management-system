# -*- coding: utf-8 -*-
"""Deep color analysis: sidebar region palette + saturated blues + row/card backgrounds."""
import os, json
from PIL import Image
from collections import Counter

src_dir = r"F:\Project-Astra"
out = r"F:\Project-Astra\tools\color_report.json"
report = {}

def analyze(path, tag):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    d = {"size": [w, h]}

    # sidebar region: x in [0, min(260, w*0.14)], skip text-light pixels
    side = im.crop((0, 0, min(260, w), h)).resize((min(260, w) // 4, h // 4))
    side_cnt = Counter(side.getdata())
    d["sidebar_top"] = [list(c) for c, _ in side_cnt.most_common(10)]

    # saturated blues: b > r + 25 and b > g + 15, mid brightness
    small = im.resize((w // 6, h // 6))
    blues = Counter()
    greens = Counter()
    oranges = Counter()
    for (r, g, b) in small.getdata():
        if 60 < b < 250 and 40 < r < 240:
            if b > r + 25 and b > g + 15:
                blues[(r, g, b)] += 1
            elif g > r + 25 and g > b + 15:
                greens[(r, g, b)] += 1
            elif r > g + 40 and r > b + 40:
                oranges[(r, g, b)] += 1
    d["blues"] = [list(c) + [n] for c, n in blues.most_common(14)]
    d["greens"] = [list(c) + [n] for c, n in greens.most_common(8)]
    d["oranges"] = [list(c) + [n] for c, n in oranges.most_common(8)]
    report[tag] = d
    print(tag, w, h, "blues:", d["blues"][:6])

files = sorted(f for f in os.listdir(src_dir) if f.lower().endswith(".jpg"))
for f in files:
    idx = f[f.index('_') + 1:f.index('_') + 2]
    analyze(os.path.join(src_dir, f), "img" + idx)

with open(out, "w", encoding="utf-8") as fh:
    json.dump(report, fh, ensure_ascii=False, indent=2)
print("written:", out)
