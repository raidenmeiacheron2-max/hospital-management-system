# -*- coding: utf-8 -*-
"""Image dimensions + dominant color palette analysis for the 9 reference screenshots."""
import os, json
from PIL import Image
from collections import Counter

src_dir = r"F:\Project-Astra"
out = r"F:\Project-Astra\tools\image_info.json"
info = {}
files = sorted(f for f in os.listdir(src_dir) if f.lower().endswith(".jpg"))
for f in files:
    p = os.path.join(src_dir, f)
    im = Image.open(p).convert("RGB")
    w, h = im.size
    # sample a grid to get common colors (avoid dither)
    small = im.resize((max(1, w // 8), max(1, h // 8)))
    cnt = Counter(small.getdata())
    top = cnt.most_common(12)
    info[f] = {
        "size": [w, h],
        "top_colors": [{"rgb": list(c), "count": n} for c, n in top],
    }
    print(f, w, "x", h, "top:", top[:6])

with open(out, "w", encoding="utf-8") as fh:
    json.dump(info, fh, ensure_ascii=False, indent=2)
print("written:", out)
