import { describe, expect, it } from 'vitest'
import { FH, FW, MATCH_SECONDS, newMatch, splitAnimals, stepMatch, type Act, type Match, type Vec } from './soccer'

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

/**
 * 아이 흉내 선수(빨강 팀): 0.3초마다 손가락을 공 쪽으로 옮기고(조금 빗나가게), 공을 잡으면 상대 골대 쪽으로 몰다가
 * 골대에 가까워지면 슛 버튼을 누른다. skill 은 손가락을 대고 있는 비율·정확도
 */
export function kidBot(skill: number) {
  let tgt: Vec = { x: 50, y: 30 }, re = 0
  return (m: Match, dt: number, rnd: () => number): { target: Vec | null; act: Act | null } => {
    const me = m.players.findIndex((p) => p.team === 0 && p.role === 'human')
    re -= dt
    if (m.hold === me) {
      const p = m.players[me]
      if (re <= 0) { re = 0.3; tgt = { x: Math.min(FW - 2, p.x + 15), y: Math.max(5, Math.min(FH - 5, FH / 2 + (rnd() - 0.5) * 20)) } }
      const act: Act | null = FW - p.x < 30 && rnd() < 0.08 * skill ? 'shoot' : rnd() < 0.004 ? 'pass' : null
      return { target: rnd() < skill ? tgt : null, act }
    }
    if (re <= 0) { re = 0.25 + (1 - skill) * 0.5; tgt = { x: Math.max(1, Math.min(FW - 1, m.ball.x - 2 + (rnd() - 0.5) * 10 * (1 - skill))), y: Math.max(1, Math.min(FH - 1, m.ball.y + (rnd() - 0.5) * 10 * (1 - skill))) } }
    return { target: rnd() < skill ? tgt : null, act: null }
  }
}

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
  it('아바타가 공으로 달려가면 공을 잡아 몰고, 슛 버튼을 누르면 상대 골대 쪽으로 세게 찬다', () => {
    let m = newMatch(['yuha', 'yuel'], [[0, 1, 2, 3], [4, 5, 6, 7]])
    m = { ...m, pause: 0 }
    let trapped = false
    for (let t = 0; t < 120 && !trapped; t++) {
      const r = stepMatch(m, 1 / 60, [{ x: m.ball.x - 1, y: m.ball.y }, null], () => 0.5)
      m = r.m
      if (r.events.includes('trap')) trapped = true
    }
    expect(trapped).toBe(true)
    // 공을 가진 채 아래로 걸으면 공이 발 앞(아래쪽)에 붙어 따라온다
    const me = m.hold
    for (let t = 0; t < 20; t++) m = stepMatch(m, 1 / 60, [{ x: m.players[me].x, y: m.players[me].y + 10 }, null], () => 0.5).m
    expect(m.hold).toBe(me)
    expect(m.ball.y).toBeGreaterThan(m.players[me].y + 1)
    const r = stepMatch(m, 1 / 60, [null, null], () => 0.5, ['shoot', null])
    expect(r.events).toContain('shoot')
    expect(r.m.ball.vx).toBeGreaterThan(60)
    expect(r.m.hold).toBe(-1)
  })
  it('공을 가진 채 멈춰 있으면 저절로 차고, 패스 버튼은 같은 팀 동물 쪽으로 굴린다', () => {
    let m = newMatch(['yuha', 'yuel'], [[0, 1, 2, 3], [4, 5, 6, 7]])
    const me = m.players.findIndex((p) => p.team === 0 && p.role === 'human')
    m = { ...m, pause: 0, hold: me, holdIdle: 0 }
    let auto = false
    for (let t = 0; t < 60 && !auto; t++) { const r = stepMatch(m, 1 / 60, [null, null], () => 0.5); m = r.m; if (r.events.includes('kick')) auto = true }
    expect(auto).toBe(true)
    let m2 = newMatch(['yuha', 'yuel'], [[0, 1, 2, 3], [4, 5, 6, 7]])
    m2 = { ...m2, pause: 0, hold: me, holdIdle: 0 }
    const r = stepMatch(m2, 1 / 60, [null, null], () => 0.5, ['pass', null])
    expect(r.events).toContain('pass')
    // 굴러간 쪽에 같은 팀 동물이 있다
    const dir = { x: r.m.ball.vx, y: r.m.ball.vy }
    const ok = r.m.players.some((p) => p.team === 0 && p.role === 'field' && ((p.x - r.m.ball.x) * dir.x + (p.y - r.m.ball.y) * dir.y) / Math.hypot(p.x - r.m.ball.x, p.y - r.m.ball.y) / Math.hypot(dir.x, dir.y) > 0.95)
    expect(ok).toBe(true)
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

describe('축구: 혼자 하기 이길 확률', () => {
  it('아이 흉내 선수로 여러 판 하면 대체로 10판에 7판쯤 이긴다(5~8.5판)', { timeout: 30000 }, () => {
    let win = 0, lose = 0
    for (let s = 1; s <= 60; s++) {
      const rnd = seeded(s * 7919)
      let m: Match = newMatch(['yuha', 'yuel'], splitAnimals(rnd), [false, true])
      const kid = kidBot(0.85)
      for (let t = 0; t < (MATCH_SECONDS + 45) * 30 && !m.over; t++) {
        const k = kid(m, 1 / 30, rnd)
        m = stepMatch(m, 1 / 30, [k.target, null], rnd, [k.act, null]).m
      }
      if (m.score[0] > m.score[1]) win++; else if (m.score[0] < m.score[1]) lose++
    }
    const share = win / (win + lose)
    expect(share).toBeGreaterThan(0.5)
    expect(share).toBeLessThan(0.85)
  })
})
