import { renderFigure, loadImage } from './exportPng'
import { assetUrl } from './items'
import { drawables, hasContactShadow, shadowWidthRatio } from './room'
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
export const sceneAssets = (scene: 'room' | 'camp', night = false): SceneAssets =>
  scene === 'camp' ? { wall: night ? CAMP_ASSETS.night : CAMP_ASSETS.day, floor: CAMP_ASSETS.floor, floorH: CAMP_FLOOR_H } : ROOM_ASSETS

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
): Promise<HTMLCanvasElement> {
  const list = drawables(room)
  const assets = sceneAssets(scene, room.night)
  const [floor, wall, figure, ...imgs] = await Promise.all([
    loadImage(assets.floor),
    loadImage(assets.wall),
    renderFigure(outfit, tweaks),
    ...list.map((d) => (d.src ? loadImage(assetUrl(d.src)) : Promise.resolve(null))),
  ])
  const canvas = document.createElement('canvas')
  canvas.width = ROOM_W
  canvas.height = ROOM_H
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(floor, 0, ROOM_H - assets.floorH, ROOM_W, assets.floorH)
  ctx.drawImage(wall, 0, 0, ROOM_W, ROOM_H)
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
