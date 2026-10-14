"""같은 얼굴·몸에 머리만 다른 아바타 그림 여러 장에서 '머리 없는 몸'과 머리 모양별 머리 레이어를 만든다.

  python tools-py/split_hair.py <아바타폴더> <스타일id=body.png 경로> [<스타일id=body.png 경로> ...]

예) python tools-py/split_hair.py assets-src/base/yuha braid=assets-src/base/yuha/source/braid.png twin=.../twin.png
  각 그림은 tools-py/import_avatar.py 로 이미 1024×1536 에 맞춘 투명 PNG 여야 한다 (몸·얼굴이 같아야 함).

1) 그림마다 머리카락(진한 갈색 큰 덩어리)을 찾는다.
2) 머리 없는 몸 = 한 그림에서 머리카락이 가리지 않은 살갗을 모으고, 어느 그림에서도 머리카락이 덮은 정수리는 살색으로 채운다.
   → body.png / body_barefoot.png
3) 머리 레이어 = 각 그림의 머리카락만 (hair_<id>.png). 앱에서 옷 위(앞머리 높이)에 얹는다.
의존성: pip install numpy scipy opencv-python-headless pillow
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

out = sys.argv[1]
styles = [a.split('=', 1) for a in sys.argv[2:]]
# 이름 앞에 +를 붙이면 '머리 레이어만' 만든다 (몸 쪽은 +없는 그림들로만 만든다: 얼굴이 다른 그림의 머리를 더할 때)
# ~ 는 + 와 같은데 머리카락을 '살색이 아닌 덩어리'로 찾는다 (밝은 갈색 머리처럼 진하지 않은 머리용)
hair_only = {sid.lstrip('+~') for sid, _ in styles if sid[0] in '+~'}
color_mask = {sid.lstrip('+~') for sid, _ in styles if sid[0] == '~'}
styles = [(sid.lstrip('+~'), p) for sid, p in styles]
H, W = 1536, 1024
BODY_Y = 640  # 이 아래는 몸(모든 그림에서 같음)


def load_color(path):
    """살색·배경이 아닌 덩어리 중 머리 꼭대기(y<250)에서 이어진 것을 머리카락으로 본다."""
    a = np.array(Image.open(path).convert('RGBA'))
    r, g, b = [a[..., i].astype(int) for i in range(3)]
    skin = (r > 190) & (g > 140) & (b > 110) & (r - b > 15)
    non = (a[..., 3] > 128) & ~skin
    non[1000:] = False
    non = cv2.morphologyEx(non.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)).astype(bool)
    lab, n = ndi.label(non)
    seeds = set(np.unique(lab[:250][non[:250]])) - {0}
    m = np.isin(lab, list(seeds))
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8)).astype(bool)
    m = ndi.binary_fill_holes(m)
    m = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & (a[..., 3] > 8)
    return a, m


def load(path):
    a = np.array(Image.open(path).convert('RGBA'))
    rgb = a[..., :3].astype(np.float32)
    al = a[..., 3]
    lum = rgb @ np.array([0.299, 0.587, 0.114])
    dark = (lum < 105) & ((rgb[..., 0] - rgb[..., 2]) < 45) & (al > 128)
    dark[800:] = False
    dark = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)).astype(bool)
    lab, n = ndi.label(dark)
    sz = ndi.sum(dark, lab, range(1, n + 1))
    m = np.isin(lab, [i + 1 for i, s in enumerate(sz) if s > 12000])
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8)).astype(bool)
    m = ndi.binary_fill_holes(m)
    m = cv2.dilate(m.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & (al > 8)
    return a, m


all_imgs = [(sid, *(load_color(p) if sid in color_mask else load(p))) for sid, p in styles]
imgs = [x for x in all_imgs if x[0] not in hair_only]  # 몸을 만드는 데 쓰는 그림
a0, m0 = imgs[0][1], imgs[0][2]

# 머리 없는 몸
skin_pick = [(a, ~m & (a[..., 3] > 128)) for _, a, m in imgs]
both_alpha = np.logical_and.reduce([a[..., 3] > 128 for _, a, _ in all_imgs])  # 모든 머리 모양 그림이 덮는 정수리 안쪽만 채운다
all_hair = np.logical_and.reduce([m for _, _, m in imgs])
fy = slice(300, 360)
forehead = a0[fy, 400:620][skin_pick[0][1][fy, 400:620]]
skin_color = np.median(forehead[:, :3], axis=0).astype(np.uint8)
print('skin', skin_color)
base = np.zeros((H, W, 4), np.uint8)
done = np.zeros((H, W), bool)
for a, skin in skin_pick:
    take = skin & ~done
    base[take] = a[take]
    done |= take
fill = both_alpha & all_hair & ~done
fill = ndi.binary_erosion(fill, iterations=3)
base[fill] = [*skin_color, 255]
# 이마 위쪽(눈썹보다 한참 위)은 어느 머리든 머리카락이 덮으므로 그림에 남은 가르마 선 같은 것을 지우고 살색으로 고르게 칠한다
top = ndi.binary_erosion(both_alpha, iterations=3)
wgt = np.clip((300 - np.arange(H)) / 40.0, 0, 1)[:, None] * top  # 260~300 에서 서서히 섞는다 (줄무늬가 보이지 않게)
cur = base[..., :3].astype(np.float32)
mix = cur * (1 - wgt[..., None]) + np.array(skin_color, np.float32) * wgt[..., None]
upd = (wgt > 0) & (base[..., 3] > 0) | ((wgt > 0) & top)
base[..., :3] = np.where(upd[..., None], mix, cur).astype(np.uint8)
base[..., 3] = np.where((wgt > 0) & top, 255, base[..., 3])
base[BODY_Y:] = a0[BODY_Y:]  # 몸은 같은 그림에서
# 구멍 메우기: 알파가 있는 곳에서 비어 있는 작은 틈
head = base[:BODY_Y]
al = head[..., 3] > 0
hole = ndi.binary_fill_holes(al) & ~al
head[hole] = [*skin_color, 255]
# 얼굴 가운데와 이어진 덩어리만 남긴다 (머리끝 가장자리에서 떨어져 나온 부스러기 제거)
lab, _ = ndi.label(base[..., 3] > 0)
base[lab != lab[500, 512]] = 0
Image.fromarray(base).save(f'{out}/body.png')
Image.fromarray(base).save(f'{out}/body_barefoot.png')

# 머리 레이어
for sid, a, m in all_imgs:
    f = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 0.8)
    layer = a.copy()
    layer[..., 3] = (a[..., 3].astype(np.float32) * f).astype(np.uint8)
    Image.fromarray(layer).save(f'{out}/hair_{sid}.png')
    print(sid, 'hair px', int((f > 0.5).sum()))
