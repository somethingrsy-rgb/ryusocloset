import { ITEMS } from './items'
import { isRestoring } from './restoreGuard'
import type { Category } from './layers'
import type { Item } from './types'

/**
 * 여행 게임: 지도의 여러 장소를 돌아다니며 숨은 옷·소품을 찾는다.
 * 찾은 아이템만 옷장에 나온다(옷장 잠금을 켜 둔 경우). 상태는 'ryuso.' 로 시작하는 키라서 백업에도 들어간다.
 */
const KEY = 'ryuso.game.v1'

export interface Place {
  id: string
  ko: string
  en: string
  icon: string
  /** 지도 위 위치(%) */
  x: number
  y: number
  /** 장면 배경 (벽 / 바닥) 과 바닥 높이 비율(전체 1448 기준 px) */
  wall: string
  /** 밤 배경이 따로 있으면 (캠핑장) */
  wallNight?: string
  floor: string
  floorH: number
}

const theme = (id: string, ko: string, en: string, icon: string, x: number, y: number, floorH: number): Place => ({
  id, ko, en, icon, x, y, floorH,
  wall: `assets/themes/${id}/wall.webp`,
  floor: `assets/themes/${id}/floor.webp`,
})

/** 여행 순서대로 이어서 지도에 길을 그린다 */
export const PLACES: Place[] = [
  theme('spring', '봄소풍', 'Spring Picnic', '🌸', 14, 84, 481),
  theme('summer', '여름휴가', 'Summer Vacation', '🏖️', 40, 90, 512),
  { id: 'camp', ko: '캠핑장', en: 'Campsite', icon: '⛺', x: 68, y: 86, wall: 'assets/camp/wall_day.webp', wallNight: 'assets/camp/wall_night.webp', floor: 'assets/camp/floor.webp', floorH: 500 },
  theme('birthday', '생일파티', 'Birthday Party', '🎂', 88, 68, 521),
  theme('halloween', '핼러윈', 'Halloween', '🎃', 68, 54, 449),
  theme('alice', '앨리스', "Alice's Tea Party", '🫖', 44, 60, 431),
  theme('valentine', '밸런타인데이', "Valentine's Day", '💝', 18, 60, 498),
  theme('palace', '궁전', 'Palace Tea Room', '👑', 30, 36, 493),
  theme('christmas', '크리스마스', 'Christmas', '🎄', 60, 30, 411),
  theme('winter', '겨울왕국', 'Winter Wonderland', '❄️', 82, 14, 539),
]
export const PLACE_BY_ID: Record<string, Place> = Object.fromEntries(PLACES.map((p) => [p.id, p]))

/** 게임에서 찾아야 하는 카테고리 (기본 상의·하의는 처음부터 쓸 수 있다) */
export const POOL_CATEGORIES: readonly Category[] = ['costume', 'accessory', 'bag', 'shoes', 'outer', 'dress']

/** 한 장소 장면 안에서 아이템이 숨는 자리(%) */
const SPOTS: ReadonlyArray<readonly [number, number]> = [
  [14, 38], [78, 44], [46, 30], [30, 72], [66, 80], [88, 66],
  [10, 62], [54, 56], [22, 86], [84, 26], [40, 48], [70, 62],
]

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export const inPool = (i: Pick<Item, 'id' | 'category' | 'native'>) =>
  !!i.native && !i.id.startsWith('custom_') && POOL_CATEGORIES.includes(i.category)

/** 아이템 목록을 장소에 고르게 나눈다. 같은 목록이면 늘 같은 결과(저장한 진행이 어긋나지 않게). */
export function assignPlaces(ids: string[], places: readonly Place[] = PLACES): Record<string, string[]> {
  const out: Record<string, string[]> = Object.fromEntries(places.map((p) => [p.id, []]))
  const sorted = [...ids].sort((a, b) => hash(a) - hash(b) || (a < b ? -1 : 1))
  sorted.forEach((id, i) => out[places[i % places.length].id].push(id))
  return out
}

/** 장소 안에서 아이템 하나가 숨은 자리(%) */
export function spotFor(id: string, index: number): { x: number; y: number } {
  const [x, y] = SPOTS[index % SPOTS.length]
  const h = hash(id)
  // 같은 자리를 쓰는 경우(12개 초과)에는 조금 비껴 놓는다
  const wrap = Math.floor(index / SPOTS.length)
  return { x: Math.min(92, x + wrap * 5 + (h % 5)), y: Math.min(90, y + ((h >> 3) % 5)) }
}

export interface GameState {
  found: string[]
  lock: boolean
  at: string
  /** 이벤트를 끝낸 장소 */
  events: string[]
  /** 맵이 오른쪽으로 얼마나 늘어났는지(구간 수). 한 번 늘어난 맵은 그대로 남는다 */
  reach: number
  /** 마지막으로 들어간 문의 구간 번호 (나오면 그 앞에서 시작) */
  chunk: number
}
const DEFAULT: GameState = { found: [], lock: true, at: PLACES[0].id, events: [], reach: 3, chunk: 0 }

function read(): GameState {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return DEFAULT
    const r = raw as Partial<GameState>
    return {
      found: Array.isArray(r.found) ? r.found.filter((x): x is string => typeof x === 'string') : [],
      lock: r.lock !== false,
      events: Array.isArray(r.events) ? r.events.filter((x): x is string => typeof x === 'string' && !!PLACE_BY_ID[x]) : [],
      reach: typeof r.reach === 'number' && Number.isFinite(r.reach) ? Math.min(300, Math.max(3, Math.floor(r.reach))) : DEFAULT.reach,
      chunk: typeof r.chunk === 'number' && Number.isFinite(r.chunk) ? Math.min(300, Math.max(0, Math.floor(r.chunk))) : 0,
      at: typeof r.at === 'string' && PLACE_BY_ID[r.at] ? r.at : DEFAULT.at,
    }
  } catch {
    return DEFAULT
  }
}

let state = read()
const listeners = new Set<() => void>()
let version = 0
export const subscribeGame = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn))
export const gameVersion = () => version
export const getGame = () => state

function set(next: GameState) {
  state = next
  version++
  if (!isRestoring()) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* 저장 공간이 없으면 이번 접속에서만 유지된다 */
    }
  }
  listeners.forEach((fn) => fn())
}

/** 이 아이템이 지금 잠겨 있는가 (게임 대상이고 아직 못 찾았고 잠금이 켜져 있음) */
export const isLocked = (i: Pick<Item, 'id' | 'category' | 'native'>) => state.lock && inPool(i) && !state.found.includes(i.id)

export const isFound = (id: string) => state.found.includes(id)

/** 아이템을 찾았다. 처음 찾은 거면 true */
export function findItem(id: string): boolean {
  if (state.found.includes(id)) return false
  set({ ...state, found: [...state.found, id] })
  return true
}
export const eventDone = (placeId: string) => state.events.includes(placeId)
export const finishEvent = (placeId: string) => {
  if (!state.events.includes(placeId)) set({ ...state, events: [...state.events, placeId] })
}

/**
 * 이벤트 보상으로 줄 아이템을 고른다. 아직 못 찾은 것 중에서, 'here' 면 이 장소에 숨은 것, 'any' 면 아무거나.
 * 이 장소에 남은 게 없으면 다른 곳에서 고른다. 다 찾았으면 null.
 */
export function pickReward(
  assign: Record<string, string[]>,
  found: readonly string[],
  placeId: string,
  scope: 'here' | 'any',
  rnd: () => number = Math.random,
): string | null {
  const left = (ids: string[]) => ids.filter((id) => !found.includes(id))
  const here = left(assign[placeId] ?? [])
  const pool = scope === 'here' && here.length ? here : left(Object.values(assign).flat())
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : null
}
export const setLock = (lock: boolean) => set({ ...state, lock })
export const travelTo = (at: string, chunk = PLACES.findIndex((p) => p.id === at)) => PLACE_BY_ID[at] && set({ ...state, at, chunk: Math.max(0, chunk) })
/** 맵을 오른쪽으로 늘린다 (줄어들지는 않는다) */
export const extendReach = (reach: number) => reach > state.reach && set({ ...state, reach: Math.min(300, reach) })
export const resetGame = () => set({ ...DEFAULT })

/** 현재 아이템 목록 기준 장소별 숨은 아이템 */
export const currentAssignment = () => assignPlaces(ITEMS.filter(inPool).map((i) => i.id))
