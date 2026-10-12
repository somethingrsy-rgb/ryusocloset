"""테마옷(costume 카테고리) 크기를 허리(가슴 아래 몸통) 폭 기준으로 맞춘다.

  python3 -I tools-py/fit_costumes.py          미리보기 (표만 출력)
  python3 -I tools-py/fit_costumes.py --apply  assets-src/clothes/<id>.png 를 다시 저장 (한 번만; 적용한 옷은 costume_fit_applied.json 에 기록해 다시 건드리지 않는다)

1) 옷 위쪽 8~40% 구간에서, 가운데(x=512)에 이어진 불투명 덩어리의 폭이 가장 좁은 줄을 '허리'로 본다.
2) 허리 폭이 TARGET_WAIST 가 되도록 옷깃(맨 위 가운데)을 고정점으로 키우거나 줄인다 (작은 옷만 키움, 줄이지 않음).
3) 커지는 양은 캔버스(1024x1536) 밖으로 잘리지 않게 제한한다.
OVERRIDES 에 id: (허리 y, 허리 폭) 을 적으면 자동 감지 대신 그 값을 쓴다.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CLOTHES = ROOT / 'assets-src/clothes'
APPLIED = Path(__file__).with_name('costume_fit_applied.json')
TARGET_WAIST = 200  # 아바타 허리(약 175) + 옷 두께
MIN_SCALE, MAX_SCALE = 1.0, 1.7  # 줄이지는 않는다 (작은 옷만 키움)
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


def main():
    items = json.loads((ROOT / 'src/data/items.json').read_text())
    ids = [i['id'] for i in items if i['category'] == 'costume']
    applied = json.loads(APPLIED.read_text()) if APPLIED.exists() else {}
    for oid in ids:
        path = CLOTHES / f'{oid}.png'
        im = Image.open(path).convert('RGBA')
        r = analyse(im, oid)
        done = oid in applied
        print(f"{oid:26} waist y={r['wy']:4} w={r['ww']:4} → scale {r['scale']:.3f} {'(이미 적용)' if done else ''}")
        if '--apply' in sys.argv and not done and abs(r['scale'] - 1) > 0.01:
            refit(im, r['top'], r['scale']).save(path)
            applied[oid] = r['scale']
    if '--apply' in sys.argv:
        APPLIED.write_text(json.dumps(applied, indent=2, ensure_ascii=False) + '\n')


main()
