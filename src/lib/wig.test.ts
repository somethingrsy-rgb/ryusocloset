import { beforeEach, describe, expect, it } from 'vitest'
import { AVATARS, setAvatar, setHairstyle } from './avatars'
import { ITEMS_BY_CATEGORY, baseFor } from './items'
import { LAYER_Z } from './layers'
import { sanitizeOutfit, wornItems } from './outfit'
import { ITEM_BY_ID } from './items'

describe('가발(wig)', () => {
  beforeEach(() => { setAvatar('ryuso'); setHairstyle(AVATARS[0], 'bob') })
  it('가발 아이템이 있고 몸 바로 위, 신발·옷 아래에 그려진다', () => {
    expect(ITEMS_BY_CATEGORY.wig.length).toBeGreaterThanOrEqual(3)
    expect(ITEMS_BY_CATEGORY.wig.every((i) => i.zIndex === LAYER_Z.wig)).toBe(true)
    expect(LAYER_Z.wig).toBeLessThan(Math.min(LAYER_Z.shoes, LAYER_Z.bottom, LAYER_Z.top))
  })
  it('가발을 쓰면 기본 머리 레이어를 숨기고, 단발이 그려진 류소는 머리 없는 몸을 쓴다', () => {
    expect(baseFor({}).hair).not.toBeNull()
    expect(baseFor({}).body).toMatch(/assets\/base\/body\.webp$/)
    const w = baseFor({ wig: 'wig_pigtails' })
    expect(w.hair).toBeNull()
    expect(w.body).toMatch(/assets\/base\/body_bald\.webp$/)
    expect(baseFor({ wig: 'wig_pigtails', shoes: 'x' }).body).toMatch(/body_bald_barefoot\.webp$/)
  })
  it('다른 아바타는 몸은 그대로 두고 머리 레이어만 숨긴다', () => {
    setAvatar('yuha')
    const w = baseFor({ wig: 'wig_pigtails' })
    expect(w.hair).toBeNull()
    expect(w.body).toMatch(/assets\/base\/yuha\/body\.webp$/)
    expect(baseFor({}).hair).not.toBeNull()
  })
  it('저장된 코디에서 가발을 불러오고 착용 목록에 낀다', () => {
    const outfit = sanitizeOutfit({ wig: 'wig_layered' }, ITEM_BY_ID)
    expect(outfit.wig).toBe('wig_layered')
    expect(wornItems(outfit, ITEM_BY_ID).map((i) => i.category)).toEqual(['wig'])
  })
})
