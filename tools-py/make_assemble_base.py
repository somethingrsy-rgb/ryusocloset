"""조립 탭의 머리(head_default.png, 1024×1536 캔버스)를 만든다.

  head_default.png  assets-src/assemble/source/head_original.jpg (흰 배경, 1024×636, 목 위까지) 의 배경을 지우고
                    캔버스 맨 위(0,0)에 놓은 것. 아바타 머리와 위치가 같다.

사용: python tools-py/make_assemble_base.py
의존성: pip install numpy scipy opencv-python-headless pillow
"""
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

W, H = 1024, 1536
OUT = 'assets-src/assemble/base'

# --- 머리 ---
h = np.array(Image.open('assets-src/assemble/source/head_original.jpg').convert('RGB')).astype(int)
mx, mn = h.max(2), h.min(2)
light = (mn > 235) & ((mx - mn) < 14)
lab, _ = ndi.label(light)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0]]))) - {0}  # 아래쪽 가장자리는 잘린 면이라 제외
char = ~np.isin(lab, list(border))
l2, n = ndi.label(char)
sz = ndi.sum(char, l2, range(1, n + 1))
char = ndi.binary_fill_holes(l2 == (1 + int(np.argmax(sz))))
m = cv2.morphologyEx(char.astype(np.uint8) * 255, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
m = cv2.GaussianBlur(cv2.erode(m, np.ones((3, 3), np.uint8)), (0, 0), 1.0)
head = np.zeros((H, W, 4), np.uint8)
head[: h.shape[0]] = np.dstack([h.astype(np.uint8), m])
Image.fromarray(head).save(f'{OUT}/head_default.png')

print('ok')
