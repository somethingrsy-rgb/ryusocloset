"""잘라서 받은 원피스 PNG(크기가 제각각, 옷만 있음)를 아바타 캔버스(1024×1536)에 놓아 assets-src/clothes/ 에 저장한다.

모든 원피스를 같은 배율(SCALE)로 줄이고, 옷 영역의 가로 가운데를 아바타 가운데(x=512)에, 맨 위(옷깃)를 TOP_Y 에 맞춘다.
(원피스끼리 크기 비율이 원본 그림 그대로 유지된다. 앱에서 손가락으로 더 맞출 수 있다.)

사용: python tools-py/place_dresses.py <원피스 PNG 폴더>      (저장소 루트에서)
의존성: pip install numpy pillow
"""
import os
import sys

from PIL import Image

W, H = 1024, 1536
SCALE = 0.6
TOP_Y = 622
CX = 512
OUT = 'assets-src/clothes'

# 받은 파일 → 옷 id (같은 id 를 쓰면 저장해 둔 코디가 그대로 유지된다)
NAMES = {
    '원피스_쉬즈미스_회색': 'dress_shesmiss_gray',
    '원피스_아이작_갈색': 'dress_isaac_brown',
    '원피스_아이작_검정반소매': 'dress_isaac_black',
    '원피스_아이작_네이비': 'dress_isaac_navy',
    '원피스_아이작_셔츠배색': 'dress_isaac_shirt_black',
    '원피스_옥스포드_베이지': 'dress_oxford_beige',
    '원피스_트위드_검정': 'dress_deco_tweed_black',
}

src = sys.argv[1]
for stem, oid in NAMES.items():
    im = Image.open(os.path.join(src, stem + '.png')).convert('RGBA')
    bb = im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
    im = im.crop(bb)
    w, h = round(im.width * SCALE), round(im.height * SCALE)
    im = im.resize((w, h), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(im, (round(CX - w / 2), TOP_Y))
    canvas.save(os.path.join(OUT, oid + '.png'))
    print(oid, (w, h))
