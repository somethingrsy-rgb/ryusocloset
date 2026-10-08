import { describe, expect, it } from 'vitest'
import { randomOutfit, sanitizeOutfit, toggleItem, wornItems } from './outfit'
import { CATEGORIES, LAYER_Z, type Category } from './layers'
import type { Item } from './types'

const mk = (id: string, category: Category): Item => ({
  id,
  category,
  name: { ko: id, en: id },
  color: null,
  colorName: null,
  colorHex: null,
  box: { x: 0, y: 0, w: 10, h: 10 },
  image: `${id}.webp`,
  thumb: `${id}.webp`,
  zIndex: LAYER_Z[category],
})

const items = [
  mk('top1', 'top'), mk('top2', 'top'), mk('bottom1', 'bottom'), mk('dress1', 'dress'),
  mk('outer1', 'outer'), mk('shoes1', 'shoes'), mk('acc1', 'accessory'), mk('bag1', 'bag'),
]
const byId = Object.fromEntries(items.map((i) => [i.id, i]))
const byCategory = Object.fromEntries(
  CATEGORIES.map((c) => [c, items.filter((i) => i.category === c)]),
) as Record<Category, Item[]>

describe('toggleItem', () => {
  it('같은 카테고리는 교체한다', () => {
    const o = toggleItem(toggleItem({}, byId.top1), byId.top2)
    expect(o).toEqual({ top: 'top2' })
  })
  it('같은 옷을 다시 누르면 벗는다', () => {
    expect(toggleItem({ top: 'top1' }, byId.top1)).toEqual({})
  })
  it('원피스를 입으면 상의/하의가 해제된다', () => {
    expect(toggleItem({ top: 'top1', bottom: 'bottom1', shoes: 'shoes1' }, byId.dress1)).toEqual({
      dress: 'dress1',
      shoes: 'shoes1',
    })
  })
  it('상의/하의를 입으면 원피스가 해제된다', () => {
    expect(toggleItem({ dress: 'dress1' }, byId.top1)).toEqual({ top: 'top1' })
    expect(toggleItem({ dress: 'dress1' }, byId.bottom1)).toEqual({ bottom: 'bottom1' })
  })
  it('상의 없이 아우터만 입을 수 있다', () => {
    expect(toggleItem({}, byId.outer1)).toEqual({ outer: 'outer1' })
  })
  it('원본 객체를 변경하지 않는다', () => {
    const o = { top: 'top1' }
    toggleItem(o, byId.top2)
    expect(o).toEqual({ top: 'top1' })
  })
})

describe('sanitizeOutfit', () => {
  it('모르는 id와 카테고리 불일치는 버린다', () => {
    expect(sanitizeOutfit({ top: 'nope', bottom: 'top1', shoes: 'shoes1', foo: 'x' }, byId)).toEqual({ shoes: 'shoes1' })
  })
  it('원피스와 상하의가 같이 있으면 원피스를 우선한다', () => {
    expect(sanitizeOutfit({ dress: 'dress1', top: 'top1' }, byId)).toEqual({ dress: 'dress1' })
  })
  it('이름이 바뀐 id 는 별칭으로 이어받는다', () => {
    expect(sanitizeOutfit({ top: 'old_top', shoes: 'shoes1' }, byId, { old_top: 'top1' })).toEqual({ top: 'top1', shoes: 'shoes1' })
    expect(sanitizeOutfit({ top: 'old_top' }, byId, { old_top: 'bottom1' })).toEqual({})
  })
  it('이상한 입력도 빈 코디로', () => {
    expect(sanitizeOutfit(null, byId)).toEqual({})
    expect(sanitizeOutfit('x', byId)).toEqual({})
  })
})

describe('wornItems', () => {
  it('아래→위 순서로 정렬한다', () => {
    const o = { bag: 'bag1', outer: 'outer1', top: 'top1', shoes: 'shoes1' }
    expect(wornItems(o, byId).map((i) => i.category)).toEqual(['shoes', 'top', 'outer', 'bag'])
  })
})

describe('randomOutfit', () => {
  it('항상 유효한 조합을 만든다', () => {
    for (let n = 0; n < 200; n++) {
      const o = randomOutfit(byCategory)
      if (o.dress) expect(o.top || o.bottom).toBeFalsy()
      else expect(o.top && o.bottom).toBeTruthy()
      for (const c of CATEGORIES) if (o[c]) expect(byId[o[c]!].category).toBe(c)
    }
  })
  it('rng 에 따라 결정적이다', () => {
    expect(randomOutfit(byCategory, () => 0)).toEqual({ dress: 'dress1', outer: 'outer1', shoes: 'shoes1', accessory: 'acc1', bag: 'bag1' })
    expect(randomOutfit(byCategory, () => 0.99)).toEqual({ top: 'top2', bottom: 'bottom1' })
  })
})
