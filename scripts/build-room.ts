/**
 * assets-src/room → public/assets/room (webp, 썸네일) + src/data/room-items.json
 *
 *   assets-src/room/wall.(png|webp)    벽지 1086×1448 (아래쪽 바닥 부분은 투명)
 *   assets-src/room/floor.(png|webp)   바닥 (가로로 긴 판자 이미지, 방 폭에 맞춰 축소됨)
 *   assets-src/room/items/<group>_<name>.(png|webp)
 *       group: furniture(가구) | rug(러그) | wall(벽 장식) | light(조명 효과)
 *   assets-src/room/svg/*.svg          대체 이미지(벽지·바닥 등 SVG) — public/assets/room 으로 그대로 복사
 *   src/data/room-items.json           가격·슬롯·세트·해금 등 게임 설정. 이 스크립트는 이미지 정보만 갱신하고 나머지는 보존
 *   scripts/room-items.json            새 아이템의 이름, 기본 크기(baseWidth), 기본 위치(x, y). 없으면 기본값 사용
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
  if (wm.width !== ROOM_W || wm.height !== ROOM_H) {
    console.warn(`⚠ wall: ${wm.width}x${wm.height} (기대: ${ROOM_W}x${ROOM_H})`)
  }
  await sharp(wallSrc).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(OUT, 'wall.webp'))
  await sharp(findSource(path.join(SRC, 'floor')))
    .resize(ROOM_W, FLOOR_H, { fit: 'fill' })
    .webp({ quality: 90 })
    .toFile(path.join(OUT, 'floor.webp'))

  // 가구·소품
  const files = fs.readdirSync(path.join(SRC, 'items')).filter((f) => IMG.test(f)).sort()
  // src/data/room-items.json 은 이미지 정보(크기·썸네일)와 별도로 가격·슬롯·세트·해금 같은 게임 설정을 담는다.
  // 그래서 덮어쓰지 않고, 에셋 폴더에서 측정한 값만 갱신하며 나머지 필드는 그대로 보존한다.
  const dataFile = path.join(ROOT, 'src/data/room-items.json')
  const existing: RoomItemDef[] = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : []
  const byId = new Map(existing.map((d) => [d.id, d]))
  const measured = new Map<string, Pick<RoomItemDef, 'image' | 'thumb' | 'w' | 'h' | 'group'>>()
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
    measured.set(id, { group, image: `assets/room/${id}.webp`, thumb: `assets/room/thumbs/${id}.webp`, w: box.width, h: box.height })
  }

  // 기존 항목: 측정값만 갱신 (SVG 같은 에셋 폴더 밖 항목은 그대로)
  const defs: RoomItemDef[] = existing.map((d) => ({ ...d, ...measured.get(d.id) }))
  // 새 항목: scripts/room-items.json 의 이름·크기·위치와 기본 게임 설정으로 만든다 (가격·슬롯은 room-items.json 에서 고치세요)
  const CATEGORY: Record<RoomGroup, RoomItemDef['category']> = {
    furniture: 'furniture', rug: 'props', wall: 'wall', light: 'lighting', wallpaper: 'wallpaper', floor: 'floor',
  }
  const Z: Record<RoomGroup, number> = { furniture: 2000, rug: 4000, wall: 1000, light: 5000, wallpaper: 0, floor: 0 }
  for (const [id, m] of measured) {
    if (byId.has(id)) continue
    const mm = meta[id] ?? (console.warn(`ℹ ${id}: 새 방 아이템 → 기본 가격·크기 사용 (src/data/room-items.json 에서 조정)`), {})
    const words = id.split('_').slice(1).join(' ')
    const baseWidth = mm.baseWidth ?? 400
    defs.push({
      id,
      group: m.group,
      name: { ko: mm.ko ?? words, en: mm.en ?? words },
      image: m.image,
      thumb: m.thumb,
      w: m.w,
      h: m.h,
      baseWidth,
      x: mm.x ?? ROOM_W / 2,
      y: mm.y ?? 1240,
      category: CATEGORY[m.group],
      price: 50,
      size: { width: baseWidth, height: Math.round((baseWidth * m.h) / m.w) },
      anchor: 'bottom-center',
      zIndex: Z[m.group],
      setId: null,
      unlock: null,
    })
  }

  // 대체 이미지(SVG): 에셋이 없는 방 아이템용
  const svgDir = path.join(SRC, 'svg')
  if (fs.existsSync(svgDir)) for (const f of fs.readdirSync(svgDir)) fs.copyFileSync(path.join(svgDir, f), path.join(OUT, f))

  fs.writeFileSync(dataFile, JSON.stringify(defs, null, 2) + '\n')
  console.log(`✔ 방 아이템 ${defs.length}개 (이미지 ${measured.size}개 갱신)`)
}
