/** PWA 아이콘 생성: assets-src/icon/icon-source.jpg (얼굴이 나온 정사각형 캡처)를 잘라서 만든다. (npm run assets 에 포함) */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/icons')
const SOURCE = path.join(ROOT, 'assets-src/icon/icon-source.jpg')
/** 원본에서 얼굴·머리·리본이 들어오는 정사각형 영역 */
const CROP = { left: 60, top: 55, width: 660, height: 660 }

async function icon(file: string, size: number, faceRatio: number) {
  const head = await sharp(SOURCE).extract(CROP).toBuffer()
  // 원본 배경색(분홍)을 왼쪽 가장자리에서 읽어서, 마스크용 여백도 같은 색으로 채운다
  const [r, g, b] = await sharp(SOURCE).extract({ left: 40, top: 400, width: 1, height: 1 }).raw().toBuffer()
  const face = Math.round(size * faceRatio)
  const faceBuf = await sharp(head).resize(face, face).toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: { r, g, b, alpha: 1 } } })
    .composite([{ input: faceBuf, left: Math.round((size - face) / 2), top: Math.round((size - face) / 2) }])
    .png()
    .toFile(path.join(OUT, file))
}

fs.mkdirSync(OUT, { recursive: true })
await icon('icon-192.png', 192, 1)
await icon('icon-512.png', 512, 1)
await icon('maskable-512.png', 512, 0.78) // 마스크 안전 영역(80%) 안에 들어오게
await icon('apple-touch-icon.png', 180, 1)
console.log('✔ icons')
