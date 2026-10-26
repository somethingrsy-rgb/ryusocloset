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

describe('축구: 몸 겹치지 않기·1인 게임', () => {
  it('경기 내내 선수끼리 몸(반지름 7.5)이 거의 겹치지 않는다', () => {
    const rnd = seeded(8)
    let m: Match = newMatch(['yuha', 'yuel'], splitAnimals(rnd), [false, true])
    let bad = 0, frames = 0
    for (let t = 0; t < 60 * 60; t++) {
      m = stepMatch(m, 1 / 60, [{ x: m.ball.x, y: m.ball.y }, null], rnd).m
      frames++
      for (let i = 0; i < m.players.length; i++) for (let j = i + 1; j < m.players.length; j++) {
        const a = m.players[i], c = m.players[j]
        if (Math.hypot(a.x - c.x, a.y - c.y) < 7.5 * 0.8) bad++
      }
    }
    expect(bad / frames).toBeLessThan(0.05)
  })
  it('1인 게임에서는 보라 팀 아바타를 컴퓨터가 움직여 공을 찬다', () => {
    const rnd = seeded(4)
    let m: Match = newMatch(['yuha', 'yuel'], [[0, 1, 2, 3], [4, 5, 6, 7]], [false, true])
    const start = m.players.find((p) => p.team === 1 && p.role === 'human')!
    let moved = 0, kicks = 0
    for (let t = 0; t < 60 * 20; t++) {
      const r = stepMatch(m, 1 / 60, [null, null], rnd); m = r.m
      const now = m.players.find((p) => p.team === 1 && p.role === 'human')!
      moved = Math.max(moved, Math.hypot(now.x - start.x, now.y - start.y))
      if (r.events.includes('kick') && Math.hypot(now.x - m.ball.x, now.y - m.ball.y) < 8) kicks++
    }
    expect(moved).toBeGreaterThan(3)
    expect(kicks).toBeGreaterThan(0)
  })
})
