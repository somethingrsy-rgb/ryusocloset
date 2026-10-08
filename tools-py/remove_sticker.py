"""스티커 테두리(흰 띠 + 회색 재단선)를 제거해 투명 PNG 로 만든다. 캔버스는 자르지 않는다.

사용: python tools-py/remove_sticker.py <입력.png> <출력.png>
의존성: pip install numpy scipy opencv-python-headless
"""
import sys, numpy as np, cv2
from scipy import ndimage as ndi
src, out = sys.argv[1], sys.argv[2]
bgr = cv2.imread(src, cv2.IMREAD_COLOR)
rgb = bgr[:, :, ::-1].astype(int)
mx, mn = rgb.max(2), rgb.min(2)
# "sticker-ish": bright and nearly colorless (white band + gray cut line)
light = (mn > 170) & ((mx - mn) < 22)
# connected to image border through light pixels -> outside + sticker band
lab, n = ndi.label(light)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
outside = np.isin(lab, list(border))
char = ~outside
# keep largest component, fill holes
lab2, n2 = ndi.label(char)
sizes = ndi.sum(char, lab2, range(1, n2 + 1))
char = lab2 == (1 + int(np.argmax(sizes)))
char = ndi.binary_fill_holes(char)
# smooth edge, shrink 1px to kill halo
m = char.astype(np.uint8) * 255
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
m = cv2.erode(m, np.ones((3, 3), np.uint8), iterations=1)
m = cv2.GaussianBlur(m, (0, 0), 1.2)
rgba = np.dstack([bgr[:, :, ::-1], m]).astype(np.uint8)
ys, xs = np.where(m > 8)
cv2.imwrite(out, rgba[:, :, [2, 1, 0, 3]])
print(rgba.shape)
