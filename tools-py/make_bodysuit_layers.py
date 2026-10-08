"""속옷 차림 아바타 이미지(체크무늬 배경이 박힌 JPG)에서 body.png / body_barefoot.png 를 만든다.

1) 배경의 체크무늬(밝고 색 없는 픽셀)를 가장자리부터 지워 투명하게 만든다.
2) 1024×1536 캔버스로 옮긴다. 변환값은 얼굴·머리 특징점(ORB+RANSAC)으로 구한 것으로,
   앞/뒷머리 레이어와 머리 실루엣이 98% 겹친다. (scale 0.5938, 회전 0.13°, 이동 62.4/33.2)
3) body_barefoot.png: 슬리퍼를 지운 몸 (CUT 행 아래를 투명 처리 — 신발이 그 위를 덮는다)

사용: python tools-py/make_bodysuit_layers.py assets-src/base/source/bodysuit_avatar_checkerboard.jpg assets-src/base
의존성: pip install numpy scipy opencv-python-headless pillow
"""
import sys
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
W, H = 1024, 1536
M = np.array([[0.5938095189055483, -0.0013059127267199433, 62.40679299914815],
              [0.0013059127267199433, 0.5938095189055483, 33.23843620207521]])
CUT = 1433  # 슬리퍼가 시작되는 행 (캔버스 좌표)

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
print('ok')
