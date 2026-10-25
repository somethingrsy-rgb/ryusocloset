import { describe, expect, it } from 'vitest'
import { CROPS, defaultFarm, reduceFarm } from './farm'
import { defaultKitchen, missing, reduceKitchen, sanitizeKitchen } from './kitchen'
import { MENU, PACK, PANTRY, STEPS, ingredient, needList } from './recipes'

describe('레시피', () => {
  it('모든 메뉴의 재료·단계가 실제로 있고, 요리해서 팔면 재료를 그냥 파는 것보다 더 번다', () => {
    const ids = new Set<string>([...CROPS.map((c) => c.id), ...PANTRY.map((p) => p.id)])
    for (const m of MENU) {
      expect(needList(m).length).toBeGreaterThan(0)
      for (const { id, n } of needList(m)) { expect(ids.has(id)).toBe(true); expect(n).toBeGreaterThan(0); expect(ingredient(id).emoji).toBeTruthy() }
      expect(m.steps.length).toBeGreaterThan(0)
      for (const s of m.steps) expect(STEPS[s]).toBeTruthy()
      const cropValue = needList(m).reduce((s, { id, n }) => s + n * (CROPS.find((c) => c.id === id)?.price ?? 0), 0)
      expect(m.price).toBeGreaterThan(cropValue)
    }
    expect(new Set(MENU.map((m) => m.id)).size).toBe(MENU.length)
    // 농장 재료 세 가지가 모두 어떤 메뉴에든 쓰인다
    for (const c of CROPS) expect(MENU.some((m) => (m.need[c.id] ?? 0) > 0)).toBe(true)
  })
})

describe('농장 재료 꺼내 쓰기', () => {
  it('모두 충분할 때만 한꺼번에 빼고, 하나라도 모자라면 아무것도 안 뺀다', () => {
    const farm = { ...defaultFarm(), inventory: { carrot: 1, strawberry: 3, corn: 0 } }
    expect(reduceFarm(farm, { type: 'use', items: { strawberry: 2, carrot: 2 } }, 0)).toBe(farm)
    expect(reduceFarm(farm, { type: 'use', items: { strawberry: 0 } }, 0)).toBe(farm)
    expect(reduceFarm(farm, { type: 'use', items: {} }, 0)).toBe(farm)
    const next = reduceFarm(farm, { type: 'use', items: { strawberry: 2, carrot: 1 } }, 0)
    expect(next.inventory).toEqual({ carrot: 0, strawberry: 1, corn: 0 })
  })
})

describe('주방 주문서', () => {
  it('주문 → 완성(기본 재료 빠짐) → 서빙하면 지워진다', () => {
    let k = defaultKitchen()
    k = reduceKitchen(k, { type: 'order', seat: 2, menu: 'shake' })
    expect(reduceKitchen(k, { type: 'order', seat: 2, menu: 'latte' })).toBe(k) // 한 자리에 주문서는 하나
    expect(reduceKitchen(k, { type: 'serve', seat: 2 })).toBe(k) // 아직 안 만들었으면 서빙 못 함
    const milk = k.pantry.milk
    k = reduceKitchen(k, { type: 'cook', seat: 2 })
    expect(k.tickets[0].ready).toBe(true)
    expect(k.pantry.milk).toBe(milk - 1)
    expect(reduceKitchen(k, { type: 'cook', seat: 2 })).toBe(k) // 두 번 만들지 않음
    k = reduceKitchen(k, { type: 'serve', seat: 2 })
    expect(k.tickets).toHaveLength(0)
  })
  it('기본 재료가 모자라면 못 만들고, 사면 3개씩 늘어난다', () => {
    let k = { ...defaultKitchen(), pantry: { ...defaultKitchen().pantry, coffee: 0 } }
    k = reduceKitchen(k, { type: 'order', seat: 0, menu: 'latte' })
    expect(reduceKitchen(k, { type: 'cook', seat: 0 })).toBe(k)
    expect(missing('latte', k, defaultFarm()).map((x) => x.id)).toEqual(['coffee'])
    k = reduceKitchen(k, { type: 'buy', id: 'coffee' })
    expect(k.pantry.coffee).toBe(PACK)
    expect(missing('latte', k, defaultFarm())).toEqual([])
  })
  it('모자란 농장 재료를 알려 준다', () => {
    const farm = { ...defaultFarm(), inventory: { carrot: 0, strawberry: 1, corn: 0 } }
    expect(missing('shake', defaultKitchen(), farm)).toEqual([{ id: 'strawberry', n: 2 }])
  })
  it('저장된 값이 이상해도 안전하게 읽는다', () => {
    const k = sanitizeKitchen({ pantry: { milk: -3, ice: 'x', egg: 4.7 }, tickets: [{ seat: 1, menu: 'latte', ready: true }, { seat: 1, menu: 'shake' }, { seat: 9, menu: 'latte' }, { seat: 3, menu: 'nope' }, null] })
    expect(k.pantry.milk).toBe(0)
    expect(k.pantry.ice).toBe(0)
    expect(k.pantry.egg).toBe(4)
    expect(k.tickets).toEqual([{ seat: 1, menu: 'latte', ready: true }])
    expect(sanitizeKitchen('garbage')).toEqual(defaultKitchen())
  })
})
