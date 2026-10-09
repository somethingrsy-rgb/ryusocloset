"""조립 탭용 신발 PNG(두 짝이 한 장, 2170×725)를 코디 탭용 아바타 캔버스(1024×1536)에 놓아 assets-src/clothes/ 에 저장한다.

위치·배율은 tools-py/fit_assemble_shoes.py 가 계산한 scripts/assemble-shoes-fit.json 을 그대로 쓴다 (발에 맞게 놓인다).

사용: python tools-py/place_shoes.py shoes_bow_flats_black shoes_flats_beige      (저장소 루트에서, id 를 여러 개)
의존성: pip install pillow
"""
import json
import sys

from PIL import Image

W, H = 1024, 1536
fit = json.load(open('scripts/assemble-shoes-fit.json'))
for oid in sys.argv[1:]:
    f = fit[oid]
    im = Image.open(f'assets-src/assemble/shoes/{oid}.png').convert('RGBA')
    s = f['s']
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.alpha_composite(im, (round(f['tx']), round(f['ty'])))
    canvas.save(f'assets-src/clothes/{oid}.png')
    print(oid, canvas.getchannel('A').getbbox())
