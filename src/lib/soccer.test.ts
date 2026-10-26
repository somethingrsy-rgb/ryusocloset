import { describe, expect, it } from 'vitest'
import { FH, FW, MATCH_SECONDS, newMatch, splitAnimals, stepMatch, type Match } from './soccer'

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

describe('축구', () => {
  it('팀마다 아바타 1명과 동물 4명(골키퍼 1)', () => {
    const m = newMatch(['yuha', 'yuel'], [[0, 1, 2, 3], [4, 5, 6, 7]])
    for (const t of [0, 1]) {
      const mine = m.players.filter((p) => p.team === t)
      expect(mine).toHaveLength(5)
      expect(mine.filter((p) => p.role === 'human')).toHaveLength(1)
      expect(mine.filter((p) => p.role === 'keeper')).toHaveLength(1)
    }
  })
  it('동물 친구들끼리만 뛰어도 골이 나고, 모두 경기장 안에 있고, 2분 뒤 끝난다', () => {
    const rnd = seeded(5)
    let m: Match = newMatch(['yuha', 'yuel'], splitAnimals(rnd))
    let goals = 0, ended = false
    for (let t = 0; t < MATCH_SECONDS * 60 + 10; t++) {
      const r = stepMatch(m, 1 / 60, [null, null], rnd)
      m = r.m
      goals += r.events.filter((e) => e.startsWith('goal')).length
      if (r.events.includes('end')) ended = true
      for (const p of m.players) { expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(FW); expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(FH) }
    }
    expect(ended).toBe(true)
    expect(goals).toBeGreaterThan(0)
    expect(m.score[0] + m.score[1]).toBe(goals)
  })
  it('아바타가 공으로 달려가면 상대 골대 쪽으로 찬다', () => {
    let m = newMatch(['yuha', 'yuel'], [[0, 1, 2, 3], [4, 5, 6, 7]])
    m = { ...m, pause: 0 }
    let kicked = false
    for (let t = 0; t < 120 && !kicked; t++) {
      const r = stepMatch(m, 1 / 60, [{ x: m.ball.x - 1, y: m.ball.y }, null], () => 0.5)
      m = r.m
      if (r.events.includes('kick') && m.ball.vx > 0) kicked = true
    }
    expect(kicked).toBe(true)
  })
  it('팀 나누기는 8마리를 겹치지 않게 4마리씩', () => {
    const [a, b] = splitAnimals(seeded(2))
    expect(a).toHaveLength(4); expect(b).toHaveLength(4)
    expect(new Set([...a, ...b]).size).toBe(8)
  })
})
