import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function stubStorage(init: Record<string, string>) {
  const data = new Map(Object.entries(init))
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), key: (i: number) => [...data.keys()][i] ?? null, get length() { return data.size } })
  return data
}
const load = async () => ({ shop: await import('./shop'), game: await import('./game'), farm: await import('./farm') })

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

describe('shop', () => {
  it('별은 모은 별에서 쓴 별을 뺀 만큼만 쓸 수 있다', async () => {
    stubStorage({ 'ryuso.starRain.v1': JSON.stringify({ best: 20, total: 50, rounds: 3, spent: 10 }) })
    const { shop } = await load()
    expect(shop.readWallet().stars).toBe(40)
    expect(shop.spendStars(41)).toBe(false)
    expect(shop.spendStars(40)).toBe(true)
    expect(shop.readWallet().stars).toBe(0)
    expect(shop.spendStars(1)).toBe(false)
  })
  it('쓴 별이 모은 별보다 크게 저장돼 있어도 지갑이 음수가 되지 않는다', async () => {
    stubStorage({ 'ryuso.starRain.v1': JSON.stringify({ total: 5, spent: 999 }) })
    const { shop } = await load()
    expect(shop.readWallet().stars).toBe(0)
  })
  it('별로 사면 값을 내고 찾은 아이템이 되며, 두 번 사도 값을 한 번만 낸다', async () => {
    stubStorage({ 'ryuso.starRain.v1': JSON.stringify({ best: 0, total: 500, rounds: 1, spent: 0 }) })
    const { shop, game } = await load()
    const item = game.travelPool().find((i) => i.kind === 'clothing')!
    const price = shop.priceOf(item.category, 'star')
    expect(game.isFound(item.id)).toBe(false)
    expect(shop.buyItem(item.id, 'star')).toBe('bought')
    expect(game.isFound(item.id)).toBe(true)
    expect(shop.readWallet().stars).toBe(500 - price)
    expect(shop.buyItem(item.id, 'star')).toBe('owned')
    expect(shop.readWallet().stars).toBe(500 - price)
  })
  it('별로 사는 값은 코인 값의 3배이고, 별을 받으면 쓸 수 있는 별이 는다', async () => {
    stubStorage({})
    const { shop } = await load()
    expect(shop.priceOf('costume', 'coin')).toBe(60); expect(shop.priceOf('costume', 'star')).toBe(180)
    expect(shop.priceOf('shoes', 'star')).toBe(90)
    expect(shop.readWallet().stars).toBe(0)
    expect(shop.earnStars(60)).toBe(true); expect(shop.earnStars(0)).toBe(false)
    expect(shop.readWallet().stars).toBe(60)
  })
  it('코인으로도 사고, 모자라면 사지 못하고 아무것도 바뀌지 않는다', async () => {
    stubStorage({ 'ryuso.farm.v1': JSON.stringify({ coins: 35 }) })
    const { shop, game, farm } = await load()
    const shoes = game.travelPool().find((i) => i.category === 'shoes')!
    const costume = game.travelPool().find((i) => i.category === 'costume')!
    expect(shop.buyItem(costume.id, 'coin')).toBe('poor')
    expect(game.isFound(costume.id)).toBe(false)
    expect(shop.buyItem(shoes.id, 'coin')).toBe('bought')
    expect(farm.getFarm().coins).toBe(35 - shop.priceOf('shoes'))
    expect(shop.buyItem('nothing', 'coin')).toBe('unknown')
  })
  it('농장 spend 동작은 모자라거나 이상한 값이면 아무것도 하지 않는다', async () => {
    stubStorage({})
    const { farm } = await load()
    const s = farm.defaultFarm()
    expect(farm.reduceFarm({ ...s, coins: 10 }, { type: 'spend', amount: 11 }, 0)).toEqual({ ...s, coins: 10 })
    expect(farm.reduceFarm({ ...s, coins: 10 }, { type: 'spend', amount: -5 }, 0).coins).toBe(10)
    expect(farm.reduceFarm({ ...s, coins: 10 }, { type: 'spend', amount: 4 }, 0).coins).toBe(6)
  })
})
