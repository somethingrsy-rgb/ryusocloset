"""흰 배경 JPG 로 받은 신발(양말 포함, 한 쌍)을 투명 PNG 로 오려서 assets-src/clothes/<id>.png 로 놓는다.

  python tools-py/cutout_shoes.py <원본.jpg> <id>

1) 가장자리에서 이어진 거의 흰색(배경)을 투명하게 만든다 (양말의 흰 부분은 살색 다리·윤곽선에 막혀 있어서 지워지지 않는다).
2) 위쪽 가장자리에 걸린 맨다리(살색)는 지운다 — 아바타의 다리 위에 겹쳐 보이는 이음선을 없애려고.
3) 두 짝을 아바타 발에 맞춘다 (tools-py/add_clothes.py shoes 와 같은 값).
의존성: pip install numpy scipy pillow
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, oid = sys.argv[1:3]
W, H = 1024, 1536
im = Image.open(src).convert('RGB')
a = np.array(im).astype(int)
h, w, _ = a.shape

# 1) 배경: 가장자리에서 이어진 거의 흰색
white = (a.min(axis=2) >= 244)
lab, n = ndi.label(white)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
alpha = np.where(bg, 0, 255).astype(np.uint8)

# 2) 위쪽 가장자리에 닿은 살색(다리) 지우기
r, g, b = a[..., 0], a[..., 1], a[..., 2]
skin = (r > 215) & (g > 150) & (g < 225) & (b > 120) & (b < 215) & (r - b > 18)
lab2, _ = ndi.label(skin & ~bg)
top = set(np.unique(lab2[:3])) - {0}
leg = np.isin(lab2, list(top))
leg = ndi.binary_dilation(leg, iterations=2)
alpha[leg & ~bg] = 0

# 가장자리 한 겹을 부드럽게
solid = alpha > 0
edge_px = solid & ~ndi.binary_erosion(solid)
alpha[edge_px] = 170
rgba = np.dstack([a.astype(np.uint8), alpha])
rgba[alpha == 0] = 0
piece = Image.fromarray(rgba, 'RGBA')

# 3) 짝마다 따로, 아바타의 각 발(가운데 423.3 / 598.1, 폭 110, 발끝 y 1509)에 맞춘다.
#    두 짝 사이 간격이 발 간격과 달라도 신발이 발 위에 정확히 오도록 한 짝씩 놓는다. 크기는 신발 몸통(아래 30%)의 폭으로 정한다.
lab3, n3 = ndi.label(alpha > 128)
parts = []
for i in range(1, n3 + 1):
    ys, xs = np.where(lab3 == i)
    if len(xs) > 1500:
        parts.append((xs.min(), xs.max(), ys.max()))
assert len(parts) == 2, f'신발 두 짝이 따로 보여야 해요: {parts}'
parts.sort()
split = (parts[0][1] + parts[1][0]) // 2


def sole(mask):
    ys, xs = np.where(mask)
    low = ys > ys.min() + 0.7 * (ys.max() - ys.min())
    return xs[low].min(), xs[low].max(), ys.max()


halves = [(alpha > 128) & (np.arange(w)[None, :] < split), (alpha > 128) & (np.arange(w)[None, :] >= split)]
infos = [sole(m) for m in halves]
s = 110 / np.mean([x1 - x0 + 1 for x0, x1, _ in infos])
out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for k, (m, (x0, x1, yb), cx) in enumerate(zip(halves, infos, (423.3, 598.1))):
    side = rgba.copy()
    cols = np.arange(w)[None, :]
    side[~((cols < split) if k == 0 else (cols >= split)).repeat(h, axis=0)] = 0   # 이 짝만
    piece = Image.fromarray(side, 'RGBA').resize((round(w * s), round(h * s)), Image.LANCZOS)
    out.alpha_composite(piece, (int(round(cx - 0.5 * (x0 + x1) * s)), int(round(1509 - yb * s))))
out.save(f'assets-src/clothes/{oid}.png')
print(oid, 'scale=%.3f' % s, out.getchannel('A').getbbox())
