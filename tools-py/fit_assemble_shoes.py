"""조립 탭 신발(발목이 보이는 한 쌍, 2170×725)을 아바타 발 위치에 맞추는 값을 계산해 scripts/assemble-shoes-fit.json 에 저장한다.

신발 이미지에서 왼쪽·오른쪽 신발 덩어리의 가운데와 폭을 찾아
  - 배율 s = (아바타 두 발 가운데 사이 거리 / 신발 두 짝 가운데 사이 거리) 와 (아바타 발 폭 / 신발 폭) 의 평균 (신발이 발보다 약간 크게 그려져 있어 발을 덮는다)
  - 두 짝의 가운데 x 가 아바타 발 가운데에, 맨 아래가 FEET_Y 에 오도록 위치를 정한다.
조립 탭의 하의는 맨발까지 그려져 있어서 신발이 그 발을 덮는다. 하의마다 발 위치가 조금 달라 앱에서 손가락으로 더 맞출 수 있다.

사용: python tools-py/fit_assemble_shoes.py
의존성: pip install numpy opencv-python-headless pillow
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

SRC = 'assets-src/assemble/shoes'
OUT = 'scripts/assemble-shoes-fit.json'
# 정면 아바타(1024×1536)의 두 발: 가운데 x, 폭(둘 다 118), 발끝 y (측정값)
FOOT_CX = (414.0, 608.0)
FOOT_W = 118.0
FEET_Y = 1512

fit = {}
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'):
        continue
    a = np.array(Image.open(os.path.join(SRC, f)).convert('RGBA'))[:, :, 3] > 128
    ys = np.where(a.any(1))[0]
    n, _, st, _ = cv2.connectedComponentsWithStats(a.astype(np.uint8))
    shoes = sorted([(st[i, 0] + st[i, 2] / 2, st[i, 2]) for i in range(1, n) if st[i, 4] > 3000])
    assert len(shoes) == 2, (f, shoes)
    (x1, w1), (x2, w2) = shoes
    s = 0.5 * ((FOOT_CX[1] - FOOT_CX[0]) / (x2 - x1) + FOOT_W / ((w1 + w2) / 2))
    mid = 0.5 * (x1 + x2)
    fit[f[:-4]] = {
        's': round(float(s), 4),
        'tx': round(float(0.5 * (FOOT_CX[0] + FOOT_CX[1]) - s * mid), 1),
        'ty': round(float(FEET_Y - s * ys.max()), 1),
    }
    print(f'{f[:-4]:26s} s={s:.3f}  신발 폭 {s * (w1 + w2) / 2:.0f}px (발 {FOOT_W:.0f}px)')
with open(OUT, 'w', encoding='utf-8') as fp:
    json.dump(fit, fp, ensure_ascii=False, indent=2)
    fp.write('\n')
