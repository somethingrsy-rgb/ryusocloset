import { describe, expect, it } from 'vitest'
import { AGES, EMPTY, GOAL, LEVELS, addCorrect, addProfile, isCleared, isUnlocked, levelsFor, makeChoices, removeProfile, sanitizeState, type Profile } from './mathGame'

const seeded = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const kid = (age: 6 | 8): Profile => ({ id: 'x', name: '아이', age, correct: {}, gifts: {} })

describe('아이 수학 게임', () => {
  it('모든 단계의 문제는 정답이 보기에 한 번만 있고 보기는 겹치지 않는다', () => {
    for (const lv of LEVELS) {
      const r = seeded(lv.id)
      for (let i = 0; i < 300; i++) {
        const q = lv.make(r)
        expect(q.choices.length).toBeGreaterThanOrEqual(2)
        expect(new Set(q.choices).size).toBe(q.choices.length)
        expect(q.choices.filter((c) => c === q.answer)).toHaveLength(1)
        expect(q.choices.every((c) => Number.isInteger(c) && c >= 0)).toBe(true)
      }
    }
  })
  it('그림 문제는 그림 개수로 정답이 나온다', () => {
    const r = seeded(5)
    for (const lv of LEVELS.filter((l) => l.age === 6)) {
      for (let i = 0; i < 200; i++) {
        const q = lv.make(r)
        if (!q.visual) continue
        const { a, b = 0, op } = q.visual
        expect(q.answer).toBe(op === '+' ? a + b : op === '−' ? a - b : a)
        expect(a).toBeLessThanOrEqual(10)
      }
    }
  })
  it('글자 문제는 계산한 값과 정답이 같다', () => {
    const r = seeded(7)
    for (const lv of LEVELS.filter((l) => l.age === 8)) {
      for (let i = 0; i < 200; i++) {
        const q = lv.make(r)
        const [a, op, b] = q.text.replace(' = ?', '').split(' ')
        const x = Number(a), y = Number(b)
        expect(q.answer).toBe(op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y)
      }
    }
  })
  it('6살 단계는 쉽다: 세기는 10 이하, 보기는 1 이상, 큰 수 고르기는 두 개', () => {
    const r = seeded(11)
    for (let i = 0; i < 200; i++) {
      for (const id of [1, 2]) {
        const q = LEVELS[id - 1].make(r)
        expect(q.answer).toBeLessThanOrEqual(10)
        expect(q.choices.every((c) => c >= 1)).toBe(true)
      }
      const b = LEVELS[2].make(r)
      expect(b.choices).toHaveLength(2)
      expect(b.answer).toBe(Math.max(...b.choices))
    }
  })
  it('보기를 만들 수 없을 만큼 작은 정답도 처리한다', () => {
    expect(makeChoices(0, seeded(1))).toHaveLength(4)
    expect(makeChoices(1, seeded(1), 4, 1)).toHaveLength(4)
  })
  it('나이마다 단계가 따로이고, 앞 단계를 깨면 다음 단계가 열린다', () => {
    expect(levelsFor(6).every((l) => l.age === 6)).toBe(true)
    expect(levelsFor(8).every((l) => l.age === 8)).toBe(true)
    expect(AGES.flatMap((a) => levelsFor(a))).toHaveLength(LEVELS.length)
    for (const age of AGES) {
      let p = kid(age)
      const list = levelsFor(age)
      expect(isUnlocked(p, list[0].id)).toBe(true)
      expect(isUnlocked(p, list[1].id)).toBe(false)
      let cleared = 0
      for (let i = 0; i < GOAL + 3; i++) {
        const r = addCorrect(p, list[0].id)
        p = r.next
        if (r.justCleared) cleared++
      }
      expect(cleared).toBe(1)
      expect(isCleared(p, list[0].id)).toBe(true)
      expect(isUnlocked(p, list[1].id)).toBe(true)
    }
    expect(isUnlocked(kid(6), levelsFor(8)[0].id)).toBe(false)
  })
  it('아이 추가·삭제, 이름 비우기·최대 인원 제한, 저장 데이터 정리', () => {
    let s = EMPTY
    expect(addProfile(s, '   ', 6).id).toBeNull()
    const a = addProfile(s, '  하늘  ', 6); s = a.next
    const b = addProfile(s, '바다', 8); s = b.next
    expect(s.profiles.map((p) => [p.name, p.age])).toEqual([['하늘', 6], ['바다', 8]])
    expect(a.id).not.toBe(b.id)
    for (let i = 0; i < 6; i++) s = addProfile(s, `아이${i}`, 6).next
    expect(s.profiles).toHaveLength(4)
    expect(removeProfile(s, a.id!).profiles.some((p) => p.id === a.id)).toBe(false)
    const dirty = sanitizeState({ profiles: [{ id: 'a', name: 'ㅁ'.repeat(30), age: 7, correct: {} }, { id: 'b', name: '좋아', age: 8, correct: { 7: 99, 8: -3, 999: 1 }, gifts: { 7: 'x' } }, null, 5] })
    expect(dirty.profiles).toHaveLength(1)
    expect(dirty.profiles[0].correct).toEqual({ 7: GOAL, 8: 0 })
    expect(dirty.profiles[0].gifts).toEqual({ 7: 'x' })
    expect(sanitizeState('boom')).toEqual(EMPTY)
  })
})
