import { isRestoring } from './restoreGuard'
export const CROPS = [
  { id: 'strawberry', ko: '딸기', en: 'strawberry', plural: 'strawberries', emoji: '🍓', seconds: 60, price: 5 },
  { id: 'carrot', ko: '당근', en: 'carrot', plural: 'carrots', emoji: '🥕', seconds: 30, price: 3 },
  { id: 'corn', ko: '옥수수', en: 'corn', plural: 'corn', emoji: '🌽', seconds: 45, price: 6 },
] as const
export type CropId = (typeof CROPS)[number]['id']
/** 처음부터 내 것인 밭 칸 수 (앞의 9칸). 나머지는 코인으로 한 칸씩 산다 */
export const FREE_PLOTS = 9
/** 밭 칸 전체 수: 넓은 풀밭 하나에 20칸 */
export const PLOT_COUNT = 20
/** 우리 안 동물: 젖소는 우유, 닭은 달걀을 준다. 한 번 받으면 다시 받을 때까지 2분 */
export const ANIMAL_SECONDS = 120
export type AnimalGood = 'milk' | 'egg'
export interface Plot { crop: CropId; wateredAt: number | null }
export interface FarmState {
  plots: (Plot | null)[]; /** 산 밭 칸 (앞의 9칸은 처음부터 true) */ owned: boolean[]; inventory: Record<CropId, number>; coins: number; deliveries: number; decorations: string[]; /** 마지막으로 우유·달걀을 받은 때(0 = 바로 받을 수 있음) */ barn: Record<AnimalGood, number>
}
export type FarmAction = { type: 'plant'; plot: number; crop: CropId } | { type: 'water' | 'harvest'; plot: number } | { type: 'deliver' } | { type: 'sell'; crop: CropId } | { type: 'decorate'; id: 'fence' | 'flowers' } | { type: 'spend'; amount: number } | { type: 'earn'; amount: number } | { type: 'buy'; plot: number } | { type: 'use'; items: Partial<Record<CropId, number>> } | { type: 'collect'; good: AnimalGood }
/** 새 땅 밭 한 칸 값: 처음 20코인, 하나 살 때마다 5코인씩 올라간다 */
export const PLOT_BASE_PRICE = 20
export const PLOT_PRICE_STEP = 5
const startOwned = () => Array.from({ length: PLOT_COUNT }, (_, i) => i < FREE_PLOTS)
export const boughtCount = (state: Pick<FarmState, 'owned'>) => state.owned.filter((v, i) => v && i >= FREE_PLOTS).length
export const plotPrice = (state: Pick<FarmState, 'owned'>) => PLOT_BASE_PRICE + PLOT_PRICE_STEP * boughtCount(state)
export const defaultFarm = (): FarmState => ({ plots: Array(PLOT_COUNT).fill(null), owned: startOwned(), inventory: { carrot: 0, strawberry: 0, corn: 0 }, coins: 0, deliveries: 0, decorations: [], barn: { milk: 0, egg: 0 } })
const cropById = (id: unknown) => CROPS.find(c => c.id === id)
/** 예전 저장의 토마토는 옥수수로 이어간다 */
const migrateCrop = (id: unknown) => (id === 'tomato' ? 'corn' : id)
const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1_000_000, Math.floor(v))) : 0
export function sanitizeFarm(value: unknown): FarmState {
  const base = defaultFarm()
  if (!value || typeof value !== 'object') return base
  const raw = value as Partial<FarmState>
  base.plots = Array.from({ length: PLOT_COUNT }, (_, i) => {
    const p = Array.isArray(raw.plots) ? raw.plots[i] : null
    const crop = migrateCrop(p?.crop)
    if (!p || !cropById(crop)) return null
    return { crop: crop as CropId, wateredAt: typeof p.wateredAt === 'number' && Number.isFinite(p.wateredAt) && p.wateredAt >= 0 ? p.wateredAt : null }
  })
  base.owned = Array.from({ length: PLOT_COUNT }, (_, i) => i < FREE_PLOTS || (Array.isArray(raw.owned) && raw.owned[i] === true))
  for (const crop of CROPS) base.inventory[crop.id] = count(raw.inventory?.[crop.id])
  base.inventory.corn = Math.min(1_000_000, base.inventory.corn + count((raw.inventory as Record<string, unknown> | undefined)?.tomato))
  base.coins = count(raw.coins); base.deliveries = count(raw.deliveries)
  for (const g of ['milk', 'egg'] as const) { const t = (raw.barn as Record<string, unknown> | undefined)?.[g]; base.barn[g] = typeof t === 'number' && Number.isFinite(t) && t >= 0 ? t : 0 }
  base.decorations = Array.isArray(raw.decorations) ? [...new Set(raw.decorations.filter(id => id === 'fence' || id === 'flowers'))] : []
  return base
}
export function growth(plot: Plot | null, now: number): number {
  if (!plot || plot.wateredAt === null) return 0
  const crop = cropById(plot.crop)!
  return Math.min(1, Math.max(0, (now - plot.wateredAt) / (crop.seconds * 1000)))
}
/** 노점 주문 차례(당근 → 딸기 → 옥수수). 화면에 보이는 작물 순서(CROPS)를 바꿔도 주문 차례는 그대로 둔다 */
const ORDER_TURN: CropId[] = ['carrot', 'strawberry', 'corn']
export const orderCrop = (state: FarmState) => CROPS.find((c) => c.id === ORDER_TURN[state.deliveries % ORDER_TURN.length])!
/** 우유·달걀을 다시 받을 수 있을 때까지 남은 초(0 이면 지금 받을 수 있다) */
export const animalWait = (state: Pick<FarmState, 'barn'>, good: AnimalGood, now: number) => Math.max(0, Math.ceil((state.barn[good] + ANIMAL_SECONDS * 1000 - now) / 1000))
export const animalReady = (state: Pick<FarmState, 'barn'>, good: AnimalGood, now: number) => !state.barn[good] || animalWait(state, good, now) === 0
export function reduceFarm(state: FarmState, action: FarmAction, now: number): FarmState {
  const next: FarmState = { ...state, plots: [...state.plots], owned: [...state.owned], inventory: { ...state.inventory }, decorations: [...state.decorations], barn: { ...state.barn } }
  if ('plot' in action) {
    if (!Number.isInteger(action.plot) || action.plot < 0 || action.plot >= PLOT_COUNT) return state
    const plot = state.plots[action.plot]
    if (action.type === 'buy') {
      if (state.owned[action.plot] || state.coins < plotPrice(state)) return state
      next.coins -= plotPrice(state); next.owned[action.plot] = true
    } else if (!state.owned[action.plot]) {
      return state
    } else if (action.type === 'plant') {
      if (plot || !cropById(action.crop)) return state
      next.plots[action.plot] = { crop: action.crop, wateredAt: null }
    } else if (action.type === 'water') {
      if (!plot || plot.wateredAt !== null) return state
      next.plots[action.plot] = { ...plot, wateredAt: now }
    } else {
      if (!plot || growth(plot, now) < 1) return state
      next.plots[action.plot] = null; next.inventory[plot.crop]++
    }
  } else if (action.type === 'deliver') {
    const crop = orderCrop(state)
    if (state.inventory[crop.id] < 2) return state
    next.inventory[crop.id] -= 2; next.coins += 12; next.deliveries++
  } else if (action.type === 'sell') {
    const crop = cropById(action.crop)
    if (!crop || !state.inventory[crop.id]) return state
    next.inventory[crop.id]--; next.coins += crop.price
  } else if (action.type === 'earn') {
    if (!Number.isInteger(action.amount) || action.amount <= 0 || action.amount > 1000) return state
    next.coins += action.amount
  } else if (action.type === 'collect') {
    if (!(action.good in state.barn) || !animalReady(state, action.good, now)) return state
    next.barn[action.good] = now
  } else if (action.type === 'use') {
    // 주방에서 요리할 때: 모두 충분할 때만 한꺼번에 빼고, 하나라도 모자라면 아무것도 빼지 않는다
    const items = Object.entries(action.items ?? {})
    if (!items.length || items.some(([id, n]) => !cropById(id) || !Number.isInteger(n) || n! <= 0 || state.inventory[id as CropId] < n!)) return state
    for (const [id, n] of items) next.inventory[id as CropId] -= n!
  } else if (action.type === 'spend') {
    if (!Number.isInteger(action.amount) || action.amount <= 0 || state.coins < action.amount) return state
    next.coins -= action.amount
  } else {
    const price = action.id === 'fence' ? 20 : action.id === 'flowers' ? 30 : Infinity
    if (state.decorations.includes(action.id) || state.coins < price) return state
    next.coins -= price; next.decorations.push(action.id)
  }
  return next
}
const KEY = 'ryuso.farm.v1'
function read(): FarmState { try { return sanitizeFarm(JSON.parse(localStorage.getItem(KEY) ?? 'null')) } catch { return defaultFarm() } }
let state = read()
const listeners = new Set<() => void>()
export const getFarm = () => state
export const subscribeFarm = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export function actFarm(action: FarmAction, now = Date.now()): 'saved' | 'invalid' | 'failed' {
  if (isRestoring()) return 'failed'
  const next = reduceFarm(state, action, now)
  if (next === state) return 'invalid'
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { return 'failed' }
  state = next; listeners.forEach(fn => fn()); return 'saved'
}
