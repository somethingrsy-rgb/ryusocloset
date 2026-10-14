"""흰 배경 아바타 한 장을 아바타 캔버스(1024×1536)에 맞춰 assets-src/base/<id>/ 에 놓고 레이어를 만든다.

  python tools-py/import_avatar.py <원본.png> <assets-src/base/아이디> [--no-hair-front]

1) 가장자리에서 이어진 거의 흰색을 투명하게 만든다 (눈 하이라이트·치아처럼 윤곽선 안쪽의 흰색은 남는다)
2) 두 발의 폭이 78, 가운데가 450/573 이 되도록(= 기존 아바타와 같은 발 위치) 같은 비율로 키워서 1024×1536 에 놓는다
   → 기존 신발·옷이 그대로 맞는다
3) source/ 에 원본·투명본을 저장하고 tools-py/make_bodysuit_layers.py 로 body / body_barefoot / hair_front 를 만든다
   (--no-hair-front: 묶음 머리처럼 어깨 아래로 내려오는 머리가 없으면 앞머리 레이어를 빈 이미지로 둔다)
의존성: pip install numpy scipy pillow opencv-python-headless
"""
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1:3]
W, H = 1024, 1536
raw = Image.open(src).convert('RGB')
a = np.array(raw).astype(int)
white = a.min(axis=2) >= 240
lab, n = ndi.label(white)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
alpha = np.where(bg, 0, 255).astype(np.uint8)
lab2, m = ndi.label(alpha > 0)
sizes = ndi.sum(alpha > 0, lab2, range(1, m + 1))
alpha[lab2 != 1 + int(np.argmax(sizes))] = 0
solid = alpha > 0
alpha[solid & ~ndi.binary_erosion(solid)] = 170
rgba = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')

# 두 발(맨 아래 쪽)의 가운데·폭으로 크기와 위치를 정한다
ys, xs = np.where(alpha > 128)
bottom = ys.max()
row = np.where(alpha[bottom - 30] > 128)[0]
runs = np.split(row, np.where(np.diff(row) > 5)[0] + 1)
runs = [r for r in runs if len(r) > 20]
assert len(runs) == 2, f'두 발이 따로 보여야 해요: {[(r[0], r[-1]) for r in runs]}'
(l1, r1), (l2, r2) = [(r[0], r[-1]) for r in runs]
c1, c2 = (l1 + r1) / 2, (l2 + r2) / 2
s = 0.5 * ((573 - 450) / (c2 - c1) + 78 / (((r1 - l1) + (r2 - l2)) / 2))
big = rgba.resize((round(rgba.width * s), round(rgba.height * s)), Image.LANCZOS)
dx = round(0.5 * (450 + 573) - 0.5 * (c1 + c2) * s)
dy = round(1503 - bottom * s)
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
canvas.alpha_composite(big, (dx, dy)) if dx >= 0 and dy >= 0 else canvas.paste(big, (dx, dy))
print(f'scale={s:.3f} offset=({dx},{dy})')
import os
os.makedirs(f'{out}/source', exist_ok=True)
canvas.save(f'{out}/source/standing_avatar_transparent.png')
white_bg = Image.new('RGBA', (W, H), (255, 255, 255, 255))
white_bg.alpha_composite(canvas)
white_bg.convert('RGB').save(f'{out}/source/standing_avatar_original.png')
subprocess.run([sys.executable, '-I', 'tools-py/make_bodysuit_layers.py', f'{out}/source/standing_avatar_transparent.png', out], check=True)
if '--no-hair-front' in sys.argv:
    Image.new('RGBA', (W, H), (0, 0, 0, 0)).save(f'{out}/hair_front.png')
