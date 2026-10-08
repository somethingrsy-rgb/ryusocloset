"""속옷 차림 아바타 원본에서 body.png / body_barefoot.png 를 만든다.

원본(assets-src/base/source/)에는 두 가지가 있다.
  bodysuit_avatar_transparent.png    투명 PNG (959×1639) — 현재 사용 중, 가장자리가 깨끗함
  bodysuit_avatar_checkerboard.jpg   (예전) 체크무늬 배경이 박힌 JPG — 배경을 먼저 지워야 함 (git 기록에 있음)

처리:
1) 체크무늬 JPG 인 경우 배경(밝고 색 없는 픽셀)을 가장자리부터 지운다. 투명 PNG 는 알파만 보정한다
   (알파가 252~253 으로 조금 비쳐 있어서 255 로 늘림 — 가장자리 안티앨리어싱은 유지).
2) 1024×1536 캔버스로 옮긴다. 변환값은 얼굴·머리 특징점(ORB+RANSAC)으로 구한 값이라
   앞머리 레이어(hair_front.png)와 머리 실루엣이 98% 이상 겹친다.
3) body_barefoot.png: 슬리퍼를 지운 몸 (CUT 행 아래를 투명 처리 — 신발이 그 위를 덮는다)

사용: python tools-py/make_bodysuit_layers.py <원본> assets-src/base [png|jpg]
의존성: pip install numpy scipy opencv-python-headless pillow
"""
import sys
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
kind = sys.argv[3] if len(sys.argv) > 3 else ('png' if src.lower().endswith('.png') else 'jpg')
W, H = 1024, 1536
CUT = 1433  # 슬리퍼가 시작되는 행 (캔버스 좌표)
# 원본 → 캔버스 변환 (scale·회전·이동)
MATRIX = {
    'png': [[0.9137671266911238, -0.0012475128494627453, 63.21312016881214],
            [0.0012475128494627453, 0.9137671266911238, 34.368118709412855]],
    'jpg': [[0.5938095189055483, -0.0013059127267199433, 62.40679299914815],
            [0.0013059127267199433, 0.5938095189055483, 33.23843620207521]],
}
M = np.array(MATRIX[kind])

if kind == 'png':
    rgba = np.array(Image.open(src).convert('RGBA'))
    a = rgba[:, :, 3].astype(np.float32)
    rgba[:, :, 3] = np.clip(a * 255 / 253, 0, 255).astype(np.uint8)
else:
    bgr = cv2.imread(src)
    rgb = bgr[:, :, ::-1].astype(int)
    mx, mn = rgb.max(2), rgb.min(2)
    light = (mn > 175) & ((mx - mn) < 14)  # 체크무늬: 밝고 색 없음
    lab, _ = ndi.label(light)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    char = ~np.isin(lab, list(border))
    lab2, n2 = ndi.label(char)
    sizes = ndi.sum(char, lab2, range(1, n2 + 1))
    char = ndi.binary_fill_holes(lab2 == (1 + int(np.argmax(sizes))))
    m = cv2.morphologyEx(char.astype(np.uint8) * 255, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.GaussianBlur(cv2.erode(m, np.ones((3, 3), np.uint8)), (0, 0), 1.1)
    rgba = np.dstack([rgb.astype(np.uint8), m])

body = cv2.warpAffine(rgba, M, (W, H), flags=cv2.INTER_AREA | cv2.INTER_LINEAR)
Image.fromarray(body).save(f'{out}/body.png')
bare = body.copy()
bare[CUT:, :, 3] = 0
Image.fromarray(bare).save(f'{out}/body_barefoot.png')
print('ok', kind)
