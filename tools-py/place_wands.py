"""지팡이(acc_wand_*) 를 아바타 손에 쥐게 놓는다.

  python3 -I tools-py/place_wands.py <잘라낸 지팡이 폴더> [손 x=864] [손 y=945] [기울기(도, 시계 방향이 +)=21]

폴더에는 w01.png … w14.png (배경을 지운 지팡이, 위가 머리)가 있다. 길이를 480px 로 맞추고, 자루의 위에서 60% 지점(쥐는 곳)을
손 위치에 두고 그 점을 중심으로 기울인다. 결과는 assets-src/clothes/acc_wand_<이름>.png (이름은 NAMES 순서).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

NAMES = ['pink_crystal', 'pink_star', 'ice_snow', 'angel_wing', 'heart_blue', 'moon_crystal', 'gold_lotus',
         'silver_snow', 'pink_burst', 'sky_gem', 'gold_swirl', 'pink_hexa', 'gold_flower', 'white_clover']
ROOT = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1])
hx = float(sys.argv[2]) if len(sys.argv) > 2 else 864
hy = float(sys.argv[3]) if len(sys.argv) > 3 else 945  # 기본 위치: 손(985)에서 위로 5칸(40px)
tilt = float(sys.argv[4]) if len(sys.argv) > 4 else 21
H, GRIP = 480, 0.6

for n, name in enumerate(NAMES, 1):
    im = Image.open(src / f'w{n:02d}.png').convert('RGBA')
    w, h = im.size
    wand = im.resize((round(w * H / h), H), Image.LANCZOS)
    big = Image.new('RGBA', (1400, 1400), (0, 0, 0, 0))
    gx, gy = wand.width / 2, H * GRIP
    big.alpha_composite(wand, (round(700 - gx), round(700 - gy)))
    big = big.rotate(-tilt, resample=Image.BICUBIC, center=(700, 700))
    out = Image.new('RGBA', (1024, 1536), (0, 0, 0, 0))
    ox, oy = round(hx - 700), round(hy - 700)
    x0, y0 = max(0, -ox), max(0, -oy)
    out.alpha_composite(big.crop((x0, y0, x0 + min(1400 - x0, 1024 - max(0, ox)), y0 + min(1400 - y0, 1536 - max(0, oy)))), (max(0, ox), max(0, oy)))
    a = np.array(out)
    a[a[..., 3] <= 12] = 0
    Image.fromarray(a).save(ROOT / f'assets-src/clothes/acc_wand_{name}.png')
    print(name, Image.fromarray(a).getchannel('A').getbbox())
