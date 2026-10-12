import { roomExportBounds, type RoomExportViewport } from './roomExportBounds'
import { renderFigure, loadImage } from './exportPng'
import { assetUrl } from './items'
import { ROOM_THEME_BY_ID, drawables, hasContactShadow, shadowWidthRatio } from './room'
import { CAMP_FLOOR_H, FLOOR_H, ROOM_H, ROOM_W, type RoomState } from './roomTypes'
import type { Outfit, Tweaks } from './types'

export interface SceneAssets {
  wall: string
  floor: string
  /** 바닥 이미지의 높이 (논리 px) */
  floorH: number
}

export const ROOM_ASSETS: SceneAssets = {
  wall: assetUrl('assets/room/wall.webp'),
  floor: assetUrl('assets/room/floor.webp'),
  floorH: FLOOR_H,
}

/** 캠핑 탭의 낮/밤 배경과 잔디 */
export const CAMP_ASSETS = {
  day: assetUrl('assets/camp/wall_day.webp'),
  night: assetUrl('assets/camp/wall_night.webp'),
  floor: assetUrl('assets/camp/floor.webp'),
}

/** 방 또는 캠핑장의 벽(배경)·바닥 이미지 */
export function sceneAssets(scene: 'room' | 'camp', night = false, wallId?: string, floorId?: string): SceneAssets {
  if (scene === 'camp') return { wall: night ? CAMP_ASSETS.night : CAMP_ASSETS.day, floor: CAMP_ASSETS.floor, floorH: CAMP_FLOOR_H }
  // 벽과 바닥은 따로 고른다. 바닥이 깔리기 시작하는 높이는 고른 벽지가 끝나는 곳에 맞춘다
  const wall = wallId ? ROOM_THEME_BY_ID[wallId] : undefined
  const floor = floorId ? ROOM_THEME_BY_ID[floorId] : undefined
  return {
    wall: wallId === 'camp' ? (night ? CAMP_ASSETS.night : CAMP_ASSETS.day) : wall ? assetUrl(`assets/themes/${wall.id}/wall.webp`) : ROOM_ASSETS.wall,
    floor: floorId === 'camp' ? CAMP_ASSETS.floor : floor ? assetUrl(`assets/themes/${floor.id}/floor.webp`) : ROOM_ASSETS.floor,
    floorH: wall ? wall.floorH : ROOM_ASSETS.floorH,
  }
}

/** 바닥에 닿는 물건 아래의 은은한 타원 그림자 (화면의 CSS 그림자와 같은 모양) */
export function drawContactShadow(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number) {
  const rx = w / 2
  const ry = Math.max(10, w * 0.045)
  ctx.save()
  ctx.translate(cx, y - ry * 0.35)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, 'rgba(70,40,30,0.30)')
  g.addColorStop(1, 'rgba(70,40,30,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** 방 + 가구 + (옷 입은) 아바타를 1086×1448 PNG 로 합성 */
export async function renderRoomCanvas(
  room: RoomState,
  outfit: Outfit,
  tweaks: Tweaks = {},
  scene: 'room' | 'camp' = 'room',
  viewport?: RoomExportViewport,
): Promise<HTMLCanvasElement> {
  const list = drawables(room)
  const assets = sceneAssets(scene, room.night, room.wallId, room.floorId)
  const [floor, wall, figure, ...imgs] = await Promise.all([
    loadImage(assets.floor),
    loadImage(assets.wall),
    renderFigure(outfit, tweaks),
    ...list.map((d) => (d.src ? loadImage(assetUrl(d.src)) : Promise.resolve(null))),
  ])
  const bounds = roomExportBounds(list, viewport)
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(bounds.width * bounds.scale)
  canvas.height = Math.ceil(bounds.height * bounds.scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(bounds.scale, bounds.scale)
  ctx.translate(-bounds.left, -bounds.top)
  const first = Math.floor(bounds.left / ROOM_W)
  const last = Math.ceil((bounds.left + bounds.width) / ROOM_W) - 1
  for (let k = first; k <= last; k++) {
    ctx.save()
    ctx.translate(k * ROOM_W, 0)
    if (Math.abs(k) % 2) { ctx.translate(ROOM_W, 0); ctx.scale(-1, 1) }
    if (bounds.top < 0) ctx.drawImage(wall, 0, 0, wall.width, 1, 0, bounds.top, ROOM_W, -bounds.top)
    const bottom = bounds.top + bounds.height
    if (bottom > ROOM_H) ctx.drawImage(floor, 0, floor.height - 1, floor.width, 1, 0, ROOM_H, ROOM_W, bottom - ROOM_H)
    ctx.drawImage(floor, 0, ROOM_H - assets.floorH, ROOM_W, assets.floorH)
    ctx.drawImage(wall, 0, 0, ROOM_W, ROOM_H)
    ctx.restore()
  }
  list.forEach((d, i) => {
    if (hasContactShadow(d.group)) drawContactShadow(ctx, d.x, d.y, d.w * shadowWidthRatio(d.group))
    const img = d.group === 'avatar' ? figure : imgs[i]
    if (!img) return
    ctx.save()
    if (d.flip) {
      ctx.translate(d.left + d.w, d.top)
      ctx.scale(-1, 1)
      ctx.drawImage(img, 0, 0, d.w, d.h)
    } else {
      ctx.drawImage(img, d.left, d.top, d.w, d.h)
    }
    ctx.restore()
  })
  return canvas
}
