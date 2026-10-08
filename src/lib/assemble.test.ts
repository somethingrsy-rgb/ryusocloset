import { describe, expect, it } from 'vitest'
import { BOTTOMS, HEADS, SHOES, TOPS, defaultAssembly, randomAssembly, sanitizeAssembly, takeOffPart, togglePart } from './assemble'

describe('assemble', () => {
  it('부품이 있다 (머리 1+, 상의 9, 하의 9, 신발 5)', () => {
    expect(HEADS.length).toBeGreaterThan(0)
    expect(TOPS.length).toBe(9)
    expect(BOTTOMS.length).toBe(9)
    expect(SHOES.length).toBe(5)
    for (const p of [...HEADS, ...TOPS, ...BOTTOMS, ...SHOES]) {
      expect(p.box.w).toBeGreaterThan(0)
      expect(p.box.h).toBeGreaterThan(0)
    }
  })
  it('기본 조합은 머리가 있다', () => {
    expect(defaultAssembly().head).toBe(HEADS[0].id)
  })
  it('같은 상의·하의를 다시 고르면 벗고, 머리는 교체만 된다', () => {
    const a = defaultAssembly()
    const t = TOPS[1].id
    expect(togglePart(a, 'top', t).top).toBe(t)
    expect(togglePart(togglePart(a, 'top', t), 'top', t).top).toBeUndefined()
    expect(togglePart(a, 'head', a.head).head).toBe(a.head)
  })
  it('부품을 바꾸거나 벗으면 그 칸의 위치·크기 조절은 사라지고 다른 칸은 유지된다', () => {
    const a = { head: HEADS[0].id, top: TOPS[0].id, bottom: BOTTOMS[0].id, tweaks: { top: { dx: 5, dy: 0, scale: 1.2 }, bottom: { dx: 0, dy: 9, scale: 1 } } }
    const swapped = togglePart(a, 'top', TOPS[1].id)
    expect(swapped.tweaks).toEqual({ bottom: { dx: 0, dy: 9, scale: 1 } })
    expect(takeOffPart(swapped, 'bottom').tweaks).toBeUndefined()
    expect(takeOffPart(a, 'head')).toBe(a) // 머리는 벗지 않는다
  })
  it('저장 데이터 검증: 모르는 id·잘못된 칸은 버리고 머리는 항상 있다', () => {
    expect(sanitizeAssembly(null).head).toBe(HEADS[0].id)
    expect(sanitizeAssembly({ head: 'nope', top: 'nope', bottom: TOPS[0].id })).toEqual({ head: HEADS[0].id })
    const ok = sanitizeAssembly({
      head: HEADS[0].id,
      top: TOPS[2].id,
      bottom: BOTTOMS[0].id,
      tweaks: { top: { dx: 10, dy: 0, scale: 9 }, head: { dx: 0, dy: 0, scale: 1 }, bottom: 'x' },
    })
    expect(ok.top).toBe(TOPS[2].id)
    expect(ok.bottom).toBe(BOTTOMS[0].id)
    expect(ok.tweaks).toEqual({ top: { dx: 10, dy: 0, scale: 1.6 } }) // 범위 보정, 원래 값(head)·잘못된 값은 제거
  })
  it('신발도 입고 벗을 수 있고, 잘못된 칸의 id 는 버린다', () => {
    const a = defaultAssembly()
    const on = togglePart(a, 'shoes', SHOES[0].id)
    expect(on.shoes).toBe(SHOES[0].id)
    expect(takeOffPart(on, 'shoes').shoes).toBeUndefined()
    expect(sanitizeAssembly({ head: HEADS[0].id, shoes: TOPS[0].id }).shoes).toBeUndefined()
    expect(sanitizeAssembly({ head: HEADS[0].id, shoes: SHOES[1].id }).shoes).toBe(SHOES[1].id)
  })
  it('랜덤 조합은 유효하다', () => {
    for (let i = 0; i < 50; i++) {
      const r = randomAssembly()
      expect(TOPS.some((t) => t.id === r.top)).toBe(true)
      expect(BOTTOMS.some((b) => b.id === r.bottom)).toBe(true)
      expect(SHOES.some((b) => b.id === r.shoes)).toBe(true)
    }
  })
})
