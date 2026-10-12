import { ROOM_H, ROOM_W } from './roomTypes'
export interface RoomExportViewport { left: number; top: number; width: number; height: number }
export function roomExportBounds(items: { left: number; top: number; w: number; h: number }[], viewport?: RoomExportViewport) {
  const views = [{ left: 0, top: 0, w: ROOM_W, h: ROOM_H }, ...items]
  if (viewport && Object.values(viewport).every(Number.isFinite) && viewport.width > 0 && viewport.height > 0) views.push({ left: viewport.left, top: viewport.top, w: viewport.width, h: viewport.height })
  const left = Math.floor(Math.min(...views.map(d => d.left)))
  const top = Math.floor(Math.min(...views.map(d => d.top)))
  const width = Math.ceil(Math.max(...views.map(d => d.left + d.w))) - left
  const height = Math.ceil(Math.max(...views.map(d => d.top + d.h))) - top
  // Keep the complete view within mobile canvas memory limits.
  const scale = Math.min(1, 4096 / Math.max(width, height), Math.sqrt(12_000_000 / (width * height)))
  return { left, top, width, height, scale }
}
