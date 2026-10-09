"""'류소클로젯' 에셋 묶음(옷 / 방 / 캠핑 폴더, 768px 높이)을 저장소 에셋으로 바꿔 넣는다. 기존 옷·방 물건·캠핑 용품은 모두 지우고 이 묶음으로 교체한다.

옷(assets-src/clothes/*.png, 1024×1536 캔버스 + scripts/labels.json):
  - 512×768 캔버스에 아바타 기준으로 그려진 옷: 2배로 키워 그대로 쓴다. 기존 옷과 겹침(IoU)이 0.95 이상이면 같은 id·이름을 이어받는다.
  - 크기·위치가 제각각인 옷(원피스, 깃 높은 상의, 신발 한 쌍 등): 이전과 같은 조건으로 아바타에 놓는다 — 원피스는 이전 그림의 위치·폭, 상의는 기본 상의 폭·어깨선, 신발은 아바타 발.
방(assets-src/room/items/*, wall.webp, floor.webp), 캠핑(assets-src/camp/...): 폴더의 파일을 그대로 옮긴다 (이름이 한글인 것만 ROOM_NAMES 로 id 를 정함). 그림 크기는 빌드가 알아서 처리한다.

사용: python tools-py/import_pack.py <류소클로젯 폴더>      (저장소 루트에서; 그 다음 npm run assets)
의존성: pip install numpy scipy pillow
"""
import glob
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

W, H = 1024, 1536
pack = sys.argv[1]
CL = 'assets-src/clothes'

# ── 크기·위치가 제각각인 옷: 파일 → (id, 한글, 영문, 방식) ──
SPECIAL = {
    '옷/검정_가디건.png': ('top_trim_cardigan_black', '배색 가디건', 'Trim Cardigan', 'top@630'),
    '옷/아이보리_아노락_목수정.png': ('top_anorak_ivory', '아노락', 'Anorak', 'top@606'),
    '옷/아이보리_조끼_흰셔츠.png': ('top_cable_vest_shirt_ivory', '니트 조끼 셔츠', 'Knit Vest & Shirt', 'top@608'),
    '옷/초록무늬_조끼_흰셔츠.png': ('top_floral_vest_shirt_ivory', '꽃무늬 조끼 셔츠', 'Floral Vest & Shirt', 'top@608'),
    '옷/exec-a1696ee1-bb4c-48a2-9127-3dc1e298132b.png': ('top_cardigan_skyblue', '하늘색 가디건', 'Sky Cardigan', 'top@630'),
    '옷/원피스_쉬즈미스_회색.png': ('dress_shesmiss_gray', '코트 원피스', 'Coat Dress', 'dress'),
    '옷/원피스_아이작_갈색.png': ('dress_isaac_brown', '볼레로 원피스', 'Bolero Dress', 'dress'),
    '옷/원피스_아이작_검정반소매.png': ('dress_isaac_black', '스퀘어넥 원피스', 'Square-neck Dress', 'dress'),
    '옷/원피스_아이작_네이비.png': ('dress_isaac_navy', '볼레로 원피스', 'Bolero Dress', 'dress'),
    '옷/원피스_아이작_셔츠배색.png': ('dress_isaac_shirt_black', '셔츠 원피스', 'Shirt Dress', 'dress'),
    '옷/원피스_트위드_검정.png': ('dress_deco_tweed_black', '트위드 원피스', 'Tweed Dress', 'dress'),
    '옷/exec-fca4bc19-1b80-4874-a25d-1691c00bbd46.png': ('dress_oxford_beige', '옥스포드 원피스', 'Oxford Dress', 'dress'),
    '옷/플랫슈즈_검정.png': ('shoes_bow_flats_black', '리본 구두', 'Bow Flats', 'shoes'),
    '옷/플랫슈즈_베이지_리본없음.png': ('shoes_flats_beige', '베이지 구두', 'Beige Flats', 'shoes'),
}
# 512×768 캔버스 옷인데 기존 옷과 겹치지 않는 것 (새 id)
NEW_ALIGNED = {
    '옷/16_원피스_옥스포드 원피스_베이지.png': ('dress_oxford_slim_beige', '옥스포드 원피스 (슬림)', 'Oxford Dress (Slim)'),
    '옷/22_원피스_아이작 네이비_네이비.png': ('dress_isaac_shirt_navy', '셔츠 원피스', 'Shirt Dress'),
}

alpha = lambda im, t=8: np.array(im.convert('RGBA').getchannel('A')) > t


def bbox(im, t=8):
    a = alpha(im, t)
    ys, xs = np.where(a)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def on_canvas(piece, x, y):
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    c.alpha_composite(piece, (int(round(x)), int(round(y))))
    return c


def place_top(im, top_y):
    im = im.crop(bbox(im))
    s = min(635 / im.width, 374 * 1.3 / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    return on_canvas(im, 512 - im.width / 2, top_y)


def place_dress(im, old_png):
    ox0, oy0, ox1, oy1 = bbox(Image.open(old_png))
    im = im.crop(bbox(im))
    s = (ox1 - ox0) / im.width
    im = im.resize((ox1 - ox0, round(im.height * s)), Image.LANCZOS)
    return on_canvas(im, ox0, oy0)


def place_shoes(im):
    a = np.array(im.convert('RGBA').getchannel('A')) > 128
    lab, n = ndi.label(a)
    parts = []
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        if len(xs) > 1500:
            parts.append((xs.mean(), xs.max() - xs.min() + 1, ys.max()))
    assert len(parts) == 2, parts
    (x1, w1, b1), (x2, w2, b2) = sorted(parts)
    s = 0.5 * ((598.1 - 423.3) / (x2 - x1) + 110 / ((w1 + w2) / 2))
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    mid = 0.5 * (x1 + x2) * s
    return on_canvas(im, 0.5 * (423.3 + 598.1) - mid, 1509 - max(b1, b2) * s)


# ── 1) 옷 ──
old_ids = {os.path.basename(f)[:-4]: f for f in glob.glob(f'{CL}/*.png')}
old_masks = {k: alpha(Image.open(f), 128) for k, f in old_ids.items()}
old_labels = json.load(open('scripts/labels.json'))
backup = '/tmp/old_clothes'
shutil.rmtree(backup, ignore_errors=True)
shutil.copytree(CL, backup)
for f in old_ids.values():
    os.remove(f)

labels, report = {}, []
files = sorted(glob.glob(f'{pack}/옷/*.png')) + sorted(glob.glob(f'{pack}/방/exec-*.png'))  # 옷이 방 폴더에 섞여 있는 경우도 있다
for f in files:
    rel = os.path.relpath(f, pack)
    im = Image.open(f).convert('RGBA')
    if rel in SPECIAL:
        oid, ko, en, how = SPECIAL[rel]
        if how.startswith('top'):
            out = place_top(im, int(how.split('@')[1]))
        elif how == 'dress':
            out = place_dress(im, f'{backup}/{oid}.png')
        else:
            out = place_shoes(im)
        labels[oid] = {'ko': ko, 'en': en, 'native': True}
        if oid == 'top_cardigan_skyblue':
            labels[oid]['color'] = 'skyblue'
        if oid == 'dress_isaac_shirt_black':
            labels[oid]['color'] = 'black'
    else:
        assert abs(im.width / im.height - 2 / 3) < 0.01, (rel, im.size)  # 아바타 캔버스(2:3)에 맞춰 그려진 옷
        out = im.resize((W, H), Image.LANCZOS)
        if rel in NEW_ALIGNED:
            oid, ko, en = NEW_ALIGNED[rel]
            labels[oid] = {'ko': ko, 'en': en, 'native': True}
        else:
            a = alpha(out, 128)
            score, oid = max(((a & m).sum() / max((a | m).sum(), 1), k) for k, m in old_masks.items())
            assert score >= 0.95, (rel, score, oid)
            labels[oid] = old_labels[oid]
    out.save(f'{CL}/{oid}.png')
    report.append((oid, rel))
json.dump(labels, open('scripts/labels.json', 'w'), ensure_ascii=False, indent=2)
open('scripts/labels.json', 'a').write('\n')
print(f'옷 {len(report)}벌')
for oid, rel in report:
    print(f'  {oid:34s} ← {rel}')

# ── 2) 방 (assets-src/room) ──
ROOM_NAMES = {
    '크리스마스트리_레드화이트_반짝전구': 'furniture_xmas_tree_redwhite',
    '크리스마스트리_파스텔': 'furniture_xmas_tree_pastel',
}
RI = 'assets-src/room/items'
for f in glob.glob(f'{RI}/*'):
    os.remove(f)
n = 0
for f in sorted(glob.glob(f'{pack}/방/items/*.*')):
    stem, ext = os.path.splitext(os.path.basename(f))
    shutil.copy(f, f'{RI}/{ROOM_NAMES.get(stem, stem)}{ext}')
    n += 1
for name in ('wall', 'floor'):
    for g in glob.glob(f'assets-src/room/{name}.*'):
        os.remove(g)
    src = glob.glob(f'{pack}/방/{name}.*')
    if src:
        shutil.copy(src[0], f'assets-src/room/{name}{os.path.splitext(src[0])[1]}')
print(f'방 물건 {n}개 (+ 벽지·바닥)')

# ── 3) 캠핑 ──
CAMP_MAP = {
    '캠핑배경': 'wall_day', '캠핑밤배경': 'wall_night', '잔디밭': 'floor', '텐트': 'items/camp_tent', '모닥불': 'items/camp_campfire',
    '캠핑의자': 'items/camp_chair', '캠핑테이블': 'items/camp_table', '랜턴': 'items/camp_lantern', '아이스박스': 'items/camp_icebox',
    '고기굽는그릴': 'items/camp_grill',
}
for name, dst in CAMP_MAP.items():
    shutil.copy(f'{pack}/캠핑/{name}.png', f'assets-src/camp/{dst}.png')
print(f'캠핑 {len(CAMP_MAP)}개')
