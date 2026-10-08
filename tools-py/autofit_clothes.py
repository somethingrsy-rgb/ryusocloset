"""옷을 아바타 몸에 자동으로 맞춘다 (속옷이 옷 옆으로 비치는 것을 줄이는 보정값 계산).

1) 아바타 원본에서 속옷(민소매+반바지)을 찾는다: 속옷 외곽선(진한 붉은 선)으로 둘러싸인 영역을 채워서 분리.
2) 옷마다 "속옷이 옷의 가로 범위 바깥(옆)으로 삐져나온 픽셀 수"를 재고,
   가로·세로 배율(sx, sy)과 이동(dx, dy)을 조금씩 바꿔 가며 그 수를 줄이는 값을 찾는다.
   (옷 영역의 중심을 기준으로 확대/이동. 값이 크게 변하지 않도록 규제항을 둔다.)
3) 개선이 충분히 큰 옷만(DELTA 이상) scripts/fit.json 에 기록한다. 나머지는 원본 그대로 둔다.

scripts/build-assets.ts 가 fit.json 을 읽어 옷 이미지에 같은 변환을 적용한다.

사용: python tools-py/autofit_clothes.py            (저장소 루트에서)
의존성: pip install numpy scipy opencv-python-headless pillow
"""
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

W, H = 1024, 1536
K = 3  # 탐색은 1/3 해상도로
DELTA = 300  # 이만큼(픽셀 수) 이상 줄어드는 옷만 보정한다
AVATAR = 'assets-src/base/body.png'  # 1024x1536, 옷과 같은 캔버스
CLOTHES = 'assets-src/clothes'
OUT = 'scripts/fit.json'
SEED_REL = (0.51, 0.55)  # 속옷 몸통 안쪽 점 (아바타 폭, 높이 비율) — 가슴~허리 사이


def suit_mask():
    """아바타(1024x1536 body.png)에서 속옷 영역(외곽선 포함)을 같은 크기 불리언 마스크로."""
    a = np.array(Image.open(AVATAR).convert('RGBA'))
    h, w = a.shape[:2]
    rgb = a[:, :, :3].astype(int)
    al = a[:, :, 3] > 128
    R, G, B = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    outline = al & (R - G > 45) & (lum < 175)  # 진한 붉은 외곽선
    hair = al & (lum < 95) & ((R - B) < 35)
    free = al & ~hair & ~cv2.dilate(outline.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    lab, _ = ndi.label(free)
    sy, sx = int(SEED_REL[1] * h), int(SEED_REL[0] * w)
    # 시드 주변에서 가장 큰 영역을 속옷으로 본다
    ids, counts = np.unique(lab[sy - 40:sy + 40, sx - 40:sx + 40], return_counts=True)
    ids = [(c, i) for i, c in zip(ids, counts) if i != 0]
    if not ids:
        sys.exit('속옷 영역을 찾지 못했습니다 (SEED_REL 확인)')
    suit = lab == max(ids)[1]
    suit = cv2.dilate(suit.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0  # 외곽선 포함
    suit &= al
    assert suit.shape == (H, W), suit.shape
    return suit


def main():
    S = suit_mask()
    Ss = cv2.resize(S.astype(np.uint8), (W // K, H // K), interpolation=cv2.INTER_NEAREST) > 0
    hs, ws = Ss.shape
    X = np.arange(ws)[None, :]

    def exposure(G):
        rows = G.any(1)
        if not rows.any():
            return 0
        left = np.where(rows, G.argmax(1), ws)
        right = np.where(rows, ws - 1 - G[:, ::-1].argmax(1), -1)
        return int((Ss & rows[:, None] & ((X < left[:, None] - 1) | (X > right[:, None] + 1))).sum())

    def affine(sx, sy, dx, dy, cx, cy):
        return np.array([[sx, 0, cx - sx * cx + dx], [0, sy, cy - sy * cy + dy]], np.float32)

    def fit(G0, cx, cy, cat):
        G0s = cv2.resize(G0.astype(np.uint8), (ws, hs), interpolation=cv2.INTER_NEAREST)
        cxs, cys = cx / K, cy / K

        def J(p):
            sx, sy, dx, dy = p
            M = affine(sx, sy, dx / K, dy / K, cxs, cys)
            G = cv2.warpAffine(G0s, M, (ws, hs), flags=cv2.INTER_NEAREST) > 0
            return exposure(G) * K * K + 60000 * ((sx - 1) ** 2 + (sy - 1) ** 2) + 25 * np.hypot(dx, dy)

        steps = [np.arange(0.97, 1.261, 0.01), np.arange(0.96, 1.061, 0.01), np.arange(-18, 19, 3.0), np.arange(-24, 25, 4.0)]
        if cat in ('top', 'outer', 'dress'):
            steps[0] = np.arange(0.96, 1.16, 0.01)
        p = np.array([1, 1, 0, 0], float)
        best = J(p)
        j0 = best
        for _ in range(3):
            for i in range(4):
                for v in steps[i]:
                    q = p.copy()
                    q[i] = v
                    j = J(q)
                    if j < best - 1e-6:
                        best, p = j, q
        return p, j0, best

    labels = json.load(open('scripts/labels.json', encoding='utf-8'))
    fits = {}
    for f in sorted(os.listdir(CLOTHES)):
        if not f.lower().endswith('.png'):
            continue
        stem = f[:-4]
        cat = stem.split('_')[0]
        if cat in ('shoes', 'acc') or labels.get(stem, {}).get('native'):
            continue  # 신발·소품, 그리고 현재 아바타 기준으로 새로 그린 옷(native)은 보정하지 않는다
        g = np.array(Image.open(os.path.join(CLOTHES, f)).convert('RGBA'))
        if g.shape[:2] != (H, W):
            print(f'건너뜀(캔버스 {W}x{H} 아님): {f}')
            continue
        G0 = g[:, :, 3] > 40
        ys, xs = np.where(G0)
        cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        p, j0, j = fit(G0, cx, cy, cat)
        mark = ''
        if j0 - j >= DELTA:
            fits[stem] = {'sx': round(float(p[0]), 3), 'sy': round(float(p[1]), 3), 'dx': round(float(p[2]), 1), 'dy': round(float(p[3]), 1)}
            mark = '  ← 적용'
        print(f'{stem:30s} sx {p[0]:.2f} sy {p[1]:.2f} d=({p[2]:.0f},{p[3]:.0f})  비침 {j0:.0f} → {j:.0f}{mark}', flush=True)
    with open(OUT, 'w', encoding='utf-8') as fp:
        json.dump(fits, fp, ensure_ascii=False, indent=2)
        fp.write('\n')
    print(f'\n{len(fits)}벌 보정값 저장 → {OUT}')


if __name__ == '__main__':
    main()
