/**
 * assets-src/room → public/assets/room (webp, 썸네일) + src/data/room-items.json
 *
 *   assets-src/room/wall.(png|webp)    벽지 1086×1448 (아래쪽 바닥 부분은 투명)
 *   assets-src/room/floor.(png|webp)   바닥 (가로로 긴 판자 이미지, 방 폭에 맞춰 축소됨)
 *   assets-src/room/items/<group>_<name>.(png|webp)
 *       group: furniture(가구) | rug(러그) | wall(벽 장식) | light(조명 효과)
 *   scripts/room-items.json            id → 이름, 기본 크기(baseWidth), 기본 위치(x, y). 없으면 기본값 사용
 *
 * 실행: npm run assets
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { alphaBBox, makeThumb } from './lib/image.ts'
import { FLOOR_H, ROOM_H, ROOM_W, type RoomGroup, type RoomItemDef } from '../src/lib/roomTypes.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'assets-src/room')
const OUT = path.join(ROOT, 'public/assets/room')
const GROUPS: RoomGroup[] = ['furniture', 'rug', 'wall', 'light']
const IMG = /\.(png|webp)$/i

type Meta = Record<string, { ko?: string; en?: string; baseWidth?: number; x?: number; y?: number }>
const meta: Meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/room-items.json'), 'utf8'))

function findSource(base: string): string {
  for (const ext of ['png', 'webp']) {
    const f = `${base}.${ext}`
    if (fs.existsSync(f)) return f
  }
  throw new Error(`없음: ${base}.(png|webp)`)
}

export async function buildRoom() {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT, 'thumbs'), { recursive: true })

  // 벽지 / 바닥
  const wallSrc = findSource(path.join(SRC, 'wall'))
  const wm = await sharp(wallSrc).metadata()
  if (Math.abs(wm.width! / wm.height! - ROOM_W / ROOM_H) > 0.01) {
    console.warn(`⚠ wall: ${wm.width}x${wm.height} (가로세로 비율이 ${ROOM_W}:${ROOM_H} 와 달라요)`)
  }
  // 받은 그림이 작아도(예: 728×970) 방 크기에 맞춰 늘린다
  await sharp(wallSrc)
    .resize(ROOM_W, ROOM_H, { fit: 'fill', kernel: 'lanczos3' })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(path.join(OUT, 'wall.webp'))
  await sharp(findSource(path.join(SRC, 'floor')))
    .resize(ROOM_W, FLOOR_H, { fit: 'fill' })
    .webp({ quality: 90 })
    .toFile(path.join(OUT, 'floor.webp'))

  // 가구·소품
  const files = fs.readdirSync(path.join(SRC, 'items')).filter((f) => IMG.test(f)).sort()
  const defs: RoomItemDef[] = []
  for (const file of files) {
    const id = file.replace(IMG, '')
    const group = id.split('_')[0] as RoomGroup
    if (!GROUPS.includes(group)) {
      throw new Error(`그룹을 알 수 없는 파일명: ${file} (furniture_/rug_/wall_/light_ 로 시작해야 함)`)
    }
    const src = path.join(SRC, 'items', file)
    const threshold = group === 'light' ? 2 : 8 // 은은한 빛은 낮은 임계값으로 잘라야 번짐이 안 잘림
    const box = await alphaBBox(src, threshold)
    await sharp(src).extract(box).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(OUT, `${id}.webp`))
    await makeThumb(src, path.join(OUT, 'thumbs', `${id}.webp`), 256, threshold)
    const m = meta[id] ?? (console.warn(`ℹ room-items.json 에 ${id} 없음 → 기본값 사용`), {})
    const words = id.split('_').slice(1).join(' ')
    defs.push({
      id,
      group,
      name: { ko: m.ko ?? words, en: m.en ?? words },
      image: `assets/room/${id}.webp`,
      thumb: `assets/room/thumbs/${id}.webp`,
      w: box.width,
      h: box.height,
      baseWidth: m.baseWidth ?? 400,
      x: m.x ?? ROOM_W / 2,
      y: m.y ?? 1240,
    })
  }
  defs.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.id.localeCompare(b.id))
  fs.writeFileSync(path.join(ROOT, 'src/data/room-items.json'), JSON.stringify(defs, null, 2) + '\n')
  console.log(`✔ 방 아이템 ${defs.length}개`, Object.fromEntries(GROUPS.map((g) => [g, defs.filter((d) => d.group === g).length])))
}
