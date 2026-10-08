import sharp from 'sharp'

export interface Box { left: number; top: number; width: number; height: number }

/** 알파가 threshold 보다 큰 픽셀의 경계 상자 */
export async function alphaBBox(file: string | Buffer, threshold = 16): Promise<Box> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { left: 0, top: 0, width: info.width, height: info.height }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/** 투명 여백을 자른 뒤 10% 여백을 둔 정사각형 webp 썸네일 */
export async function makeThumb(file: string | Buffer, out: string, size = 256, threshold = 16) {
  const box = await alphaBBox(file, threshold)
  const pad = Math.round(Math.max(box.width, box.height) * 0.1)
  const side = Math.max(box.width, box.height) + pad * 2
  const cropped = await sharp(file).extract(box).toBuffer()
  // sharp 는 resize 를 composite 보다 먼저 적용하므로, 정사각형 캔버스를 먼저 만든 뒤 따로 축소한다.
  const square = await sharp({
    create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: cropped, left: Math.round((side - box.width) / 2), top: Math.round((side - box.height) / 2) }])
    .png()
    .toBuffer()
  await sharp(square).resize(size, size).webp({ quality: 88, alphaQuality: 100 }).toFile(out)
}
