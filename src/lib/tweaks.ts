import { CANVAS_H, CANVAS_W } from './layers'
import { opaqueAt, type Mask } from './roomHit'
import type { Tweak } from './types'

/** 옷 크기 조절 범위와 이동 한도(캔버스 px) */
export const MIN_TWEAK_SCALE = 0.6
export const MAX_TWEAK_SCALE = 1.6
export const MAX_TWEAK_MOVE = 420

export const IDENTITY: Tweak = { dx: 0, dy: 0, scale: 1 }

/** 코디 탭은 카테고리, 조립 탭은 'head'|'top'|'bottom' 을 키로 쓴다 */
export type TweakMap<K extends string> = Partial<Record<K, Tweak>>
/** 위치·크기를 조절할 수 있는 한 겹(레이어): 경계 상자의 중심이 크기 조절의 기준점 */
export interface Boxed {
  box: { x: number; y: number; w: number; h: number }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const EPS = 0.5

/** 옷 영역의 중심 — 크기 조절의 기준점 */
export const pivotOf = (item: Boxed) => ({ x: item.box.x + item.box.w / 2, y: item.box.y + item.box.h / 2 })

export const getTweak = <K extends string>(tweaks: TweakMap<K>, k: K): Tweak => tweaks[k] ?? IDENTITY

const isIdentity = (t: Tweak) => Math.abs(t.dx) < EPS && Math.abs(t.dy) < EPS && Math.abs(t.scale - 1) < 0.005 && !t.z

/** 순서 조절값(z)의 한도: 어떤 옷끼리도 자리를 바꿀 수 있을 만큼 */
const MAX_Z = 200

function clampTweak(t: Tweak): Tweak {
  const z = Math.round(clamp(t.z ?? 0, -MAX_Z, MAX_Z) * 100) / 100
  return {
    dx: clamp(t.dx, -MAX_TWEAK_MOVE, MAX_TWEAK_MOVE),
    dy: clamp(t.dy, -MAX_TWEAK_MOVE, MAX_TWEAK_MOVE),
    scale: clamp(t.scale, MIN_TWEAK_SCALE, MAX_TWEAK_SCALE),
    ...(z ? { z } : {}),
  }
}

/** 조절값을 저장한다. 원래 위치·크기로 돌아오면 항목을 지운다. */
export function setTweak<K extends string>(tweaks: TweakMap<K>, k: K, t: Tweak): TweakMap<K> {
  const next = { ...tweaks }
  const v = clampTweak(t)
  if (isIdentity(v)) delete next[k]
  else next[k] = v
  return next
}
export const moveTweak = <K extends string>(tweaks: TweakMap<K>, k: K, dx: number, dy: number) => {
  const t = getTweak(tweaks, k)
  return setTweak(tweaks, k, { ...t, dx: t.dx + dx, dy: t.dy + dy })
}
export const setScaleTweak = <K extends string>(tweaks: TweakMap<K>, k: K, scale: number) =>
  setTweak(tweaks, k, { ...getTweak(tweaks, k), scale })
export const scaleTweak = <K extends string>(tweaks: TweakMap<K>, k: K, factor: number) =>
  setScaleTweak(tweaks, k, getTweak(tweaks, k).scale * factor)
export function resetTweak<K extends string>(tweaks: TweakMap<K>, k: K): TweakMap<K> {
  const next = { ...tweaks }
  delete next[k]
  return next
}

/** 입은 것이 바뀐 칸의 조절값은 버린다 (새로 입은 것은 원래 위치에서 시작) */
export function pruneTweaks<K extends string>(
  keys: readonly K[],
  prev: Partial<Record<K, string>>,
  next: Partial<Record<K, string>>,
  tweaks: TweakMap<K>,
): TweakMap<K> {
  const out: TweakMap<K> = {}
  for (const k of keys) if (tweaks[k] && next[k] && next[k] === prev[k]) out[k] = tweaks[k]
  return out
}

/** 저장 데이터 검증: 입고 있는 칸만, 숫자 범위 보정 */
export function sanitizeTweaks<K extends string>(
  raw: unknown,
  keys: readonly K[],
  present: Partial<Record<K, unknown>>,
): TweakMap<K> {
  const out: TweakMap<K> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const k of keys) {
    const t = (raw as Record<string, unknown>)[k] as Partial<Tweak> | undefined
    if (!present[k] || !t || typeof t !== 'object') continue
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
    const v = clampTweak({ dx: num(t.dx, 0), dy: num(t.dy, 0), scale: num(t.scale, 1), z: num(t.z, 0) })
    if (!isIdentity(v)) out[k] = v
  }
  return out
}

/** 겹치는 순서까지 반영한 쌓이는 순서 (클수록 위) */
export const effectiveZ = (baseZ: number, t?: Tweak) => baseZ + (t?.z ?? 0)

/** 겹치는 순서 한 칸 바꾸기: 앞(dir=1) 또는 뒤(dir=-1)로 이웃한 레이어와 자리를 맞바꾼다. 더 갈 데가 없으면 그대로. */
export function shiftLayer<K extends string>(
  tweaks: TweakMap<K>,
  layers: { key: K; z: number }[],
  key: K,
  dir: 1 | -1,
): TweakMap<K> {
  const order = [...layers].sort((a, b) => a.z - b.z)
  const i = order.findIndex((l) => l.key === key)
  const j = i + dir
  if (i < 0 || j < 0 || j >= order.length) return tweaks
  const [a, b] = [order[i], order[j]]
  // 두 레이어의 쌓이는 값을 서로 바꾼다 (기본 순서 = 지금 값 - 지금 순서 조절값)
  const base = (l: { key: K; z: number }) => l.z - (tweaks[l.key]?.z ?? 0)
  let next = setTweak(tweaks, a.key, { ...getTweak(tweaks, a.key), z: b.z - base(a) })
  next = setTweak(next, b.key, { ...getTweak(next, b.key), z: a.z - base(b) })
  return next
}

/** 앞/뒤로 더 보낼 수 있는지 */
export function canShiftLayer<K extends string>(layers: { key: K; z: number }[], key: K, dir: 1 | -1): boolean {
  const order = [...layers].sort((a, b) => a.z - b.z)
  const i = order.findIndex((l) => l.key === key)
  return i >= 0 && i + dir >= 0 && i + dir < order.length
}

/** 모든 순서 조절을 지운다 (위치·크기는 그대로) */
export function stripZ<K extends string>(tweaks: TweakMap<K>): TweakMap<K> {
  const out: TweakMap<K> = {}
  for (const k of Object.keys(tweaks) as K[]) {
    const { z: _z, ...rest } = tweaks[k]!
    void _z
    if (!isIdentity(rest)) out[k] = rest
  }
  return out
}

/** 화면(CSS) 렌더링용: 레이어 전체 크기에 대한 변환. 기준점에서 확대하고 이동한다. */
export function cssTransform(item: Boxed, t: Tweak): { transformOrigin: string; transform: string } {
  const p = pivotOf(item)
  return {
    transformOrigin: `${(p.x / CANVAS_W) * 100}% ${(p.y / CANVAS_H) * 100}%`,
    transform: `translate(${(t.dx / CANVAS_W) * 100}%, ${(t.dy / CANVAS_H) * 100}%) scale(${t.scale})`,
  }
}

/** 화면에 보이는 좌표 → 조절 전 이미지 좌표 (터치 판정용) */
export function toItemSpace(item: Boxed, t: Tweak, x: number, y: number) {
  const p = pivotOf(item)
  return { x: p.x + (x - p.x - t.dx) / t.scale, y: p.y + (y - p.y - t.dy) / t.scale }
}

/** 판정 대상 한 겹: 키, 이미지/마스크 id, 쌓이는 순서(클수록 위), 경계 상자 */
export interface Pickable extends Boxed {
  key: string
  id: string
  z: number
}

/** 이 점에서 가장 위에 보이는 레이어의 키. 투명한 부분은 통과한다. */
export function pickLayer<K extends string>(
  layers: (Pickable & { key: K })[],
  tweaks: TweakMap<K>,
  x: number,
  y: number,
  getMask: (id: string) => Mask | undefined,
): K | null {
  for (const it of [...layers].sort((a, b) => b.z - a.z)) {
    const q = toItemSpace(it, getTweak(tweaks, it.key), x, y)
    if (q.x < 0 || q.y < 0 || q.x > CANVAS_W || q.y > CANVAS_H) continue
    const m = getMask(it.id)
    const hit = m
      ? opaqueAt(m, q.x / CANVAS_W, q.y / CANVAS_H)
      : q.x >= it.box.x && q.x <= it.box.x + it.box.w && q.y >= it.box.y && q.y <= it.box.y + it.box.h
    if (hit) return it.key
  }
  return null
}
