"""투명 PNG 옷 한 장을 코디 탭용 아바타 캔버스(1024×1536)로 놓아 assets-src/clothes/<id>.png 로 저장한다.

  python tools-py/add_clothes.py dress  <원본.png> <id> [폭]     원피스: 옷 영역 폭을 맞추고(기본 700), 가로 가운데 x=512, 맨 위 y=604 (옷깃이 높아서 어깨선에 맞추려고 조금 위로)
  python tools-py/add_clothes.py shoes  <원본.png> <id>          신발 한 쌍: 두 짝을 아바타 두 발에 맞춘다 (가운데 423.3/598.1, 폭 110, 발끝 y 1509)
  python tools-py/add_clothes.py top    <원본.png> <id> [맨위y]   상의: 폭 635, 맨 위 y (기본 630)

(투명 가장자리의 희미한 번짐(알파 12 이하)은 지운다. 이름·색은 scripts/labels.json 에 직접 적는다.)
의존성: pip install numpy scipy pillow
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

W, H = 1024, 1536
mode, src, oid = sys.argv[1:4]
arg = float(sys.argv[4]) if len(sys.argv) > 4 else None

im = Image.open(src).convert('RGBA')
a = np.array(im)
a[a[..., 3] <= 12] = 0
im = Image.fromarray(a)
bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()


def canvas_with(piece, x, y):
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    c.alpha_composite(piece, (int(round(x)), int(round(y))))
    return c


if mode in ('dress', 'top'):
    im = im.crop(bb)
    if mode == 'dress':
        s, top = (arg or 700) / im.width, 604
    else:
        s, top = min(635 / im.width, 374 * 1.3 / im.height), int(arg or 630)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    out = canvas_with(im, 512 - im.width / 2, top)
else:
    lab, n = ndi.label(a[..., 3] > 128)
    parts = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(xs) > 1500:
            parts.append((xs.mean(), xs.max() - xs.min() + 1, ys.max()))
    assert len(parts) == 2, f'신발 두 짝이 따로 보여야 해요: {parts}'
    (x1, w1, b1), (x2, w2, b2) = sorted(parts)
    s = 0.5 * ((598.1 - 423.3) / (x2 - x1) + 110 / ((w1 + w2) / 2))
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    out = canvas_with(im, 0.5 * (423.3 + 598.1) - 0.5 * (x1 + x2) * s, 1509 - max(b1, b2) * s)
out.save(f'assets-src/clothes/{oid}.png')
print(oid, 'scale=%.3f' % s, out.getchannel('A').getbbox())
