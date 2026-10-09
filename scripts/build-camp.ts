/**
 * assets-src/camp → public/assets/camp (webp, 썸네일) + src/data/camp-items.json
 *
 *   assets-src/camp/wall_day.(png|webp)    낮 배경 1086×1448 (아래쪽은 투명해도 됨 — 잔디가 깔린다)
 *   assets-src/camp/wall_night.(png|webp)  밤 배경
 *   assets-src/camp/floor.(png|webp)       잔디 바닥 (가로로 긴 이미지, 방 폭에 맞춰 축소됨)
 *   assets-src/camp/items/camp_<name>.(png|webp)   캠핑 용품
 *   scripts/camp-items.json                용품 이름, 기본 크기(baseWidth), 기본 위치(x, y)
 *
 * 내 방과 같은 구조라서 캠핑 용품도 같은 방식(group: 'camp')으로 놓고 옮긴다.
 * npm run assets 가 호출한다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { alphaBBox, makeThumb } from './lib/image.ts'
import { CAMP_FLOOR_H, ROOM_H, ROOM_W, type RoomItemDef } from '../src/lib/roomTypes.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'assets-src/camp')
const OUT = path.join(ROOT, 'public/assets/camp')
const IMG = /\.(png|webp)$/i

type Meta = Record<string, { ko?: string; en?: string; baseWidth?: number; x?: number; y?: number }>

function findSource(base: string): string {
  for (const ext of ['png', 'webp']) {
    const f = `${base}.${ext}`
    if (fs.existsSync(f)) return f
  }
  throw new Error(`없음: ${base}.(png|webp)`)
}

export async function buildCamp() {
  if (!fs.existsSync(SRC)) return
  const meta: Meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/camp-items.json'), 'utf8'))
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT, 'thumbs'), { recursive: true })

  for (const name of ['wall_day', 'wall_night']) {
    const src = findSource(path.join(SRC, name))
    const m = await sharp(src).metadata()
    if (Math.abs(m.width! / m.height! - ROOM_W / ROOM_H) > 0.01) console.warn(`⚠ ${name}: ${m.width}x${m.height} (가로세로 비율이 ${ROOM_W}:${ROOM_H} 와 달라요)`)
    // 받은 그림이 작아도(예: 576×768) 방 크기에 맞춰 늘린다
    await sharp(src).resize(ROOM_W, ROOM_H, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `${name}.webp`))
  }
  await sharp(findSource(path.join(SRC, 'floor')))
    .resize(ROOM_W, CAMP_FLOOR_H, { fit: 'fill' })
    .webp({ quality: 88 })
    .toFile(path.join(OUT, 'floor.webp'))

  const defs: RoomItemDef[] = []
  const files = fs.readdirSync(path.join(SRC, 'items')).filter((f) => IMG.test(f)).sort()
  for (const file of files) {
    const id = file.replace(IMG, '')
    const src = path.join(SRC, 'items', file)
    const box = await alphaBBox(src, 8)
    await sharp(src).extract(box).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(OUT, `${id}.webp`))
    await makeThumb(src, path.join(OUT, 'thumbs', `${id}.webp`), 256, 8)
    const m = meta[id] ?? (console.warn(`ℹ ${id}: scripts/camp-items.json 에 없음 → 기본값`), {})
    const words = id.split('_').slice(1).join(' ')
    defs.push({
      id,
      group: 'camp',
      name: { ko: m.ko ?? words, en: m.en ?? words },
      image: `assets/camp/${id}.webp`,
      thumb: `assets/camp/thumbs/${id}.webp`,
      w: box.width,
      h: box.height,
      baseWidth: m.baseWidth ?? 300,
      x: m.x ?? ROOM_W / 2,
      y: m.y ?? 1300,
    })
  }
  // 파일 순서가 아니라 camp-items.json 에 적은 순서대로 보여 준다 (적지 않은 것은 뒤로)
  const order = Object.keys(meta)
  defs.sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99))
  fs.writeFileSync(path.join(ROOT, 'src/data/camp-items.json'), JSON.stringify(defs, null, 2) + '\n')
  console.log(`✔ 캠핑 용품 ${defs.length}개`)
}
