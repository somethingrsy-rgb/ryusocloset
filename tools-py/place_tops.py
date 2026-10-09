"""투명 PNG 상의(옷만 그려진 그림, 위치·크기는 제각각)를 코디 탭 기준으로 아바타 캔버스(1024×1536)에 놓아 assets-src/clothes/ 에 저장한다.

기존 상의들과 같은 조건으로 놓는다: 옷 폭을 WIDTH 에 맞추되 너무 길면(높이 한도) 줄이고, 가로 가운데를 x=512 에, 맨 위를 TOP_Y 에 맞춘다.
(빌드가 코디 탭 기본 크기로 한 번 더 줄이므로, WIDTH 는 그 전 값 = 기본 옷 폭 중앙값 × 1.08.)

사용: python tools-py/place_tops.py <원본.png>=<옷 id>[@맨위y] [...]   (깃이 높이 솟은 옷은 @610 처럼 위로 올려 어깨선을 맞춘다)      (저장소 루트에서)
의존성: pip install pillow
"""
import sys

from PIL import Image

W, H = 1024, 1536
WIDTH = 635
MAX_H = 374 * 1.3
TOP_Y = 630

for arg in sys.argv[1:]:
    src, oid = arg.rsplit('=', 1)
    top_y = TOP_Y
    if '@' in oid:
        oid, y = oid.split('@')
        top_y = int(y)
    im = Image.open(src).convert('RGBA')
    im = im.crop(im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())
    s = min(WIDTH / im.width, MAX_H / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(im, (round(512 - im.width / 2), top_y))
    canvas.save(f'assets-src/clothes/{oid}.png')
    print(oid, im.size, 's=%.3f' % s)
