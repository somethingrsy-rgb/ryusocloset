import { actFarm, getFarm, type FarmState } from './farm'
import { PACK, PACK_PRICE, PANTRY, isCrop, menuById, needList, type PantryId } from './recipes'
import { isRestoring } from './restoreGuard'

/**
 * 주방: 카페에서 받은 주문서와 냉장고 속 기본 재료.
 * 카페에서 주문을 받으면 주문서가 생기고(order), 주방에서 다 만들면 완성(cook), 카페에서 서빙하면 지운다(serve).
 * 주문서는 카페 손님 자리(seat)마다 하나다.
 */
export interface Ticket { seat: number; menu: string; ready: boolean }
export interface KitchenState { pantry: Record<PantryId, number>; tickets: Ticket[] }
export type KitchenAction =
  | { type: 'order'; seat: number; menu: string }
  | { type: 'buy'; id: PantryId }
  | { type: 'cook'; seat: number }
  | { type: 'serve'; seat: number }

/** 처음에는 기본 재료를 조금씩 넣어 두어 바로 해 볼 수 있게 한다 */
export const defaultKitchen = (): KitchenState => ({ pantry: Object.fromEntries(PANTRY.map((p) => [p.id, 2])) as Record<PantryId, number>, tickets: [] })
const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(9999, Math.floor(v))) : 0)
const SEATS = 8

export function sanitizeKitchen(value: unknown): KitchenState {
  const base = defaultKitchen()
  if (!value || typeof value !== 'object') return base
  const raw = value as Partial<KitchenState>
  if (raw.pantry && typeof raw.pantry === 'object') for (const p of PANTRY) base.pantry[p.id] = count((raw.pantry as Record<string, unknown>)[p.id])
  const seen = new Set<number>()
  base.tickets = (Array.isArray(raw.tickets) ? raw.tickets : []).filter((t): t is Ticket => {
    if (!t || !Number.isInteger(t.seat) || t.seat < 0 || t.seat >= SEATS || seen.has(t.seat) || !menuById(t.menu)) return false
    seen.add(t.seat)
    return true
  }).map((t) => ({ seat: t.seat, menu: t.menu, ready: t.ready === true }))
  return base
}

/** 이 메뉴를 지금 만들 수 있는지: 모자란 재료 목록(비어 있으면 만들 수 있다) */
export function missing(menuId: string, kitchen: KitchenState, farm: Pick<FarmState, 'inventory'>) {
  const m = menuById(menuId)
  if (!m) return []
  return needList(m).filter(({ id, n }) => (isCrop(id) ? farm.inventory[id] : kitchen.pantry[id]) < n)
}

export function reduceKitchen(state: KitchenState, action: KitchenAction): KitchenState {
  const next: KitchenState = { pantry: { ...state.pantry }, tickets: [...state.tickets] }
  if (action.type === 'buy') {
    if (!PANTRY.some((p) => p.id === action.id)) return state
    next.pantry[action.id] += PACK
    return next
  }
  if (!Number.isInteger(action.seat) || action.seat < 0 || action.seat >= SEATS) return state
  const k = state.tickets.findIndex((t) => t.seat === action.seat)
  if (action.type === 'order') {
    if (!menuById(action.menu) || k >= 0) return state
    next.tickets.push({ seat: action.seat, menu: action.menu, ready: false })
  } else if (action.type === 'cook') {
    // 기본 재료만 여기서 뺀다(농장 재료는 농장 저장소에서 뺀다: cookTicket)
    const t = state.tickets[k]
    const m = t && menuById(t.menu)
    if (!t || t.ready || !m) return state
    const pantryNeed = needList(m).filter(({ id }) => !isCrop(id)) as { id: PantryId; n: number }[]
    if (pantryNeed.some(({ id, n }) => state.pantry[id] < n)) return state
    for (const { id, n } of pantryNeed) next.pantry[id] -= n
    next.tickets[k] = { ...t, ready: true }
  } else {
    if (k < 0 || !state.tickets[k].ready) return state
    next.tickets.splice(k, 1)
  }
  return next
}

const KEY = 'ryuso.kitchen.v1'
function read(): KitchenState { try { return sanitizeKitchen(JSON.parse(localStorage.getItem(KEY) ?? 'null')) } catch { return defaultKitchen() } }
let state = read()
const listeners = new Set<() => void>()
export const getKitchen = () => state
export const subscribeKitchen = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export function actKitchen(action: KitchenAction): 'saved' | 'invalid' | 'failed' {
  if (isRestoring()) return 'failed'
  const next = reduceKitchen(state, action)
  if (next === state) return 'invalid'
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { return 'failed' }
  state = next; listeners.forEach((fn) => fn()); return 'saved'
}

/** 기본 재료 한 묶음을 농장 코인으로 산다 */
export function buyPantry(id: PantryId): boolean {
  if (getFarm().coins < PACK_PRICE) return false
  if (actFarm({ type: 'spend', amount: PACK_PRICE }) !== 'saved') return false
  if (actKitchen({ type: 'buy', id }) === 'saved') return true
  actFarm({ type: 'earn', amount: PACK_PRICE }) // 못 넣었으면 코인을 돌려준다
  return false
}

/** 다 만들었을 때: 재료가 모두 있는지 먼저 보고, 농장 재료와 기본 재료를 빼고 주문서를 완성으로 바꾼다 */
export function cookTicket(seat: number): boolean {
  const t = state.tickets.find((x) => x.seat === seat)
  const m = t && menuById(t.menu)
  if (!t || t.ready || !m || missing(t.menu, state, getFarm()).length) return false
  const crops = Object.fromEntries(needList(m).filter(({ id }) => isCrop(id)).map(({ id, n }) => [id, n]))
  if (Object.keys(crops).length && actFarm({ type: 'use', items: crops }) !== 'saved') return false
  return actKitchen({ type: 'cook', seat }) === 'saved'
}
