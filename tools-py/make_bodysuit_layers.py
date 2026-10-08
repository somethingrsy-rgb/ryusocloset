"""속옷 차림 아바타 원본(투명 PNG)에서 body.png / body_barefoot.png 를 만든다.

원본: assets-src/base/source/bodysuit_avatar_transparent.png (959×1639)
옷 PNG 는 이 원본을 899×1536 으로 줄인 크기를 기준으로 그려져 있어서(같은 비율, 이동 없음),
아바타도 단순히 899×1536 으로 줄이면 옷이 (0,0) 에서 그대로 맞는다.

처리:
1) 알파가 252~253 으로 조금 비쳐 있어서 255 로 늘린다 (가장자리 안티앨리어싱은 유지).
2) 899×1536 으로 축소 → body.png
3) body_barefoot.png: 슬리퍼를 지운 몸 (CUT 행 아래를 투명 처리 — 신발이 그 위를 덮는다)

앞머리 레이어(hair_front.png)는 이 스크립트로 만들지 않는다. 이전 앞머리 레이어를
같은 몸 위치에 맞춰 899×1536 으로 옮긴 파일을 그대로 쓴다.

사용: python tools-py/make_bodysuit_layers.py assets-src/base/source/bodysuit_avatar_transparent.png assets-src/base
의존성: pip install numpy opencv-python-headless pillow
"""
import sys
import cv2
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
W, H = 899, 1536
CUT = 1435  # 슬리퍼가 시작되는 행 (캔버스 좌표)

rgba = np.array(Image.open(src).convert('RGBA'))
rgba[:, :, 3] = np.clip(rgba[:, :, 3].astype(np.float32) * 255 / 253, 0, 255).astype(np.uint8)
body = cv2.resize(rgba, (W, H), interpolation=cv2.INTER_AREA)
Image.fromarray(body).save(f'{out}/body.png')
bare = body.copy()
bare[CUT:, :, 3] = 0
Image.fromarray(bare).save(f'{out}/body_barefoot.png')
print('ok', body.shape)
