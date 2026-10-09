import { CUSTOM_PREFIX, ITEM_BY_ID, ITEMS, registerCustomItem, unregisterCustomItem } from './items'
import { CUSTOM_ROOM_PREFIX, ROOM_ITEMS, registerCustomRoomItem, unregisterCustomRoomItem } from './room'
import type { RoomGroup, RoomItemDef } from './roomTypes'
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

/** 사이트에 있는 기본 옷들의 위치·크기 (경계 상자의 중앙값) — 내 옷을 이 조건에 맞춰 놓는다 */
export interface Stats {
  w: number
  h: number
  /** 옷 맨 위(어깨선·허리선) */
  y: number
  /** 가로 가운데 */
  cx: number
}

const median = (v: number[]) => {
  const a = [...v].sort((x, y) => x - y)
  const m = a.length >> 1
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

/** 내 옷이 아닌 기본 옷만으로 카테고리의 기준값을 구한다 (옷이 없으면 null) */
export function categoryStats(category: Category, items: Pick<Item, 'id' | 'category' | 'box'>[]): Stats | null {
  const list = items.filter((i) => i.category === category && !i.id.startsWith(CUSTOM_PREFIX))
  if (!list.length) return null
  return {
    w: median(list.map((i) => i.box.w)),
    h: median(list.map((i) => i.box.h)),
    y: median(list.map((i) => i.box.y)),
    cx: median(list.map((i) => i.box.x + i.box.w / 2)),
  }
}

/** 기본 옷 기준값을 쓰는 카테고리 (나머지는 PLACEMENT 의 고정 위치) */
const FOLLOWS_SITE: Category[] = ['top', 'bottom', 'dress', 'outer', 'bag']

function clampBox(x: number, y: number, w: number, h: number): Rect {
  const bw = Math.max(1, Math.round(w))
  const bh = Math.max(1, Math.round(h))
  return {
    x: Math.min(CANVAS_W - bw, Math.max(0, Math.round(x))),
    y: Math.min(CANVAS_H - bh, Math.max(0, Math.round(y))),
    w: bw,
    h: bh,
  }
}

/**
 * 잘라낸 옷(가로 w × 세로 h)을 놓을 영역.
 * 기본 옷 기준값(stats)이 있으면 그 폭에 맞추되 너무 길어지지 않게 하고, 가로 가운데·맨 위(어깨선/허리선)를 기본 옷과 같게 한다.
 * 없으면 PLACEMENT 의 고정 위치를 쓴다.
 */
export function defaultBox(category: Category, w: number, h: number, stats?: Stats | null): Rect {
  if (stats && FOLLOWS_SITE.includes(category)) {
    const s = Math.min(stats.w / w, (stats.h * 1.3) / h)
    return clampBox(stats.cx - (w * s) / 2, stats.y, w * s, h * s)
  }
  const p = PLACEMENT[category]
  const s = Math.min(p.w / w, p.maxH / h)
  return clampBox(p.cx - (w * s) / 2, p.cy - (h * s) / 2, w * s, h * s)
}

/* 신발: 두 짝이 따로 있으면 아바타 발(가운데·폭·바닥)에 맞춘다 (tools-py/fit_assemble_shoes.py 와 같은 값) */
const FOOT_CX = [423.3, 598.1]
const FOOT_W = 110
const FEET_Y = 1509

/** 투명하지 않은 덩어리들의 경계 상자 (작은 점은 무시) */
export function components(data: Uint8ClampedArray, w: number, h: number, minArea = 400): Rect[] {
  const seen = new Uint8Array(w * h)
  const out: Rect[] = []
  const stack: number[] = []
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3] <= 128) continue
    let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0
    seen[start] = 1
    stack.push(start)
    while (stack.length) {
      const p = stack.pop()!
      const x = p % w
      const y = (p - x) / w
      area++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && !seen[q] && data[q * 4 + 3] > 128) {
          seen[q] = 1
          stack.push(q)
        }
      }
    }
    if (area >= minArea) out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 })
  }
  return out
}

/** 신발 두 짝(왼쪽·오른쪽 덩어리)을 아바타 발에 맞추는 배율과 위치. 두 덩어리가 아니면 null. */
export function shoePairFit(parts: Rect[], crop: Rect): { s: number; tx: number; ty: number } | null {
  if (parts.length !== 2) return null
  const [a, b] = [...parts].sort((p, q) => p.x - q.x)
  const x1 = a.x + a.w / 2
  const x2 = b.x + b.w / 2
  if (x2 - x1 < 1) return null
  const s = 0.5 * ((FOOT_CX[1] - FOOT_CX[0]) / (x2 - x1) + FOOT_W / ((a.w + b.w) / 2))
  const bottom = Math.max(a.y + a.h, b.y + b.h)
  return {
    s,
    tx: 0.5 * (FOOT_CX[0] + FOOT_CX[1]) - s * (0.5 * (x1 + x2) - crop.x),
    ty: FEET_Y - s * (bottom - crop.y),
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

/** 사진을 읽어 (긴 변 1024 이하로 줄이고) 배경을 지운 뒤, 옷이 있는 영역만 돌려준다 */
async function prepare(file: File, eraseBackground: boolean) {
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
  return { src, bounds }
}

/** 잘라낸 영역을 w×h 로 그린 새 캔버스 */
function crop(src: HTMLCanvasElement, b: Rect, w: number, h: number) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, w, h)
  return c
}

function thumbOf(src: HTMLCanvasElement, b: Rect) {
  const thumb = canvas(THUMB, THUMB)
  const ctx = thumb.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  const ts = Math.min(THUMB / b.w, THUMB / b.h) * 0.92
  ctx.drawImage(src, b.x, b.y, b.w, b.h, (THUMB - b.w * ts) / 2, (THUMB - b.h * ts) / 2, b.w * ts, b.h * ts)
  return thumb.toDataURL('image/webp', 0.9)
}

const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** 사진 → 1024×1536 투명 레이어 + 썸네일을 만들어 Item 으로 돌려준다 (저장은 하지 않는다) */
export async function buildCustomItem({ file, category, name, eraseBackground }: NewCustomItem): Promise<Item> {
  const { src, bounds } = await prepare(file, eraseBackground)
  let box = defaultBox(category, bounds.w, bounds.h, categoryStats(category, ITEMS))
  if (category === 'shoes') {
    const px = src.getContext('2d', { willReadFrequently: true })!.getImageData(bounds.x, bounds.y, bounds.w, bounds.h)
    const fit = shoePairFit(components(px.data, bounds.w, bounds.h), { x: 0, y: 0, w: bounds.w, h: bounds.h })
    if (fit) box = clampBox(fit.tx, fit.ty, bounds.w * fit.s, bounds.h * fit.s)
  }
  const layer = canvas(CANVAS_W, CANVAS_H)
  const lctx = layer.getContext('2d')!
  lctx.imageSmoothingQuality = 'high'
  lctx.drawImage(src, bounds.x, bounds.y, bounds.w, bounds.h, box.x, box.y, box.w, box.h)
  const label = name.trim().slice(0, 20)
  return {
    id: newId(CUSTOM_PREFIX),
    category,
    name: { ko: label || '내 옷', en: label || 'My item' },
    color: null,
    colorName: null,
    colorHex: null,
    box,
    image: layer.toDataURL('image/webp', 0.92),
    thumb: thumbOf(src, bounds),
    zIndex: LAYER_Z[category],
  }
}

/** 방 물건의 기본 크기·위치 (논리 좌표 1086×1448, 위치는 이미지 아래 가운데) */
const ROOM_DEFAULTS: Record<RoomGroup, { baseWidth: number; maxH: number; x: number; y: number }> = {
  furniture: { baseWidth: 320, maxH: 520, x: 543, y: 1260 },
  rug: { baseWidth: 560, maxH: 260, x: 543, y: 1350 },
  wall: { baseWidth: 280, maxH: 380, x: 543, y: 600 },
  light: { baseWidth: 520, maxH: 700, x: 543, y: 900 },
  camp: { baseWidth: 280, maxH: 420, x: 543, y: 1330 },
}

/** 방 물건의 기본 표시 폭: 가로 기준 폭을 쓰되 세로가 너무 길어지지 않게 줄인다 */
export function roomBaseWidth(group: RoomGroup, w: number, h: number) {
  const d = ROOM_DEFAULTS[group]
  return Math.max(40, Math.round(Math.min(d.baseWidth, (d.maxH * w) / h)))
}

export interface NewCustomRoomItem {
  file: File
  group: RoomGroup
  name: string
  eraseBackground: boolean
}

/** 사진 → 방 물건 (잘라낸 이미지 + 썸네일) */
export async function buildCustomRoomItem({ file, group, name, eraseBackground }: NewCustomRoomItem): Promise<RoomItemDef> {
  const { src, bounds } = await prepare(file, eraseBackground)
  const d = ROOM_DEFAULTS[group]
  const label = name.trim().slice(0, 20)
  return {
    id: newId(CUSTOM_ROOM_PREFIX),
    group,
    name: { ko: label || '내 소품', en: label || 'My prop' },
    image: crop(src, bounds, bounds.w, bounds.h).toDataURL('image/webp', 0.92),
    thumb: thumbOf(src, bounds),
    w: bounds.w,
    h: bounds.h,
    baseWidth: roomBaseWidth(group, bounds.w, bounds.h),
    x: d.x,
    y: d.y,
  }
}

/* ---- 저장 (IndexedDB: 사진이 커서 localStorage 대신 사용) ---- */
const DB = 'ryuso-custom'
const STORE = 'items'
const ROOM_STORE = 'roomItems'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of [STORE, ROOM_STORE]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(store, mode).objectStore(store))
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

const isRoomItem = (v: unknown): v is RoomItemDef => {
  const d = v as RoomItemDef
  return !!d && typeof d.id === 'string' && d.id.startsWith(CUSTOM_ROOM_PREFIX) && typeof d.image === 'string' && typeof d.thumb === 'string' && d.w > 0 && d.h > 0 && d.baseWidth > 0
}

export async function loadCustomRoomItems(): Promise<void> {
  try {
    const list = (await tx('readonly', (s) => s.getAll(), ROOM_STORE)) as unknown[]
    list
      .filter(isRoomItem)
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((d) => registerCustomRoomItem(d, true))
  } catch {
    /* 무시 */
  }
}

export const customRoomCount = () => ROOM_ITEMS_CUSTOM().length
const ROOM_ITEMS_CUSTOM = () => ROOM_ITEMS.filter((d) => d.id.startsWith(CUSTOM_ROOM_PREFIX))

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

export async function addCustomRoomItem(def: RoomItemDef): Promise<boolean> {
  registerCustomRoomItem(def)
  try {
    await tx('readwrite', (s) => s.put(def), ROOM_STORE)
    return true
  } catch {
    return false
  }
}

export async function removeCustomRoomItem(id: string): Promise<void> {
  unregisterCustomRoomItem(id)
  try {
    await tx('readwrite', (s) => s.delete(id), ROOM_STORE)
  } catch {
    /* 무시 */
  }
}

/** 백업용: 내가 추가한 옷·방 물건을 통째로 꺼낸다 */
export async function exportCustom(): Promise<{ items: Item[]; roomItems: RoomItemDef[] }> {
  try {
    const items = ((await tx('readonly', (s) => s.getAll())) as unknown[]).filter(isItem)
    const roomItems = ((await tx('readonly', (s) => s.getAll(), ROOM_STORE)) as unknown[]).filter(isRoomItem)
    return { items, roomItems }
  } catch {
    return { items: [], roomItems: [] }
  }
}

/** 백업 불러오기용: 이 기기에 있던 내 옷·방 물건을 모두 지우고 주어진 것으로 바꾼다. 실패하면 false */
export async function replaceCustom(items: unknown[], roomItems: unknown[]): Promise<boolean> {
  try {
    await tx('readwrite', (s) => s.clear())
    await tx('readwrite', (s) => s.clear(), ROOM_STORE)
    for (const it of items.filter(isItem)) await tx('readwrite', (s) => s.put(it))
    for (const d of roomItems.filter(isRoomItem)) await tx('readwrite', (s) => s.put(d), ROOM_STORE)
    return true
  } catch {
    return false
  }
}
