import { describe, expect, it } from 'vitest'
import { NPCS, rpsResult } from './npcs'
import { PLACES, assignPlaces, inPool, pickReward, spotFor } from './game'

describe('여행 게임', () => {
  const ids = Array.from({ length: 53 }, (_, i) => `item_${i}`)
  it('모든 아이템이 정확히 한 장소에 숨는다', () => {
    const a = assignPlaces(ids)
    const all = Object.values(a).flat()
    expect(all.sort()).toEqual([...ids].sort())
    expect(Object.keys(a)).toHaveLength(PLACES.length)
  })
  it('장소마다 고르게 나뉜다 (차이 1 이하)', () => {
    const sizes = Object.values(assignPlaces(ids)).map((l) => l.length)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  })
  it('목록 순서가 달라도 같은 결과다', () => {
    expect(assignPlaces([...ids].reverse())).toEqual(assignPlaces(ids))
  })
  it('숨은 자리는 화면 안이고 같은 장소 안에서 겹치지 않는다', () => {
    const list = assignPlaces(ids)[PLACES[0].id]
    const spots = list.map((id, i) => spotFor(id, i))
    for (const s of spots) {
      expect(s.x).toBeGreaterThan(0); expect(s.x).toBeLessThan(100)
      expect(s.y).toBeGreaterThan(0); expect(s.y).toBeLessThan(100)
    }
    expect(new Set(spots.map((s) => `${Math.round(s.x / 8)},${Math.round(s.y / 8)}`)).size).toBe(spots.length)
  })
  it('기본 상의·하의, 내가 추가한 옷은 게임 대상이 아니다', () => {
    expect(inPool({ id: 'top_a', category: 'top', native: true })).toBe(false)
    expect(inPool({ id: 'custom_1', category: 'costume', native: true })).toBe(false)
    expect(inPool({ id: 'costume_a', category: 'costume', native: true })).toBe(true)
  })
})

describe('이벤트 보상', () => {
  const assign = { a: ['a1', 'a2'], b: ['b1'] }
  it('이 장소에 남은 것 중에서 고른다', () => {
    expect(pickReward(assign, ['a1'], 'a', 'here', () => 0)).toBe('a2')
  })
  it('이 장소가 다 찼으면 다른 곳에서 고른다', () => {
    expect(pickReward(assign, ['a1', 'a2'], 'a', 'here', () => 0)).toBe('b1')
  })
  it('전부 찾았으면 null', () => {
    expect(pickReward(assign, ['a1', 'a2', 'b1'], 'a', 'any')).toBeNull()
  })
})

describe('NPC', () => {
  it('모든 장소에 NPC 가 있고 퀴즈 NPC 는 정답이 보기 안에 있다', () => {
    for (const p of PLACES) {
      const n = NPCS[p.id]
      expect(n, p.id).toBeTruthy()
      expect(n.lines.length).toBeGreaterThan(0)
      if (n.event === 'quiz') expect(n.quiz!.answer).toBeLessThan(n.quiz!.choices.length)
    }
  })
  it('가위바위보 판정', () => {
    expect(rpsResult('rock', 'scissors')).toBe('win')
    expect(rpsResult('rock', 'paper')).toBe('lose')
    expect(rpsResult('paper', 'paper')).toBe('draw')
  })
})
