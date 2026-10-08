"""조립 탭 하의(다리까지 붙은 이미지)를 아바타 허리 위치·크기에 맞추는 값을 계산해 scripts/assemble-bottoms-fit.json 에 저장한다.

하의 이미지는 위쪽에 맨살 허리 조각(밝은 살색)이 있고 그 아래부터 옷이다. 이 허리 조각에서 가장 좁은 줄(허리)을 찾아
  - 가로 배율 sx = 아바타 허리 폭 / 하의 허리 폭
  - 세로 배율 sy = (발끝 목표 - 허리 높이) / (하의 발끝 - 하의 허리 줄)  → 발이 캔버스 안에 들어오게
  - 두 배율의 기하평균을 균일 배율 s 로 쓰고(찌그러짐 방지), 발끝이 FEET_Y 에 오도록 세로 위치를 정한다.
균일 배율이라 허리가 아바타보다 조금 좁거나 넓을 수 있다. 앱에서 손가락으로 더 맞출 수 있다.

사용: python tools-py/fit_assemble_bottoms.py
의존성: pip install numpy pillow
"""
import json
import os

import numpy as np
from PIL import Image

SRC = 'assets-src/assemble/bottoms'
OUT = 'scripts/assemble-bottoms-fit.json'
# 정면 아바타(1024×1536)의 허리: 속옷 몸통이 가장 좁은 높이/폭/가운데 x (측정값)
WAIST_Y, WAIST_W, CX = 840, 208, 511.5
FEET_Y = 1520  # 발끝 목표 (캔버스 높이 1536 안쪽)

fit = {}
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.png'):
        continue
    g = np.array(Image.open(os.path.join(SRC, f)).convert('RGBA'))
    a = g[:, :, 3] > 128
    last = int(np.where(a.any(1))[0].max())
    best = None  # (행, 폭, 가운데x)
    for y in range(60, 175):
        xs = np.where(a[y])[0]
        if len(xs) == 0:
            continue
        if g[y, (xs.min() + xs.max()) // 2, :3].astype(int).min() < 190:
            break  # 옷 색이 시작됨 → 맨살 허리 조각 끝
        w = int(xs.max() - xs.min())
        if best is None or w < best[1]:
            best = (y, w, (xs.min() + xs.max()) / 2)
    row, w, cx = best
    sx = WAIST_W / w
    sy = (FEET_Y - WAIST_Y) / (last - row)
    s = float(np.sqrt(sx * sy))
    ty = FEET_Y - s * last
    fit[f[:-4]] = {'s': round(s, 4), 'tx': round(CX - s * cx, 1), 'ty': round(ty, 1)}
    print(f'{f[:-4]:34s} s={s:.3f} (sx {sx:.3f} sy {sy:.3f})  허리 y≈{ty + s * row:.0f}')
with open(OUT, 'w', encoding='utf-8') as fp:
    json.dump(fit, fp, ensure_ascii=False, indent=2)
    fp.write('\n')
