"""머리만 그려진 투명 PNG(1024×1536)를 머리 없는 류소(assets-src/base/body_bald.png)의 턱 선에 맞춰 hair_<이름>.png 로 저장한다.

  python tools-py/fit_ryuso_hair.py <이름> <머리.png>

1) 떨어진 작은 조각을 지운다
2) 머리 그림의 얼굴 구멍이 턱 쪽에서 얼굴보다 넓으면, 그 줄(가로 한 줄)의 머리를 가운데로 밀어서 구멍 가장자리가 턱 선에 닿게 한다 (500~590 줄 턱 선까지 맞추고, 640~900 줄에서 서서히 줄어 0)
3) 목·턱 옆 빈틈은 뒷머리 색으로 채운다 (머리 바깥 선 안쪽, 얼굴·목 둘레만, 660~720 줄에서 서서히 사라짐)
4) 머리는 몸 뒤에 그려지므로, 몸(머리 쪽)에서 머리카락이 덮던 부분을 지운 body_<이름>.png 도 같이 만든다
의존성: pip install numpy scipy opencv-python-headless pillow
"""
import sys

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

name, src = sys.argv[1:3]
H, W = 1536, 1024
body = np.array(Image.open('assets-src/base/body_bald.png').convert('RGBA'))
face = body[..., 3] > 8
bm = ndi.binary_dilation(face, iterations=3)
yy = np.arange(H)[:, None] * np.ones((1, W))
xx = np.arange(W)[None, :] * np.ones((H, 1))

h = np.array(Image.open(src).convert('RGBA'))
m = h[..., 3] > 8
lab, k = ndi.label(m)
sz = ndi.sum(m, lab, range(1, k + 1))
h[~np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 1500])] = 0
m = h[..., 3] > 8

# 2) 턱 선 맞춤: 얼굴 구멍(머리가 없는 가운데)의 반폭과 얼굴 반폭의 차이만큼 가운데로 민다
free = ~m
free[700:] = False
lab2, _ = ndi.label(free)
hole = lab2 == lab2[420, 512]
shift = np.zeros(H, np.float32)
for y in range(500, 591):
    hx = np.where(hole[y])[0]
    fx = np.where(face[y])[0]
    if len(hx) and len(fx):
        shift[y] = max(0.0, (hx.max() - hx.min()) / 2 - (fx.max() - fx.min()) / 2)
shift = np.clip(cv2.GaussianBlur(shift.reshape(-1, 1), (1, 0), 9).ravel(), 0, 70)
rows = np.arange(H)
up = np.clip((rows - 480) / 110.0, 0, 1)            # 480→590 줄에서 서서히 늘고
down = np.clip((900 - rows) / 260.0, 0, 1)          # 640→900 줄에서 아주 천천히 줄어 0 (아래 긴 머리는 그대로)
s = shift.copy()
s[591:] = s[590]
s = s * np.minimum(up, down)
mapx = np.where(xx < 512, xx - s[:, None], xx + s[:, None]).astype(np.float32)
mapy = (yy).astype(np.float32)
h = cv2.remap(h, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
m = h[..., 3] > 8
print(name, 'shift at 560/600/700:', round(float(s[560]), 1), round(float(s[600]), 1), round(float(s[700]), 1))

# 3) 목·턱 옆 빈틈을 뒷머리 색으로
dark = h[m][:, :3].astype(int)
col = np.median(dark[dark.sum(axis=1) < 250], axis=0).astype(np.uint8)
span = np.zeros_like(m)
for y in range(380, 760):
    xs = np.where(m[y])[0]
    if len(xs):
        span[y, xs.min():xs.max() + 1] = True
near = cv2.dilate(bm.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (111, 111))).astype(bool)  # 얼굴·목 둘레만
gap = span & ~m & ~bm & near
fade = np.clip((700 - yy) / 140.0, 0, 1)
near_soft = cv2.GaussianBlur(near.astype(np.float32), (0, 0), 14)
fade = fade * near_soft
out = h.copy()
for c in range(3):
    out[..., c] = np.where(gap, col[c], out[..., c])
out[..., 3] = np.where(gap, np.maximum(out[..., 3], (fade * 255).astype(np.uint8)), out[..., 3])

Image.fromarray(out).save(f'assets-src/base/hair_{name}.png')

# 4) 머리가 몸 뒤에 그려지므로, 몸의 머리 쪽은 머리카락이 덮던 부분을 지워서(얼굴·귀·목만 남김) 맨머리가 머리카락 위로 보이지 않게 한다
hair_a = out[..., 3] > 128
keep = cv2.dilate((face & ~hair_a).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))).astype(bool) & face
keep_soft = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 1.6)
for suf, srcf in (('', 'body_bald.png'), ('_barefoot', 'body_bald_barefoot.png')):
    b = np.array(Image.open(f'assets-src/base/{srcf}').convert('RGBA'))
    b[:640][~keep[:640]] = 0
    b[:640, :, 3] = (b[:640, :, 3] * np.where(keep[:640], 1.0, 0.0) * np.clip(keep_soft[:640] * 1.4, 0, 1)).astype(np.uint8)
    lab3, n3 = ndi.label(b[..., 3] > 0)
    sz3 = ndi.sum(b[..., 3] > 0, lab3, range(1, n3 + 1))
    b[~np.isin(lab3, [i + 1 for i, s_ in enumerate(sz3) if s_ > 2000])] = 0
    Image.fromarray(b).save(f'assets-src/base/body_{name}{suf}.png')
print(name, 'ok')
