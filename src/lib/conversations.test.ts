import { describe, expect, it } from 'vitest'
import { REACTIONS, SCENARIOS, heartsLeft, shuffled, starsFor } from './conversations'
import { finishMission, getGame } from './game'

describe('영어 대화 미션 데이터', () => {
  it('모든 차례에는 정답 보기가 정확히 하나, 보기는 3개 이상이고 설명이 있다', () => {
    const ids = new Set<string>()
    for (const s of SCENARIOS) {
      expect(ids.has(s.id)).toBe(false)
      ids.add(s.id)
      expect(s.title.length).toBeGreaterThan(1)
      expect(s.turns.length).toBeGreaterThanOrEqual(3)
      for (const t of s.turns) {
        expect(t.npc.length).toBeGreaterThan(3)
        expect(t.ko.length).toBeGreaterThan(2)
        expect(t.options.length).toBeGreaterThanOrEqual(3)
        expect(t.options.filter((o) => o.ok)).toHaveLength(1)
        expect(new Set(t.options.map((o) => o.text)).size).toBe(t.options.length)
        for (const o of t.options) expect(o.tip.length).toBeGreaterThan(5)
      }
    }
  })
  it('일상과 직장 미션이 모두 충분히 있다', () => {
    expect(SCENARIOS.filter((s) => s.kind === 'daily').length).toBeGreaterThanOrEqual(6)
    expect(SCENARIOS.filter((s) => s.kind === 'business').length).toBeGreaterThanOrEqual(6)
    expect(REACTIONS.length).toBeGreaterThan(0)
  })
  it('섞어도 보기는 그대로 다 있다', () => {
    const t = SCENARIOS[0].turns[0].options
    expect(shuffled(t, () => 0.3).map((o) => o.text).sort()).toEqual(t.map((o) => o.text).sort())
  })
  it('틀린 횟수에 따라 별과 하트가 정해진다', () => {
    expect([0, 1, 2, 3, 9].map(starsFor)).toEqual([3, 2, 2, 1, 1])
    expect([0, 1, 3, 9].map(heartsLeft)).toEqual([3, 2, 0, 0])
  })
})

describe('미션 기록', () => {
  it('처음 마치면 first, 별 3개를 처음 받으면 perfect, 최고 기록만 남는다', () => {
    const id = 'test_mission'
    expect(finishMission(id, 2)).toEqual({ first: true, perfect: false })
    expect(getGame().missions[id]).toBe(2)
    expect(finishMission(id, 1)).toEqual({ first: false, perfect: false })
    expect(getGame().missions[id]).toBe(2)
    expect(finishMission(id, 3)).toEqual({ first: false, perfect: true })
    expect(finishMission(id, 3)).toEqual({ first: false, perfect: false })
    expect(getGame().missions[id]).toBe(3)
  })
})
