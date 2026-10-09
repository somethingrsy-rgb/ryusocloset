"""이미 코디 캔버스(1024×1536)에 놓여 있는 신발(assets-src/clothes/shoes_*.png)을 새 아바타의 발에 다시 맞춘다.

두 짝을 반으로 갈라 짝마다 새 발 가운데·폭·발끝으로 옮긴다 (아바타를 바꿨을 때 한 번).
  python tools-py/refit_shoes.py OLD_CX1 OLD_CX2 OLD_W   예: python tools-py/refit_shoes.py 423.3 598.1 110
새 값은 아래 NEW_* (tools-py/cutout_shoes.py 와 같은 값).
"""
import glob
import sys

import numpy as np
from PIL import Image

NEW_CX, NEW_W, NEW_Y = (423.3, 598.1), 110, 1510
W, H = 1024, 1536
old_cx, old_w = (float(sys.argv[1]), float(sys.argv[2])), float(sys.argv[3])
k = NEW_W / old_w
for f in sorted(glob.glob('assets-src/clothes/shoes_*.png')):
    im = Image.open(f).convert('RGBA')
    a = np.array(im.getchannel('A')) > 8
    ys, _ = np.where(a)
    bottom = ys.max()
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for i, (lo, hi) in enumerate(((0, W // 2), (W // 2, W))):
        half = im.crop((lo, 0, hi, H))
        box = half.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        if not box:
            continue
        half = half.resize((round((hi - lo) * k), round(H * k)), Image.LANCZOS)
        # 옛 발 가운데(old_cx[i]) 가 새 발 가운데로, 옛 발끝이 새 발끝으로 오도록
        x = NEW_CX[i] - (old_cx[i] - lo) * k
        y = NEW_Y - bottom * k
        out.alpha_composite(half, (int(round(x)), int(round(y))))
    out.save(f)
    print(f.split('/')[-1], out.getchannel('A').getbbox())
