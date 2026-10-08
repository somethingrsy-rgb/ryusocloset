"""정면으로 선 속옷 아바타(1024×1536, 맨발)에서 body / body_barefoot / hair_front 를 만든다.

원본: assets-src/base/source/standing_avatar_transparent.png (흰 배경을 지운 투명 PNG)
       assets-src/base/source/standing_avatar_original.png    (흰 배경 원본)

1) 캔버스 899×1536: 아바타를 늘리거나 줄이지 않고 좌우만 잘라 맞춘다 (원본 x 54~953).
2) body.png, body_barefoot.png: 이 아바타는 이미 맨발이라 둘이 같은 이미지다.
3) hair_front.png: 어깨 아래로 내려오는 머리카락(진한 색 큰 덩어리)만 따로 뽑아 옷 위에 한 번 더 덮는다.
   귀 아래(Y0~Y1)부터 서서히 나타나게 해서 얼굴 쪽 머리와 이음매가 생기지 않게 한다.

사용: python tools-py/make_bodysuit_layers.py assets-src/base/source/standing_avatar_transparent.png assets-src/base
의존성: pip install numpy scipy opencv-python-headless pillow
"""
import sys
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
W, H = 899, 1536
X0 = 54  # 원본에서 잘라 올 왼쪽 x (그림 범위 90~917 이 모두 들어감)
Y0, Y1 = 430, 500  # 앞머리 레이어가 나타나기 시작/완전해지는 높이

rgba = np.array(Image.open(src).convert('RGBA'))
body = rgba[:, X0:X0 + W].copy()
assert body.shape[:2] == (H, W), body.shape
Image.fromarray(body).save(f'{out}/body.png')
Image.fromarray(body).save(f'{out}/body_barefoot.png')

rgb = body[:, :, :3].astype(np.float32)
alpha = body[:, :, 3]
lum = rgb @ np.array([0.299, 0.587, 0.114])
dark = (lum < 100) & ((rgb[:, :, 0] - rgb[:, :, 2]) < 40) & (alpha > 128)
dark = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)).astype(bool)
dark[700:, :] = False
lab, n = ndi.label(dark)
sizes = ndi.sum(dark, lab, range(1, n + 1))
hair = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 6000]).astype(np.uint8)
hair = cv2.morphologyEx(hair, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
hair = cv2.dilate(hair, np.ones((3, 3), np.uint8)).astype(np.float32) * (alpha > 8)
ramp = np.clip((np.arange(H) - Y0) / (Y1 - Y0), 0, 1)[:, None]
hm = cv2.GaussianBlur(hair, (0, 0), 1.0) * ramp
front = np.dstack([body[:, :, :3], (alpha * hm).astype(np.uint8)])
Image.fromarray(front).save(f'{out}/hair_front.png')
print('ok', body.shape, 'hair px', int((hm > 0.5).sum()))
