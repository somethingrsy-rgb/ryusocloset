import { describe, expect, it } from 'vitest'
import { EMPTY, GOAL, LEVELS, addCorrect, isCleared, isUnlocked, withChoices } from './mathGame'

const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)

describe('mathGame', () => {
  it('모든 단계의 문제는 정답이 보기에 한 번만 있고 보기는 4개다', () => {
    for (const lv of LEVELS) {
      const r = seeded(lv.id)
      for (let i = 0; i < 300; i++) {
        const q = lv.make(r)
        expect(q.choices).toHaveLength(4)
        expect(new Set(q.choices).size).toBe(4)
        expect(q.choices.filter((c) => c === q.answer)).toHaveLength(1)
        expect(q.choices.every((c) => Number.isInteger(c) && c >= 0)).toBe(true)
      }
    }
  })
  it('정답을 계산해서 확인한다', () => {
    const r = seeded(7)
    for (const lv of LEVELS) {
      for (let i = 0; i < 200; i++) {
        const q = lv.make(r)
        const [a, op, b] = q.text.replace(' = ?', '').split(' ')
        const x = Number(a), y = Number(b)
        const want = op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y
        expect(q.answer).toBe(want)
      }
    }
  })
  it('단계 제한을 지킨다', () => {
    const r = seeded(3)
    for (let i = 0; i < 300; i++) {
      const q1 = LEVELS[0].make(r)
      expect(q1.answer).toBeLessThanOrEqual(10)
      expect(LEVELS[3].make(r).answer).toBeLessThanOrEqual(99)
    }
  })
  it('보기를 만들 수 없을 만큼 작은 정답도 처리한다', () => {
    expect(withChoices('0 + 0 = ?', 0, seeded(1)).choices).toHaveLength(4)
  })
  it('목표를 채우면 한 번만 클리어되고 다음 단계가 열린다', () => {
    let p = EMPTY
    expect(isUnlocked(p, 1)).toBe(true)
    expect(isUnlocked(p, 2)).toBe(false)
    let cleared = 0
    for (let i = 0; i < GOAL + 3; i++) {
      const r = addCorrect(p, 1)
      p = r.next
      if (r.justCleared) cleared++
    }
    expect(cleared).toBe(1)
    expect(isCleared(p, 1)).toBe(true)
    expect(p.correct[1]).toBe(GOAL)
    expect(isUnlocked(p, 2)).toBe(true)
  })
})
