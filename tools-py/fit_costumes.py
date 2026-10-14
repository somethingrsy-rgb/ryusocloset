"""테마옷(costume 카테고리) 크기를 허리(가슴 아래 몸통) 폭 기준으로 맞춘다.

  python3 -I tools-py/fit_costumes.py          미리보기 (표만 출력)
  python3 -I tools-py/fit_costumes.py --apply  assets-src/clothes/<id>.png 를 다시 저장

1) 옷 위쪽 8~40% 구간에서, 가운데(x=512)에 이어진 불투명 덩어리의 폭이 가장 좁은 줄을 '허리'로 본다.
2) 허리 폭이 TARGET_WAIST 가 되도록 옷깃(맨 위 가운데)을 고정점으로 키운다 (줄이지는 않고, MAX_SCALE 까지만).
3) 커지는 양은 캔버스(1024x1536) 밖으로 잘리지 않게 제한한다.
OVERRIDES 에 id: (허리 y, 허리 폭) 을 적으면 자동 감지 대신 그 값을 쓴다 (원본 크기 기준).
적용한 옷은 costume_fit_applied.json 에 {배율, 허리 폭} 으로 기록한다. 목표 값을 바꿔서 다시 돌리면
기록된 배율에서 새 배율로 한 번에 맞춘다(같은 옷을 두 번 키우지 않는다).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CLOTHES = ROOT / 'assets-src/clothes'
APPLIED = Path(__file__).with_name('costume_fit_applied.json')
TARGET_WAIST = 170  # 아바타 허리(약 175) 정도
MIN_SCALE, MAX_SCALE = 1.0, 1.25  # 작은 옷만 키우되 치마·리본이 화면을 덮을 만큼 커지지는 않게
# 손으로 맞춘 옷: 앱의 크기 조절(+ 한 번 = 1.1배)과 위치 조절(아래로 한 칸 = 8px)로 정한 값을 이미지에 굽는다.
# 자동 맞추기는 이 옷을 건드리지 않고, 한 번만 적용한다(적용 여부는 costume_fit_applied.json 의 'manual' 목록).
MANUAL: dict[str, dict] = {
    'costume_hanbok_starry': dict(scale=1.1 ** 2, dy=10 * 8, pivot=(512, 989)),  # +2, 아래로 10칸 (옷 영역 중심이 피벗)
    'dress_fairy_blue': dict(scale=1.1, dx=1 * 8, dy=14 * 8, pivot=(512, 991)),  # +1, 오른쪽 1칸, 아래로 14칸
    'costume_checker_queen': dict(scale=1.1, dy=0, pivot=(513, 1088)),  # +1
    'costume_floral_black': dict(scale=1.0, dx=1 * 8, dy=0, pivot=(512, 924)),  # 오른쪽 1칸
    'costume_forest_green': dict(scale=1 / 1.1, dy=-5 * 8, pivot=(512, 980)),  # -1, 위로 5칸
    'costume_petal_blue': dict(scale=1.0, dy=1 * 8, pivot=(512, 1062)),  # (+2, 아래로 5칸 적용한 뒤) 아래로 1칸 더
    'costume_sakura_blue': dict(scale=1.1, dy=6 * 8, pivot=(512, 1022)),  # +1, 아래로 6칸
    'costume_tassel_pink': dict(scale=1 / 1.1, dy=0, pivot=(512, 998)),  # -1
    'dress_card_red': dict(scale=1.0, dy=-1 * 8, pivot=(512, 1012)),  # 위로 1칸
    'dress_lolita_black': dict(scale=1.1, dy=4 * 8, pivot=(512, 920)),  # +1, 아래로 4칸
    'dress_lolita_purple': dict(scale=1.1, dy=4 * 8, pivot=(512, 944)),  # +1, 아래로 4칸
    'dress_maid_blue': dict(scale=1.1 ** 2, dy=10 * 8, pivot=(512, 913)),  # +2, 아래로 10칸
    'dress_midnight_navy': dict(scale=1.0, dy=-1 * 8, pivot=(512, 980)),  # 위로 1칸
    'shoes_pink_maryjane_socks': dict(scale=1.1 ** 2, dy=0, pivot=(510, 1431)),  # 신발 +2 (옷 영역 중심 기준)
    'shoes_platform_cream_heart': dict(scale=1.1 ** 3, dy=0, pivot=(517, 1436)),  # 신발 +3 (신발 영역 중심 기준)
    'dress_starry_navy': dict(scale=1.1, dy=6 * 8, pivot=(512, 1070)),  # +1, 아래로 6칸 (아래 자락은 캔버스 밖으로 잘림)
    'costume_clover_flower_lolita': dict(scale=1.1 ** 2, dx=2 * 8, dy=8 * 8, pivot=(512, 977)),  # +2, 오른쪽 2칸, 아래로 8칸
    'costume_yellow_ribbon_lolita': dict(scale=1 / 1.1 ** 2, dy=-10 * 8, pivot=(512, 1069)),  # -2, 위로 10칸
    'costume_winged_lolita_puff': dict(scale=1.1, dy=5 * 8, pivot=(512, 1022)),  # +1, 아래로 5칸 (위로 6칸 적용한 뒤 한 번 더)
    'shoes_yellow_ribbon_maryjane': dict(scale=1.1 ** 3, dy=0, pivot=(511, 1433)),  # 신발 +3
    'shoes_bow_flats_black': dict(scale=1.1, dy=0, pivot=(511, 1457)),  # 신발 +1
    'shoes_flats_beige': dict(scale=1.1, dy=0, pivot=(511, 1457)),  # 신발 +1
    'outer_cropped_denim': dict(scale=1.1, dy=0, pivot=(511, 808)),  # 아우터 +1
    'outer_jacket_gray': dict(scale=1.1, dy=0, pivot=(512, 814)),  # 아우터 +1
    'outer_nepa_black': dict(scale=1.1, dy=0, pivot=(512, 923)),  # 아우터 +1
    'outer_roem_tweed_black': dict(scale=1.1, dy=0, pivot=(512, 829)),  # 아우터 +1
    'outer_short_trench_black': dict(scale=1.1, dy=0, pivot=(510, 828)),  # 아우터 +1
    'outer_trench_beige': dict(scale=1.1, dy=0, pivot=(512, 955)),  # 아우터 +1
    'outer_trench_black': dict(scale=1.1, dy=0, pivot=(512, 952)),  # 아우터 +1
    'outer_trench_khaki': dict(scale=1.1, dy=0, pivot=(512, 959)),  # 아우터 +1
    'outer_tweed_navy': dict(scale=1.1, dy=0, pivot=(511, 803)),  # 아우터 +1
    'dress_deco_tweed_black': dict(scale=1.0, dy=-8, pivot=(512, 950)),  # 위로 1칸
    'dress_isaac_black': dict(scale=1.0, dy=24, pivot=(512, 919)),  # 아래로 3칸
    'dress_isaac_brown': dict(scale=1.1, dy=24, pivot=(512, 907)),  # +1, 아래로 3칸
    'dress_isaac_navy': dict(scale=1.0, dy=-8, pivot=(512, 966)),  # 위로 1칸
    'dress_oxford_beige': dict(scale=1.0, dy=16, pivot=(512, 943)),  # 아래로 2칸
    'dress_shesmiss_gray': dict(scale=1.0, dy=-8, pivot=(512, 923)),  # 위로 1칸
    'top_ivory': dict(scale=1 / 1.1, dy=0, pivot=(512, 768)),  # -1
    'top_tweed_cardigan_mint': dict(scale=1.0, dy=16, pivot=(512, 809)),  # 아래로 2칸
    'bottom_button_skirt_brown': dict(scale=1.0, dy=-16, pivot=(513, 1145)),  # 위로 2칸
    'bottom_denim': dict(scale=1.0, dy=24, pivot=(513, 1104)),  # 아래로 3칸
    'bottom_flare_skirt_gray': dict(scale=1.0, dy=-16, pivot=(511, 1123)),  # 위로 2칸
    'costume_alice_card_pink': dict(scale=1 / 1.1 ** 2, dy=-9 * 8, pivot=(512, 967)),  # -2, 위로 9칸
    'costume_maid_pink_heart': dict(scale=1 / 1.1 ** 4, dy=-20 * 8, pivot=(511, 1070)),  # -4, 위로 20칸
}
OVERRIDES: dict[str, tuple[int, int]] = {
    'dress_card_red': (760, 165),  # 목 장식이 따로 떨어져 있어서 자동 감지가 안 됨 (소매 사이 몸통 폭)
    # 몸통이 거의 안 보이는 옷은 눈으로 보고 정한 값 (허리 y, 몸통 폭)
    'costume_hanbok_starry': (700, 150),
    'costume_petal_blue': (760, 175),
    'dress_seashell_blue': (790, 155),
}


def central_run(row: np.ndarray, cx: int = 512):
    if not row[cx]:
        idx = np.where(row)[0]
        if not len(idx):
            return None
        cx = int(idx[np.argmin(abs(idx - cx))])
    l = r = cx
    while l > 0 and row[l - 1]:
        l -= 1
    while r < len(row) - 1 and row[r + 1]:
        r += 1
    return l, r


def analyse(im: Image.Image, oid: str):
    a = np.array(im)[..., 3] > 40
    ys = np.where(a.any(1))[0]
    xs = np.where(a.any(0))[0]
    top, bot, left, right = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
    h = bot - top
    if oid in OVERRIDES:
        wy, ww = OVERRIDES[oid]
    else:
        best = None
        for y in range(int(top + h * 0.08), int(top + h * 0.40)):
            c = central_run(a[y])
            if c and (best is None or c[1] - c[0] + 1 < best[1]):
                best = (y, c[1] - c[0] + 1)
        wy, ww = best
    want = min(MAX_SCALE, max(MIN_SCALE, TARGET_WAIST / max(1, ww)))
    # 옷깃(맨 위, x=512)을 고정점으로 키운다: 목선은 그대로 두고 허리는 아래로 내려가서 아바타 허리와 더 가까워진다.
    # 캔버스(1024x1536) 밖으로 잘리지 않게 제한한다.
    caps = [MAX_SCALE]
    if bot > top:
        caps.append((1534 - top) / (bot - top))
    if left < 512:
        caps.append(508 / (512 - left))
    if right > 512:
        caps.append(508 / (right - 512))
    s = min(want, *caps)
    return dict(wy=wy, ww=ww, scale=round(s, 3), top=top, box=(left, top, right, bot))


def refit(im: Image.Image, top: int, scale: float) -> Image.Image:
    """(512, top) 을 고정점으로 scale 배 한다 (캔버스 크기는 그대로)."""
    w, h = im.size
    big = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dx, dy = round(512 - 512 * scale), round(top - top * scale)
    # 음수 오프셋(키울 때)은 잘라서 붙인다
    cx, cy = max(0, -dx), max(0, -dy)
    piece = big.crop((cx, cy, cx + w, cy + h))
    out.alpha_composite(piece, (max(0, dx), max(0, dy)))
    return out


def manual_adjust(im: Image.Image, scale: float, dy: int, pivot: tuple[int, int], dx: int = 0) -> Image.Image:
    """피벗을 고정점으로 scale 배 한 뒤 오른쪽으로 dx, 아래로 dy 만큼 옮긴다 (캔버스 밖은 잘림)."""
    w, h = im.size
    big = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS) if abs(scale - 1) > 1e-9 else im
    ox, oy = round(pivot[0] - pivot[0] * scale + dx), round(pivot[1] - pivot[1] * scale + dy)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    x0, y0, sx, sy = max(0, ox), max(0, oy), max(0, -ox), max(0, -oy)
    out.alpha_composite(big.crop((sx, sy, sx + (w - x0), sy + (h - y0))), (x0, y0))
    return out


def main():
    items = json.loads((ROOT / 'src/data/items.json').read_text())
    ids = [i['id'] for i in items if i['category'] == 'costume']
    ids += [k for k in MANUAL if k not in ids]  # 테마옷이 아니어도 손으로 맞춘 옷은 포함
    applied = json.loads(APPLIED.read_text()) if APPLIED.exists() else {}
    manual_done = set(applied.pop('manual', []))
    out = {}
    for oid in ids:
        path = CLOTHES / f'{oid}.png'
        im = Image.open(path).convert('RGBA')
        if oid in MANUAL:
            state = '이미 적용' if oid in manual_done else ('이번에 적용' if '--apply' in sys.argv else '적용 예정')
            print(f"{oid:26} 수동 값 {MANUAL[oid]['scale']:.2f}배, 오른쪽 {MANUAL[oid].get('dx', 0)}px, 아래로 {MANUAL[oid]['dy']}px ({state})")
            if '--apply' in sys.argv and oid not in manual_done:
                manual_adjust(im, **MANUAL[oid]).save(path)
                manual_done.add(oid)
            continue
        prev = applied.get(oid, {'scale': 1.0})
        prev_s = prev['scale']
        r = analyse(im, oid)
        # 지금 이미지는 원본의 prev_s 배: 허리 폭은 기록값(없으면 지금 이미지에서 잰 값 / prev_s)
        base_w = prev.get('waist') or (OVERRIDES[oid][1] if oid in OVERRIDES else round(r['ww'] / prev_s))
        want = min(MAX_SCALE, max(MIN_SCALE, TARGET_WAIST / max(1, base_w)))
        # 지금 이미지 기준으로 더 키울 수 있는 한계(캔버스) → 원본 기준 총 배율 한계
        l, t, rt, b = r['box']
        caps = [MAX_SCALE]
        if b > t:
            caps.append(prev_s * (1534 - t) / (b - t))
        if l < 512:
            caps.append(prev_s * 508 / (512 - l))
        if rt > 512:
            caps.append(prev_s * 508 / (rt - 512))
        total = round(max(1.0, min(want, *caps)), 3)
        delta = total / prev_s
        mark = '' if abs(delta - 1) < 0.01 else f'  ← 이미지에 x{delta:.3f}'
        print(f"{oid:26} 허리 폭 {base_w:4} → 총 배율 {total:.3f} (지금 {prev_s:.3f}){mark}")
        if '--apply' in sys.argv:
            if abs(delta - 1) >= 0.01:
                refit(im, t, delta).save(path)
            else:
                total = prev_s
            if total > 1.0 or oid in applied:
                out[oid] = {'scale': total, 'waist': base_w}
    if '--apply' in sys.argv:
        out['manual'] = sorted(manual_done)
        APPLIED.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n')


main()
