import roomData from '../data/room-items.json'
import { CANVAS_H, CANVAS_W } from './layers'
import {
  AVATAR_BASE_W,
  AVATAR_FEET_RATIO,
  MAX_PLACED,
  MAX_SCALE,
  MIN_SCALE,
  ROOM_H,
  ROOM_W,
  type AvatarPlacement,
  type Placed,
  type RoomGroup,
  type RoomItemDef,
  type RoomState,
  type Selection,
} from './roomTypes'

export const ROOM_ITEMS = roomData as RoomItemDef[]
export const ROOM_ITEM_BY_ID: Record<string, RoomItemDef> = Object.fromEntries(ROOM_ITEMS.map((d) => [d.id, d]))

export const DEFAULT_AVATAR: AvatarPlacement = { x: 760, y: 1395, scale: 1, flip: false }

/** 처음 보는 방: 창문 + 러그 + 곰돌이 소파 + 아바타 */
export function defaultRoom(): RoomState {
  const mk = (itemId: string, uid: string, over: Partial<Placed> = {}): Placed => {
    const d = ROOM_ITEM_BY_ID[itemId]
    return { uid, itemId, x: d?.x ?? ROOM_W / 2, y: d?.y ?? 1240, scale: 1, flip: false, ...over }
  }
  const items = [
    mk('wall_window_day', 'd1', { x: 543, y: 640 }),
    mk('rug_stripe', 'd2', { x: 543, y: 1350 }),
    mk('furniture_sofa_bear', 'd3', { x: 360, y: 1255 }),
  ].filter((p) => ROOM_ITEM_BY_ID[p.itemId])
  return { avatar: { ...DEFAULT_AVATAR }, items }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const clampX = (x: number) => clamp(x, 0, ROOM_W)
const clampY = (y: number) => clamp(y, 0, ROOM_H + 30)
export const clampScale = (s: number) => clamp(s, MIN_SCALE, MAX_SCALE)

export function itemSize(def: RoomItemDef, scale: number) {
  const w = def.baseWidth * scale
  return { w, h: (w * def.h) / def.w }
}
export function avatarSize(scale: number) {
  const w = AVATAR_BASE_W * scale
  return { w, h: (w * CANVAS_H) / CANVAS_W }
}

/** 새 물건을 놓는다. 가득 찼으면 null. 같은 물건이 이미 있으면 살짝 비껴 놓는다. */
export function addItem(state: RoomState, def: RoomItemDef, uid: string): RoomState | null {
  if (state.items.length >= MAX_PLACED) return null
  const same = state.items.filter((p) => p.itemId === def.id).length
  const off = same * 46 * (same % 2 ? 1 : -1)
  const placed: Placed = { uid, itemId: def.id, x: clampX(def.x + off), y: clampY(def.y + Math.abs(off) / 3), scale: 1, flip: false }
  return { ...state, items: [...state.items, placed] }
}

export function removeItem(state: RoomState, uid: string): RoomState {
  return { ...state, items: state.items.filter((p) => p.uid !== uid) }
}

function mapSel(
  state: RoomState,
  sel: NonNullable<Selection>,
  f: (p: { x: number; y: number; scale: number; flip: boolean }) => { x: number; y: number; scale: number; flip: boolean },
): RoomState {
  if (sel.kind === 'avatar') return { ...state, avatar: { ...state.avatar, ...f(state.avatar) } }
  return { ...state, items: state.items.map((p) => (p.uid === sel.uid ? { ...p, ...f(p) } : p)) }
}

export const moveTo = (s: RoomState, sel: NonNullable<Selection>, x: number, y: number) =>
  mapSel(s, sel, (p) => ({ ...p, x: clampX(x), y: clampY(y) }))
export const moveBy = (s: RoomState, sel: NonNullable<Selection>, dx: number, dy: number) =>
  mapSel(s, sel, (p) => ({ ...p, x: clampX(p.x + dx), y: clampY(p.y + dy) }))
export const setScale = (s: RoomState, sel: NonNullable<Selection>, scale: number) =>
  mapSel(s, sel, (p) => ({ ...p, scale: clampScale(scale) }))
export const scaleBy = (s: RoomState, sel: NonNullable<Selection>, factor: number) =>
  mapSel(s, sel, (p) => ({ ...p, scale: clampScale(p.scale * factor) }))
export const toggleFlip = (s: RoomState, sel: NonNullable<Selection>) => mapSel(s, sel, (p) => ({ ...p, flip: !p.flip }))

export function getPlacement(state: RoomState, sel: NonNullable<Selection>) {
  if (sel.kind === 'avatar') return state.avatar
  return state.items.find((p) => p.uid === sel.uid)
}

/** 저장된 데이터를 검증해 안전한 상태로 만든다 */
export function sanitizeRoom(raw: unknown): RoomState {
  const base = defaultRoom()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as { avatar?: unknown; items?: unknown }
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  const a = (r.avatar ?? {}) as Record<string, unknown>
  const avatar: AvatarPlacement = {
    x: clampX(num(a.x, DEFAULT_AVATAR.x)),
    y: clampY(num(a.y, DEFAULT_AVATAR.y)),
    scale: clampScale(num(a.scale, 1)),
    flip: a.flip === true,
  }
  if (!Array.isArray(r.items)) return { avatar, items: base.items }
  const seen = new Set<string>()
  const items: Placed[] = []
  for (const it of r.items as Record<string, unknown>[]) {
    if (!it || typeof it.itemId !== 'string' || !ROOM_ITEM_BY_ID[it.itemId]) continue
    let uid = typeof it.uid === 'string' && it.uid ? it.uid : `r${items.length}`
    while (seen.has(uid)) uid += '_'
    seen.add(uid)
    items.push({
      uid,
      itemId: it.itemId,
      x: clampX(num(it.x, ROOM_W / 2)),
      y: clampY(num(it.y, 1240)),
      scale: clampScale(num(it.scale, 1)),
      flip: it.flip === true,
    })
    if (items.length >= MAX_PLACED) break
  }
  return { avatar, items }
}

/* ───── 그리기 순서와 영역 (화면, 터치 판정, PNG 내보내기가 같이 쓴다) ─────
 * 러그 < 벽 장식 < (가구·아바타: 기준점 y 가 클수록 앞) < 조명 효과 */
export interface Drawable {
  sel: NonNullable<Selection>
  key: string
  group: RoomGroup | 'avatar'
  z: number
  /** 이미지가 그려지는 영역 (논리 px) */
  left: number
  top: number
  w: number
  h: number
  /** 기준점(아래 가운데) */
  x: number
  y: number
  flip: boolean
  src?: string
}

const zOf = (group: RoomGroup | 'avatar', y: number, index: number) => {
  switch (group) {
    case 'rug':
      return 100 + index
    case 'wall':
      return 1000 + index
    case 'light':
      return 5000 + index
    default:
      return 2000 + y // furniture, avatar
  }
}

export function drawables(state: RoomState): Drawable[] {
  const out: Drawable[] = []
  state.items.forEach((p, i) => {
    const def = ROOM_ITEM_BY_ID[p.itemId]
    if (!def) return
    const { w, h } = itemSize(def, p.scale)
    out.push({
      sel: { kind: 'item', uid: p.uid },
      key: def.id,
      group: def.group,
      z: zOf(def.group, p.y, i),
      left: p.x - w / 2,
      top: p.y - h,
      w,
      h,
      x: p.x,
      y: p.y,
      flip: p.flip,
      src: def.image,
    })
  })
  const av = state.avatar
  const { w, h } = avatarSize(av.scale)
  // 같은 y 의 가구보다 아바타가 살짝 앞에 오도록 +0.5
  out.push({
    sel: { kind: 'avatar' },
    key: 'avatar',
    group: 'avatar',
    z: zOf('avatar', av.y, 0) + 0.5,
    left: av.x - w / 2,
    top: av.y - h * AVATAR_FEET_RATIO,
    w,
    h,
    x: av.x,
    y: av.y,
    flip: av.flip,
  })
  return out.sort((a, b) => a.z - b.z)
}

/** 바닥에 닿는 물건(그림자를 그린다) */
export const hasContactShadow = (g: Drawable['group']) => g === 'furniture' || g === 'avatar'
/** 접지 그림자 크기 비율(폭 기준) */
export const shadowWidthRatio = (g: Drawable['group']) => (g === 'avatar' ? 0.5 : 0.82)

export function sameSelection(a: Selection, b: Selection): boolean {
  if (!a || !b) return a === b
  if (a.kind !== b.kind) return false
  return a.kind === 'avatar' || (b.kind === 'item' && a.uid === b.uid)
}
