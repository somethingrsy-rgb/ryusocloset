/** PWA 아이콘 생성: 아바타 얼굴을 파스텔 배경 위에 올린다. (npm run assets 에 포함) */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/icons')
const BG = { r: 255, g: 227, b: 236, alpha: 1 }

async function icon(file: string, size: number, faceRatio: number) {
  const full = path.join(ROOT, 'assets-src/base/body.png')
  const head = await sharp(full).extract({ left: 20, top: 10, width: 860, height: 860 }).toBuffer()
  const face = Math.round(size * faceRatio)
  const faceBuf = await sharp(head).resize(face, face).toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: faceBuf, left: Math.round((size - face) / 2), top: Math.round((size - face) / 2) }])
    .png()
    .toFile(path.join(OUT, file))
}

fs.mkdirSync(OUT, { recursive: true })
await icon('icon-192.png', 192, 0.92)
await icon('icon-512.png', 512, 0.92)
await icon('maskable-512.png', 512, 0.66) // 마스크 안전 영역(80%) 안에 들어오게
await icon('apple-touch-icon.png', 180, 0.86)
console.log('✔ icons')
