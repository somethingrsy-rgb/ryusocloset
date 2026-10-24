import { actFarm, getFarm } from './farm'
import { findItem, isFound, travelPool } from './game'
import { isRestoring } from './restoreGuard'
import { readRainRecord } from './starRain'

export type Currency = 'star' | 'coin'

/** 상점 가격 (농장 코인 🪙 기준). 별 ⭐ 으로 사면 STAR_PRICE_MULT 배. 종류별로 한 곳에서 고친다. */
export const SHOP_PRICE: Record<string, number> = { shoes: 30, accessory: 40, wand: 50, costume: 60, room: 20 }
export const STAR_PRICE_MULT = 6
export const priceOf = (category: string, currency: Currency = 'coin') => (SHOP_PRICE[category] ?? 40) * (currency === 'star' ? STAR_PRICE_MULT : 1)
export interface Wallet { stars: number; coins: number }

const RAIN_KEY = 'ryuso.starRain.v1'

/** 쓸 수 있는 별 = 모은 별 − 쓴 별, 코인은 농장 코인 */
export function readWallet(): Wallet {
  const rain = readRainRecord()
  return { stars: Math.max(0, rain.total - rain.spent), coins: getFarm().coins }
}

export const canAfford = (wallet: Wallet, currency: Currency, price: number) => (currency === 'star' ? wallet.stars : wallet.coins) >= price

/** 별 쓰기: 모은 별이 모자라면 false */
export function spendStars(amount: number): boolean {
  if (isRestoring() || !Number.isInteger(amount) || amount <= 0) return false
  const rain = readRainRecord()
  if (rain.total - rain.spent < amount) return false
  try {
    localStorage.setItem(RAIN_KEY, JSON.stringify({ ...rain, spent: rain.spent + amount }))
    return true
  } catch {
    return false
  }
}

/** 별 받기(놀이 보상): 모은 별에 더한다 */
export function earnStars(amount: number): boolean {
  if (isRestoring() || !Number.isInteger(amount) || amount <= 0) return false
  const rain = readRainRecord()
  try {
    localStorage.setItem(RAIN_KEY, JSON.stringify({ ...rain, total: rain.total + amount }))
    return true
  } catch {
    return false
  }
}

export type BuyResult = 'bought' | 'owned' | 'poor' | 'unknown' | 'failed'

/** 아이템을 산다: 값을 낸 뒤 '찾은 아이템'에 넣는다. 이미 가졌으면 값을 받지 않는다. */
export function buyItem(id: string, currency: Currency): BuyResult {
  const item = travelPool().find((i) => i.id === id)
  if (!item) return 'unknown'
  if (isFound(id)) return 'owned'
  const price = priceOf(item.category, currency)
  if (!canAfford(readWallet(), currency, price)) return 'poor'
  const paid = currency === 'star' ? spendStars(price) : actFarm({ type: 'spend', amount: price }) === 'saved'
  if (!paid) return 'failed'
  findItem(id)
  return 'bought'
}
