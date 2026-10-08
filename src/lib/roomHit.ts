import { drawables, type Drawable } from './room'
import type { RoomState, Selection } from './roomTypes'

/** 알파 마스크(저해상도) — 투명한 부분을 눌렀을 때는 뒤에 있는 물건이 선택되게 한다 */
export interface Mask {
  w: number
  h: number
  data: Uint8Array
}

const ALPHA_MIN = 40

export function maskFromSource(src: CanvasImageSource, srcW: number, srcH: number, mw = 80): Mask {
  const mh = Math.max(1, Math.round((mw * srcH) / srcW))
  const c = document.createElement('canvas')
  c.width = mw
  c.height = mh
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, 0, 0, mw, mh)
  const px = ctx.getImageData(0, 0, mw, mh).data
  const data = new Uint8Array(mw * mh)
  for (let i = 0; i < data.length; i++) data[i] = px[i * 4 + 3]
  return { w: mw, h: mh, data }
}

function opaqueAt(m: Mask, u: number, v: number): boolean {
  const cx = Math.floor(u * m.w)
  const cy = Math.floor(v * m.h)
  // 손가락으로 누르기 쉽게 이웃 1칸까지 본다
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (x >= 0 && y >= 0 && x < m.w && y < m.h && m.data[y * m.w + x] > ALPHA_MIN) return true
    }
  }
  return false
}

function hits(d: Drawable, px: number, py: number, getMask: (key: string) => Mask | undefined): boolean {
  if (px < d.left || px > d.left + d.w || py < d.top || py > d.top + d.h) return false
  const m = getMask(d.key)
  if (!m) return true // 마스크가 아직 없으면 사각형 영역으로 판정
  let u = (px - d.left) / d.w
  const v = (py - d.top) / d.h
  if (d.flip) u = 1 - u
  return opaqueAt(m, u, v)
}

/** (px, py) 논리 좌표에서 가장 위에 있는 물건. 조명 효과는 다른 게 없을 때만 선택된다. */
export function hitTest(
  state: RoomState,
  px: number,
  py: number,
  getMask: (key: string) => Mask | undefined,
): Selection {
  const list = drawables(state).reverse() // 위에 있는 것부터
  for (const d of list) if (d.group !== 'light' && hits(d, px, py, getMask)) return d.sel
  for (const d of list) if (d.group === 'light' && hits(d, px, py, getMask)) return d.sel
  return null
}
