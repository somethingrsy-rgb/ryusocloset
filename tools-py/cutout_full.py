"""흰 배경 JPG 로 받은 '다리·신발까지 그려진' 전신 옷을 투명 PNG 로 오려서 아바타 캔버스(1024×1536)에 놓는다.

  python tools-py/cutout_full.py <원본.jpg> <id> [옷 맨 위 y=640] [아바타 발끝 y=1510]

1) 가장자리에서 이어진 거의 흰색을 배경으로 보고 투명하게 만든다 (옷 안쪽의 흰색은 윤곽선에 막혀 있어서 남는다)
2) 떠다니는 꽃잎·반짝이(작은 조각)는 지운다
3) 옷 맨 위(깃)가 y=옷 맨 위 에, 신발 바닥이 발끝 y 에 오도록 같은 비율로 키우거나 줄이고 가로 가운데를 x=512 에 놓는다
의존성: pip install numpy scipy pillow
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, oid = sys.argv[1:3]
top_y = float(sys.argv[3]) if len(sys.argv) > 3 else 640
feet_y = float(sys.argv[4]) if len(sys.argv) > 4 else 1510
W, H = 1024, 1536

a = np.array(Image.open(src).convert('RGB')).astype(int)
h, w, _ = a.shape
white = a.min(axis=2) >= 240
lab, _ = ndi.label(white)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
alpha = np.where(bg, 0, 255).astype(np.uint8)
# 작은 조각(꽃잎·반짝이) 지우기: 가장 큰 덩어리와 그 근처 큰 덩어리만 남긴다
lab2, n = ndi.label(alpha > 0)
sizes = ndi.sum(alpha > 0, lab2, range(1, n + 1))
keep = [i + 1 for i, s in enumerate(sizes) if s > 0.01 * sizes.max()]
alpha[~np.isin(lab2, keep)] = 0
solid = alpha > 0
edge_px = solid & ~ndi.binary_erosion(solid)
alpha[edge_px] = 170
rgba = np.dstack([a.astype(np.uint8), alpha])
rgba[alpha == 0] = 0
im = Image.fromarray(rgba, 'RGBA')
bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
im = im.crop(bb)
s = (feet_y - top_y) / im.height
im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
out.alpha_composite(im, (round(512 - im.width / 2), round(top_y)))
out.save(f'assets-src/clothes/{oid}.png')
print(oid, 'scale=%.3f' % s, out.getchannel('A').getbbox())
