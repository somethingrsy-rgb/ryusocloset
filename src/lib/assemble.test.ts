import { describe, expect, it } from 'vitest'
import { BOTTOMS, HEADS, TOPS, defaultAssembly, randomAssembly, sanitizeAssembly, togglePart } from './assemble'

describe('assemble', () => {
  it('부품이 있다 (머리 1+, 상의 9, 하의는 새로 그린 것만)', () => {
    expect(HEADS.length).toBeGreaterThan(0)
    expect(TOPS.length).toBe(9)
    expect(BOTTOMS.length).toBeGreaterThan(0)
    for (const b of BOTTOMS) expect(b.category).toBe('bottom')
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
  it('저장 데이터 검증: 모르는 id 는 버리고 머리는 항상 있다', () => {
    expect(sanitizeAssembly(null).head).toBe(HEADS[0].id)
    const s = sanitizeAssembly({ head: 'nope', top: 'nope', bottom: TOPS[0].id })
    expect(s).toEqual({ head: HEADS[0].id })
    const ok = sanitizeAssembly({ head: HEADS[0].id, top: TOPS[2].id, bottom: BOTTOMS[0].id })
    expect(ok).toEqual({ head: HEADS[0].id, top: TOPS[2].id, bottom: BOTTOMS[0].id })
  })
  it('랜덤 조합은 유효하다', () => {
    for (let i = 0; i < 50; i++) {
      const r = randomAssembly()
      expect(TOPS.some((t) => t.id === r.top)).toBe(true)
      expect(BOTTOMS.some((b) => b.id === r.bottom)).toBe(true)
    }
  })
})
