import { CUSTOM_PREFIX, ITEM_BY_ID, ITEMS, registerCustomItem, unregisterCustomItem } from './items'
import { CANVAS_H, CANVAS_W, LAYER_Z, type Category } from './layers'
import type { Item } from './types'

export const MAX_CUSTOM = 60
/** 올린 사진은 긴 변을 이 크기로 줄여서 쓴다 */
const MAX_SIDE = 1024
const THUMB = 256

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 카테고리별 기본 위치: 가운데 (cx, cy), 가로 폭 w, 세로 최대 maxH (캔버스 1024×1536 기준). 앱에서 끌고 늘려서 다시 맞출 수 있다. */
const PLACEMENT: Record<Category, { cx: number; cy: number; w: number; maxH: number }> = {
  top: { cx: 512, cy: 800, w: 520, maxH: 420 },
  bottom: { cx: 512, cy: 1130, w: 380, maxH: 560 },
  dress: { cx: 512, cy: 1000, w: 440, maxH: 760 },
  outer: { cx: 512, cy: 830, w: 620, maxH: 520 },
  shoes: { cx: 512, cy: 1485, w: 320, maxH: 120 },
  accessory: { cx: 512, cy: 230, w: 300, maxH: 250 },
  bag: { cx: 770, cy: 1050, w: 230, maxH: 300 },
}

/** 잘라낸 옷(가로 w × 세로 h)을 카테고리의 기본 자리에 놓을 때의 영역 */
export function defaultBox(category: Category, w: number, h: number): Rect {
  const p = PLACEMENT[category]
  const s = Math.min(p.w / w, p.maxH / h)
  const bw = Math.max(1, Math.round(w * s))
  const bh = Math.max(1, Math.round(h * s))
  return {
    x: Math.min(CANVAS_W - bw, Math.max(0, Math.round(p.cx - bw / 2))),
    y: Math.min(CANVAS_H - bh, Math.max(0, Math.round(p.cy - bh / 2))),
    w: bw,
    h: bh,
  }
}

const dist = (d: Uint8ClampedArray, i: number, r: number, g: number, b: number) =>
  Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b)

/**
 * 사진 배경 지우기: 네 모서리가 비슷한 색(흰 종이 등)이면, 가장자리에서 이어진 그 색만 투명하게 만든다.
 * 이미 투명한 모서리가 있거나 모서리 색이 제각각이면 아무것도 하지 않고 false 를 돌려준다.
 */
export function removeBackground(data: Uint8ClampedArray, w: number, h: number, tol = 60): boolean {
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map((p) => p * 4)
  if (corners.some((i) => data[i + 3] < 250)) return false
  const [r, g, b] = [0, 1, 2].map((k) => Math.round(corners.reduce((a, i) => a + data[i + k], 0) / 4))
  if (corners.some((i) => dist(data, i, r, g, b) > 45)) return false
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  const push = (p: number) => {
    if (!seen[p] && dist(data, p * 4, r, g, b) <= tol) {
      seen[p] = 1
      stack.push(p)
    }
  }
  for (let x = 0; x < w; x++) (push(x), push((h - 1) * w + x))
  for (let y = 0; y < h; y++) (push(y * w), push(y * w + w - 1))
  while (stack.length) {
    const p = stack.pop()!
    const x = p % w
    if (x > 0) push(p - 1)
    if (x < w - 1) push(p + 1)
    if (p >= w) push(p - w)
    if (p < w * (h - 1)) push(p + w)
  }
  let removed = 0
  for (let p = 0; p < seen.length; p++) {
    if (seen[p]) {
      data[p * 4 + 3] = 0
      removed++
    }
  }
  // 경계선 한 겹은 반투명하게 (계단 현상·흰 테두리 줄이기)
  for (let p = 0; p < seen.length; p++) {
    if (seen[p] || data[p * 4 + 3] === 0) continue
    const x = p % w
    const near =
      (x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (p >= w && seen[p - w]) || (p < w * (h - 1) && seen[p + w])
    if (near) data[p * 4 + 3] = Math.min(data[p * 4 + 3], 140)
  }
  return removed > 0
}

/** 투명하지 않은 부분의 경계 상자 (없으면 null) */
export function alphaBounds(data: Uint8ClampedArray, w: number, h: number, threshold = 8): Rect | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

export type AddError = 'read' | 'empty' | 'limit'

async function readImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('read'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export interface NewCustomItem {
  file: File
  category: Category
  name: string
  eraseBackground: boolean
}

/** 사진 → 1024×1536 투명 레이어 + 썸네일을 만들어 Item 으로 돌려준다 (저장은 하지 않는다) */
export async function buildCustomItem({ file, category, name, eraseBackground }: NewCustomItem): Promise<Item> {
  const img = await readImage(file).catch(() => {
    throw new Error('read' satisfies AddError)
  })
  const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const sw = Math.max(1, Math.round(img.naturalWidth * k))
  const sh = Math.max(1, Math.round(img.naturalHeight * k))
  const src = canvas(sw, sh)
  const sctx = src.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(img, 0, 0, sw, sh)
  const px = sctx.getImageData(0, 0, sw, sh)
  if (eraseBackground) removeBackground(px.data, sw, sh)
  sctx.putImageData(px, 0, 0)
  const bounds = alphaBounds(px.data, sw, sh)
  if (!bounds) throw new Error('empty' satisfies AddError)

  const box = defaultBox(category, bounds.w, bounds.h)
  const layer = canvas(CANVAS_W, CANVAS_H)
  const lctx = layer.getContext('2d')!
  lctx.imageSmoothingQuality = 'high'
  lctx.drawImage(src, bounds.x, bounds.y, bounds.w, bounds.h, box.x, box.y, box.w, box.h)

  const thumb = canvas(THUMB, THUMB)
  const tctx = thumb.getContext('2d')!
  tctx.imageSmoothingQuality = 'high'
  const ts = Math.min(THUMB / bounds.w, THUMB / bounds.h) * 0.92
  tctx.drawImage(src, bounds.x, bounds.y, bounds.w, bounds.h, (THUMB - bounds.w * ts) / 2, (THUMB - bounds.h * ts) / 2, bounds.w * ts, bounds.h * ts)

  const id = `${CUSTOM_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const label = name.trim().slice(0, 20)
  return {
    id,
    category,
    name: { ko: label || '내 옷', en: label || 'My item' },
    color: null,
    colorName: null,
    colorHex: null,
    box,
    image: layer.toDataURL('image/webp', 0.92),
    thumb: thumb.toDataURL('image/webp', 0.9),
    zIndex: LAYER_Z[category],
  }
}

/* ---- 저장 (IndexedDB: 사진이 커서 localStorage 대신 사용) ---- */
const DB = 'ryuso-custom'
const STORE = 'items'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

const isItem = (v: unknown): v is Item => {
  const i = v as Item
  return !!i && typeof i.id === 'string' && i.id.startsWith(CUSTOM_PREFIX) && typeof i.image === 'string' && typeof i.thumb === 'string' && !!i.box
}

/** 앱을 켤 때 한 번: 저장된 내 옷을 목록에 올린다 (실패해도 앱은 그대로 동작) */
export async function loadCustomItems(): Promise<void> {
  try {
    const list = (await tx('readonly', (s) => s.getAll())) as unknown[]
    list
      .filter(isItem)
      .sort((a, b) => a.id.localeCompare(b.id)) // 오래된 것부터 넣어서 최신이 맨 앞에 오게
      .forEach((i) => registerCustomItem(i, true))
  } catch {
    /* IndexedDB 를 못 쓰는 환경(사생활 보호 모드 등) */
  }
}

export const customCount = () => ITEMS.filter((i) => i.id.startsWith(CUSTOM_PREFIX)).length
export const hasItem = (id: string) => !!ITEM_BY_ID[id]

/** 목록에 올리고 저장한다. 저장에 실패하면 false (이번 접속에서만 보임) */
export async function addCustomItem(item: Item): Promise<boolean> {
  registerCustomItem(item)
  try {
    await tx('readwrite', (s) => s.put(item))
    return true
  } catch {
    return false
  }
}

export async function removeCustomItem(id: string): Promise<void> {
  unregisterCustomItem(id)
  try {
    await tx('readwrite', (s) => s.delete(id))
  } catch {
    /* 무시 */
  }
}
