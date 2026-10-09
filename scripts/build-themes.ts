/**
 * assets-src/themes → public/assets/themes (webp, 썸네일) + src/data/themes.json + src/data/theme-items.json
 *
 *   assets-src/themes/<id>/wall.png            벽지 배경 (가로세로 비율 1086:1448, 아래쪽은 투명해도 됨)
 *   assets-src/themes/<id>/floor.png           바닥 (가로로 긴 이미지, 방 폭에 맞춰 늘어남)
 *   assets-src/themes/<id>/items/theme_<id>_<name>.png   테마 소품
 *   scripts/themes.json                        테마 목록 (id, 이름, 아이콘)
 *   scripts/theme-items.json                   소품 이름·그룹·기본 크기·위치
 *
 * 내 방의 '배경' 탭에서 벽과 바닥을 따로 고르고(기본 + 각 테마의 벽지·바닥), '테마' 탭에서는 그 테마의 소품을 놓는다. npm run assets 가 호출한다.
 * floorH 는 그 벽지가 끝나는 높이에 맞춘 바닥 높이(논리 px)다. 어떤 벽에 어떤 바닥을 골라도 이어 붙도록 화면에서 바닥을 이 높이로 늘린다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { alphaBBox, makeThumb } from './lib/image.ts'
import { FLOOR_H, ROOM_H, ROOM_W, type RoomGroup, type RoomItemDef } from '../src/lib/roomTypes.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'assets-src/themes')
const OUT = path.join(ROOT, 'public/assets/themes')
const IMG = /\.(png|webp)$/i
const MAX_SIDE = 640

type Meta = Record<string, { ko?: string; en?: string; theme: string; group?: RoomGroup; baseWidth?: number; x?: number; y?: number }>

export async function buildThemes() {
  if (!fs.existsSync(SRC)) return
  const list: { id: string; ko: string; en: string; icon: string }[] = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/themes.json'), 'utf8'))
  const meta: Meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/theme-items.json'), 'utf8'))
  fs.rmSync(OUT, { recursive: true, force: true })

  const themes = []
  const defs: RoomItemDef[] = []
  for (const th of list) {
    const dir = path.join(SRC, th.id)
    const out = path.join(OUT, th.id)
    fs.mkdirSync(path.join(out, 'thumbs'), { recursive: true })
    const wall = path.join(dir, 'wall.png')
    const wm = await sharp(wall).metadata()
    if (Math.abs(wm.width! / wm.height! - ROOM_W / ROOM_H) > 0.01) console.warn(`⚠ ${th.id}/wall: ${wm.width}x${wm.height} (비율이 ${ROOM_W}:${ROOM_H} 와 달라요)`)
    await sharp(wall).resize(ROOM_W, ROOM_H, { fit: 'fill', kernel: 'lanczos3' }).webp({ quality: 82, alphaQuality: 100 }).toFile(path.join(out, 'wall.webp'))
    // 벽지가 끝나는 높이(원본 기준)를 방 높이로 바꿔서, 그보다 조금 위부터 바닥을 깐다
    const box = await alphaBBox(wall, 8)
    const wallBottom = Math.round(((box.top + box.height) / wm.height!) * ROOM_H)
    const floorH = Math.min(ROOM_H, ROOM_H - wallBottom + 30)
    // 바닥은 기본 높이로 저장해 두고, 화면에서 고른 벽지가 끝나는 높이(floorH)에 맞춰 늘린다 (벽과 바닥을 따로 고르므로)
    await sharp(path.join(dir, 'floor.png')).resize(ROOM_W, FLOOR_H, { fit: 'fill' }).webp({ quality: 86 }).toFile(path.join(out, 'floor.webp'))
    // 고르는 화면용 작은 그림
    await sharp(wall).resize(180, Math.round((180 * ROOM_H) / ROOM_W), { fit: 'fill' }).webp({ quality: 80 }).toFile(path.join(out, 'wall_thumb.webp'))
    await sharp(path.join(dir, 'floor.png')).resize(180, 90, { fit: 'fill' }).webp({ quality: 80 }).toFile(path.join(out, 'floor_thumb.webp'))
    themes.push({ ...th, floorH })

    const itemsDir = path.join(dir, 'items')
    for (const file of fs.readdirSync(itemsDir).filter((f) => IMG.test(f)).sort()) {
      const id = file.replace(IMG, '')
      const src = path.join(itemsDir, file)
      const m = meta[id] ?? (console.warn(`ℹ ${id}: scripts/theme-items.json 에 없음 → 기본값`), { theme: th.id })
      const b = await alphaBBox(src, 8)
      // 화면에서는 300px 안팎으로 쓰이므로 긴 변을 640px 로 줄여서 용량을 아낀다
      const scale = Math.min(1, MAX_SIDE / Math.max(b.width, b.height))
      const w = Math.round(b.width * scale)
      const h = Math.round(b.height * scale)
      await sharp(src).extract(b).resize(w, h, { kernel: 'lanczos3' }).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(out, `${id}.webp`))
      await makeThumb(src, path.join(out, 'thumbs', `${id}.webp`), 256, 8)
      const words = id.split('_').slice(2).join(' ')
      defs.push({
        id,
        group: m.group ?? 'furniture',
        theme: th.id,
        name: { ko: m.ko ?? words, en: m.en ?? words },
        image: `assets/themes/${th.id}/${id}.webp`,
        thumb: `assets/themes/${th.id}/thumbs/${id}.webp`,
        w,
        h,
        baseWidth: m.baseWidth ?? 280,
        x: m.x ?? ROOM_W / 2,
        y: m.y ?? 1300,
      })
    }
  }
  fs.writeFileSync(path.join(ROOT, 'src/data/themes.json'), JSON.stringify(themes, null, 2) + '\n')
  fs.writeFileSync(path.join(ROOT, 'src/data/theme-items.json'), JSON.stringify(defs, null, 2) + '\n')
  console.log(`✔ 테마 ${themes.length}개, 테마 소품 ${defs.length}개`)
}
