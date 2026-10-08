import { CANVAS_H, CANVAS_W, CATEGORIES, type Category } from './layers'
import { opaqueAt, type Mask } from './roomHit'
import type { Item, Outfit, Tweak, Tweaks } from './types'

/** 옷 크기 조절 범위와 이동 한도(캔버스 px) */
export const MIN_TWEAK_SCALE = 0.6
export const MAX_TWEAK_SCALE = 1.6
export const MAX_TWEAK_MOVE = 420

export const IDENTITY: Tweak = { dx: 0, dy: 0, scale: 1 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const EPS = 0.5

/** 옷 영역의 중심 — 크기 조절의 기준점 */
export const pivotOf = (item: Item) => ({ x: item.box.x + item.box.w / 2, y: item.box.y + item.box.h / 2 })

export const getTweak = (tweaks: Tweaks, c: Category): Tweak => tweaks[c] ?? IDENTITY

const isIdentity = (t: Tweak) => Math.abs(t.dx) < EPS && Math.abs(t.dy) < EPS && Math.abs(t.scale - 1) < 0.005

function clampTweak(t: Tweak): Tweak {
  return {
    dx: clamp(t.dx, -MAX_TWEAK_MOVE, MAX_TWEAK_MOVE),
    dy: clamp(t.dy, -MAX_TWEAK_MOVE, MAX_TWEAK_MOVE),
    scale: clamp(t.scale, MIN_TWEAK_SCALE, MAX_TWEAK_SCALE),
  }
}

/** 조절값을 저장한다. 원래 위치·크기로 돌아오면 항목을 지운다. */
export function setTweak(tweaks: Tweaks, c: Category, t: Tweak): Tweaks {
  const next = { ...tweaks }
  const v = clampTweak(t)
  if (isIdentity(v)) delete next[c]
  else next[c] = v
  return next
}
export const moveTweak = (tweaks: Tweaks, c: Category, dx: number, dy: number) => {
  const t = getTweak(tweaks, c)
  return setTweak(tweaks, c, { ...t, dx: t.dx + dx, dy: t.dy + dy })
}
export const setScaleTweak = (tweaks: Tweaks, c: Category, scale: number) =>
  setTweak(tweaks, c, { ...getTweak(tweaks, c), scale })
export const scaleTweak = (tweaks: Tweaks, c: Category, factor: number) =>
  setScaleTweak(tweaks, c, getTweak(tweaks, c).scale * factor)
export function resetTweak(tweaks: Tweaks, c: Category): Tweaks {
  const next = { ...tweaks }
  delete next[c]
  return next
}

/** 입은 옷이 바뀐 카테고리의 조절값은 버린다 (새 옷은 원래 위치에서 시작) */
export function pruneTweaks(prev: Outfit, next: Outfit, tweaks: Tweaks): Tweaks {
  const out: Tweaks = {}
  for (const c of CATEGORIES) {
    if (tweaks[c] && next[c] && next[c] === prev[c]) out[c] = tweaks[c]
  }
  return out
}

/** 저장 데이터 검증: 입고 있는 카테고리만, 숫자 범위 보정 */
export function sanitizeTweaks(raw: unknown, outfit: Outfit): Tweaks {
  const out: Tweaks = {}
  if (!raw || typeof raw !== 'object') return out
  for (const c of CATEGORIES) {
    const t = (raw as Record<string, unknown>)[c] as Partial<Tweak> | undefined
    if (!outfit[c] || !t || typeof t !== 'object') continue
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
    const v = clampTweak({ dx: num(t.dx, 0), dy: num(t.dy, 0), scale: num(t.scale, 1) })
    if (!isIdentity(v)) out[c] = v
  }
  return out
}

/** 화면(CSS) 렌더링용: 옷 레이어 전체 크기에 대한 변환. 기준점에서 확대하고 이동한다. */
export function cssTransform(item: Item, t: Tweak): { transformOrigin: string; transform: string } {
  const p = pivotOf(item)
  return {
    transformOrigin: `${(p.x / CANVAS_W) * 100}% ${(p.y / CANVAS_H) * 100}%`,
    transform: `translate(${(t.dx / CANVAS_W) * 100}%, ${(t.dy / CANVAS_H) * 100}%) scale(${t.scale})`,
  }
}

/** 화면에 보이는 좌표 → 조절 전 옷 이미지 좌표 (터치 판정용) */
export function toItemSpace(item: Item, t: Tweak, x: number, y: number) {
  const p = pivotOf(item)
  return { x: p.x + (x - p.x - t.dx) / t.scale, y: p.y + (y - p.y - t.dy) / t.scale }
}

/** 이 점에서 가장 위에 보이는 옷의 카테고리. 투명한 부분은 통과한다. */
export function pickWorn(
  outfit: Outfit,
  tweaks: Tweaks,
  byId: Record<string, Item>,
  x: number,
  y: number,
  getMask: (itemId: string) => Mask | undefined,
): Category | null {
  const worn = CATEGORIES.map((c) => (outfit[c] ? byId[outfit[c]!] : undefined))
    .filter((i): i is Item => !!i)
    .sort((a, b) => b.zIndex - a.zIndex) // 위에 있는 옷부터
  for (const it of worn) {
    const q = toItemSpace(it, getTweak(tweaks, it.category), x, y)
    if (q.x < 0 || q.y < 0 || q.x > CANVAS_W || q.y > CANVAS_H) continue
    const m = getMask(it.id)
    const hit = m
      ? opaqueAt(m, q.x / CANVAS_W, q.y / CANVAS_H)
      : q.x >= it.box.x && q.x <= it.box.x + it.box.w && q.y >= it.box.y && q.y <= it.box.y + it.box.h
    if (hit) return it.category
  }
  return null
}
