import { describe, expect, it } from 'vitest'
import { AGES, CLEAR_STARS, EMPTY, LEVELS, addCorrect, addProfile, claimStars, isCleared, isUnlocked, levelsFor, removeProfile, sanitizeState, totalOf, type Profile } from './mathGame'
import { EIGHT_TOPICS, SIX_TOPICS } from './mathQuestions'

const SIX = SIX_TOPICS.flatMap((t) => t.questions)
const EIGHT = EIGHT_TOPICS.flatMap((t) => t.questions)

const kid = (age: 6 | 8): Profile => ({ id: 'x', name: '아이', age, correct: {}, gifts: {} })

describe('아이 수학 게임', () => {
  it('나이마다 80문제가 비슷한 문제끼리 묶여 있다 (6세 8묶음, 8세 9묶음)', () => {
    expect(SIX).toHaveLength(80)
    expect(EIGHT).toHaveLength(80)
    expect(levelsFor(6)).toHaveLength(8)
    expect(levelsFor(8)).toHaveLength(9)
    expect(levelsFor(6).every((l) => l.questions.length === 10)).toBe(true)
    expect(levelsFor(8).map((l) => l.questions.length)).toEqual([10, 8, 10, 10, 10, 8, 8, 8, 8])
  })
  it('같은 문제 글이 같은 그림으로 두 번 나오지 않는다', () => {
    for (const list of [SIX, EIGHT]) {
      const keys = list.map((q) => q.text + JSON.stringify(q.visual ?? null) + (q.kind === 'choice' ? JSON.stringify(q.choices) : q.kind === 'order' ? q.cards.join() : ''))
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
  it('객관식은 6세 3지선다·8세 4지선다이고 정답 번호가 보기 안에 있다', () => {
    for (const [list, n] of [[SIX, 3], [EIGHT, 4]] as const) {
      for (const q of list) {
        if (q.kind !== 'choice') continue
        expect(q.choices).toHaveLength(n)
        expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < n).toBe(true)
      }
    }
  })
  it('객관식 정답 위치가 한쪽에 몰리지 않는다', () => {
    for (const [list, n] of [[SIX, 3], [EIGHT, 4]] as const) {
      const c = new Array(n).fill(0)
      for (const q of list) if (q.kind === 'choice') c[q.answer]++
      expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(2)
    }
  })
  it('순서 배열 카드는 서로 다르고, 숫자 입력 정답은 자연수이다', () => {
    for (const q of [...SIX, ...EIGHT]) {
      if (q.kind === 'order') expect(new Set(q.cards).size).toBe(q.cards.length)
      if (q.kind === 'input') expect(Number.isInteger(q.answer) && q.answer > 0 && q.answer < 1000).toBe(true)
    }
  })
  it('6세는 모든 수가 10 이하이다', () => {
    for (const q of SIX) {
      if (q.kind === 'input') expect(q.answer).toBeLessThanOrEqual(10)
      if (q.kind === 'order') expect(Math.max(...q.cards)).toBeLessThanOrEqual(10)
      if (q.visual?.kind === 'groups') for (const g of q.visual.groups) expect(g.n).toBeLessThanOrEqual(10)
    }
  })
  it('그림의 개수로 계산한 값이 정답과 같다 (더하기·빼기 그림 문제)', () => {
    const qs = [...SIX, ...EIGHT].filter((q) => q.kind === 'choice' && q.visual?.kind === 'groups' && (q.visual.op || q.visual.groups.some((g) => g.cross)))
    expect(qs.length).toBeGreaterThanOrEqual(5)
    for (const q of qs) {
      if (q.kind !== 'choice' || q.visual?.kind !== 'groups') continue
      const v = q.visual
      const value = v.op ? v.groups.reduce((a, g) => a + g.n, 0) : v.groups[0].n - (v.groups[0].cross ?? 0)
      expect(Number(q.choices[q.answer].label)).toBe(value)
    }
  })
  it('모든 문제에 문제 글과 풀이가 있다', () => {
    for (const q of [...SIX, ...EIGHT]) {
      expect(q.text.length).toBeGreaterThan(3)
      expect(q.why.length).toBeGreaterThan(3)
    }
  })
  it('나이마다 단계가 따로이고, 앞 단계를 깨면 다음 단계가 열린다', () => {
    expect(levelsFor(6).every((l) => l.age === 6)).toBe(true)
    expect(levelsFor(8).every((l) => l.age === 8)).toBe(true)
    expect(AGES.flatMap((a) => levelsFor(a))).toHaveLength(LEVELS.length)
    for (const age of AGES) {
      let p = kid(age)
      const list = levelsFor(age)
      expect(isUnlocked(p, list[0].id)).toBe(true)
      expect(isUnlocked(p, list[1].id)).toBe(true) // 잠금 없음
      let cleared = 0
      for (let i = 1; i <= totalOf(list[0].id) + 3; i++) {
        const r = addCorrect(p, list[0].id, i)
        p = r.next
        if (r.justCleared) cleared++
      }
      expect(cleared).toBe(1)
      expect(addCorrect(p, list[0].id, 1).next).toBe(p) // 기록은 줄지 않는다
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
    const dirty = sanitizeState({ profiles: [{ id: 'a', name: 'ㅁ'.repeat(30), age: 7, correct: {} }, { id: 'b', name: '좋아', age: 8, correct: { 9: 99, 10: -3, 999: 1 }, gifts: { 9: 'x' } }, null, 5] })
    expect(dirty.profiles).toHaveLength(1)
    expect(dirty.profiles[0].correct).toEqual({ 9: 10, 10: 0 })
    expect(dirty.profiles[0].gifts).toEqual({ 9: 'x' })
    expect(sanitizeState('boom')).toEqual(EMPTY)
  })
  it('단계를 다 풀면 별 30개를 한 번만 받는다(아이템은 주지 않는다)', () => {
    const p = kid(6)
    const a = claimStars(p, 1)
    expect(a.stars).toBe(CLEAR_STARS); expect(CLEAR_STARS).toBe(30); expect(a.next.gifts[1]).toBe('star')
    expect(claimStars(a.next, 1).stars).toBe(0)
    expect(claimStars({ ...p, gifts: { 1: 'old_item' } }, 1).stars).toBe(0) // 예전에 아이템을 받은 단계는 다시 주지 않음
  })
})
