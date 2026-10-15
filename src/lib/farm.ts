import { isRestoring } from './restoreGuard'
export const CROPS = [
  { id: 'carrot', ko: '당근', en: 'carrot', plural: 'carrots', emoji: '🥕', seconds: 60, price: 3 },
  { id: 'tomato', ko: '토마토', en: 'tomato', plural: 'tomatoes', emoji: '🍅', seconds: 90, price: 4 },
  { id: 'strawberry', ko: '딸기', en: 'strawberry', plural: 'strawberries', emoji: '🍓', seconds: 120, price: 5 },
] as const
export type CropId = (typeof CROPS)[number]['id']
export interface Plot { crop: CropId; wateredAt: number | null }
export interface FarmState {
  plots: (Plot | null)[]; inventory: Record<CropId, number>; coins: number; deliveries: number; decorations: string[]
}
export type FarmAction = { type: 'plant'; plot: number; crop: CropId } | { type: 'water' | 'harvest'; plot: number } | { type: 'deliver' } | { type: 'sell'; crop: CropId } | { type: 'decorate'; id: 'fence' | 'flowers' } | { type: 'spend'; amount: number }
export const defaultFarm = (): FarmState => ({ plots: Array(6).fill(null), inventory: { carrot: 0, tomato: 0, strawberry: 0 }, coins: 0, deliveries: 0, decorations: [] })
const cropById = (id: unknown) => CROPS.find(c => c.id === id)
const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1_000_000, Math.floor(v))) : 0
export function sanitizeFarm(value: unknown): FarmState {
  const base = defaultFarm()
  if (!value || typeof value !== 'object') return base
  const raw = value as Partial<FarmState>
  base.plots = Array.from({ length: 6 }, (_, i) => {
    const p = Array.isArray(raw.plots) ? raw.plots[i] : null
    if (!p || !cropById(p.crop)) return null
    return { crop: p.crop, wateredAt: typeof p.wateredAt === 'number' && Number.isFinite(p.wateredAt) && p.wateredAt >= 0 ? p.wateredAt : null }
  })
  for (const crop of CROPS) base.inventory[crop.id] = count(raw.inventory?.[crop.id])
  base.coins = count(raw.coins); base.deliveries = count(raw.deliveries)
  base.decorations = Array.isArray(raw.decorations) ? [...new Set(raw.decorations.filter(id => id === 'fence' || id === 'flowers'))] : []
  return base
}
export function growth(plot: Plot | null, now: number): number {
  if (!plot || plot.wateredAt === null) return 0
  const crop = cropById(plot.crop)!
  return Math.min(1, Math.max(0, (now - plot.wateredAt) / (crop.seconds * 1000)))
}
export const orderCrop = (state: FarmState) => CROPS[state.deliveries % CROPS.length]
export function reduceFarm(state: FarmState, action: FarmAction, now: number): FarmState {
  const next: FarmState = { ...state, plots: [...state.plots], inventory: { ...state.inventory }, decorations: [...state.decorations] }
  if ('plot' in action) {
    if (!Number.isInteger(action.plot) || action.plot < 0 || action.plot >= 6) return state
    const plot = state.plots[action.plot]
    if (action.type === 'plant') {
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
