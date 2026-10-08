"""hair_back.png 의 틈 메우기.

hair_front 와 hair_back 이 만나는 경계에서 두 레이어 모두 반투명이면 그 아래 배경이 비쳐
머리카락 안쪽에 얇은 밝은 선이 보인다. 두 레이어의 합집합 실루엣 '안쪽'(바깥 경계에서 7px 이상 들어간 곳)을
hair_back 에서 불투명하게 채워 선을 없앤다. 바깥 윤곽의 안티앨리어싱은 건드리지 않는다.

사용: python tools-py/fix_hair_seam.py assets-src/base   (hair_back.png 를 제자리에서 수정)
의존성: pip install numpy scipy opencv-python-headless pillow
"""
import sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi

d = sys.argv[1]
back = np.array(Image.open(f'{d}/hair_back.png').convert('RGBA'))
front = np.array(Image.open(f'{d}/hair_front.png').convert('RGBA'))
ab = back[:, :, 3].astype(np.float32) / 255
af = front[:, :, 3].astype(np.float32) / 255
union = 1 - (1 - ab) * (1 - af)

solid = (union > 0.5).astype(np.uint8)
closed = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
closed = ndi.binary_fill_holes(closed).astype(np.uint8)
interior = cv2.erode(closed, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
gap = (interior > 0) & (union < 0.985)

# 채울 색: 가까운 hair_back 불투명 픽셀 색 (없으면 hair_front 색)
src_ok = back[:, :, 3] > 200
idx = ndi.distance_transform_edt(~src_ok, return_distances=False, return_indices=True)
nearest = back[idx[0], idx[1], :3]
out = back.copy()
out[gap, :3] = nearest[gap]
out[gap, 3] = 255
Image.fromarray(out).save(f'{d}/hair_back.png')
print('filled px:', int(gap.sum()))
