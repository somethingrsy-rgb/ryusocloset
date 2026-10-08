"""851x1280 투명 아바타에서 합성용 레이어를 만든다.

  body.png          원본 그대로 (머리 + 몸 + 슬리퍼)
  body_barefoot.png 슬리퍼를 지운 몸 (신발 착용 시 사용, CUT 행 아래를 투명 처리)
  hair_front.png    어깨 앞으로 내려온 머리카락만 (옷 위에 한 번 더 덮는 레이어)

사용: python tools-py/make_avatar_layers.py <avatar_851x1280.png> <출력 폴더>
주의: Y0/Y1(앞머리 시작 높이), CUT(슬리퍼 제거 높이), 밝기/색 임계값은 이 아바타 기준 값이다.
      머리 모양이 달라지면 hair_front.png 를 직접 그려서 assets-src/base/ 에 넣어도 된다.
"""
import sys, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
src, outdir = sys.argv[1], sys.argv[2]
av = Image.open(src).convert('RGBA')
a = np.array(av).astype(np.float32)
rgb, alpha = a[:, :, :3], a[:, :, 3]
lum = rgb @ np.array([0.299, 0.587, 0.114])
H, W = alpha.shape
# --- hair mask: big dark connected component(s), no eyes (small islands inside face)
R, B = rgb[:, :, 0], rgb[:, :, 2]
dark = (lum < 95) & ((R - B) < 35) & (alpha > 128)
dark = cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8)).astype(bool)
dark[760:, :] = False
lab, n = ndi.label(dark)
sizes = ndi.sum(dark, lab, range(1, n + 1))
keep = [i + 1 for i, s in enumerate(sizes) if s > 6000]
hair = np.isin(lab, keep)
hair = cv2.morphologyEx(hair.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
hair = cv2.dilate(hair, np.ones((3, 3), np.uint8)).astype(np.float32)
hair = hair * (alpha > 8)
# only the part that can overlap clothes (below the ear line); fade in
Y0, Y1 = 430, 500
ramp = np.clip((np.arange(H) - Y0) / (Y1 - Y0), 0, 1)[:, None]
hm = cv2.GaussianBlur(hair, (0, 0), 1.0) * ramp
hf = np.dstack([rgb, alpha * hm]).astype(np.uint8)
Image.fromarray(hf).save(f'{outdir}/hair_front.png')
# --- barefoot body: remove slippers (rows below leg cut), keep legs
bf = np.array(av).copy()
CUT = 1192
bf[CUT:, :, 3] = 0
Image.fromarray(bf).save(f'{outdir}/body_barefoot.png')
av.save(f'{outdir}/body.png')
print('ok', hm.max(), (hm > 0.5).sum())
