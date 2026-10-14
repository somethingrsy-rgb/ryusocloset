"""아바타 몸을 기준 아바타(유하)의 몸에 세로로 맞춘다. 옷이 같은 자리에 오게 하려는 것.

  python tools-py/align_body.py <아바타 폴더> [기준 body.png]     (기본 기준: assets-src/base/yuha/body.png)

1) 가로 띠(높이 120)마다 기준 몸과의 세로 어긋남을 위상 상관으로 잰다 (가슴·허리·다리 선이 기준)
2) 어긋남을 부드럽게 이어서 세로로만 옮긴다 (머리는 그대로, 목 아래부터 서서히)
3) source/standing_avatar_transparent.png 를 덮어쓰고 body·hair_front 레이어를 다시 만든다 (두세 번 돌리면 더 가까워진다)
의존성: pip install numpy opencv-python-headless pillow scipy
"""
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image

d = sys.argv[1].rstrip('/')
ref_path = sys.argv[2] if len(sys.argv) > 2 else 'assets-src/base/yuha/body.png'


def gray(im):
    a = np.array(im.convert('RGBA')).astype(np.float32)
    al = a[..., 3:4] / 255
    return cv2.cvtColor((a[..., :3] * al + 255 * (1 - al)).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)


src = Image.open(f'{d}/source/standing_avatar_transparent.png').convert('RGBA')
H, W = src.height, src.width
ref = gray(Image.open(ref_path))
cur = gray(src)
win = cv2.createHanningWindow((380, 120), cv2.CV_32F)
ys, dys = [], []
for y0 in range(560, min(1500, H - 120) + 1, 40):
    (dx, dy), resp = cv2.phaseCorrelate(ref[y0:y0 + 120, 320:700], cur[y0:y0 + 120, 320:700], win)
    if resp > 0.3 and abs(dy) < 20:
        ys.append(y0 + 60)
        dys.append(dy)
dys = np.array(dys)
sm = np.convolve(np.pad(dys, 1, mode='edge'), np.ones(3) / 3, mode='valid')  # 이웃과 섞어 들쭉날쭉한 값을 눌러 준다
print('어긋남(px):', {int(y): round(float(v), 1) for y, v in zip(ys, sm)})
# 이 그림의 y 에 있는 것을 y - dy 로 옮기면 기준과 겹친다. 머리(~520 위)는 0 으로 서서히
nodes_y = np.array([0, 520] + ys + [H - 1], np.float32)
nodes_d = np.array([0, 0] + list(sm) + [0], np.float32)
yy = np.arange(H, dtype=np.float32)
shift = np.interp(yy, nodes_y, nodes_d)  # 목표 y 에서 가져올 위치 = y + shift
map_y = (yy + shift).astype(np.float32)[:, None].repeat(W, axis=1)
map_x = np.arange(W, dtype=np.float32)[None, :].repeat(H, axis=0)
arr = np.array(src).astype(np.float32)
arr[..., :3] *= arr[..., 3:4] / 255.0
arr = cv2.remap(arr, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
a_ = arr[..., 3:4]
arr[..., :3] = np.where(a_ > 0, arr[..., :3] / np.maximum(a_, 1) * 255.0, 0)
Image.fromarray(np.clip(np.nan_to_num(arr), 0, 255).astype(np.uint8), 'RGBA').save(f'{d}/source/standing_avatar_transparent.png')
subprocess.run([sys.executable, '-I', 'tools-py/make_bodysuit_layers.py', f'{d}/source/standing_avatar_transparent.png', d], check=True)
