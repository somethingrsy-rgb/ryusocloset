import { describe, expect, it } from 'vitest'
import { PLAYER_SCREEN_X, LEVELS, LEVEL_IDS, START_HEARTS, jump, newRun, rewardStars, slotContent, speedAt, stepRun, visible, type RunState } from './runner'

const run = (s: RunState, secs: number, jumper?: (s: RunState) => boolean) => {
  for (let t = 0; t < secs * 60 && !s.over; t++) {
    if (jumper?.(s)) s = jump(s)
    s = stepRun(s, 1 / 60)
  }
  return s
}
/** 앞에 장애물이 가까우면 뛰는 사람 */
const smart = (s: RunState) => {
  const px = s.x + PLAYER_SCREEN_X
  return visible(s.seed, px, px + 260, s.level).obstacles.some((o) => o.x - px > 0 && o.x - px < speedAt(s.elapsed, s.level) * 0.42)
}

describe('달려라 아바타', () => {
  it('같은 씨앗이면 늘 같은 장애물·코인, 장애물 사이는 충분히 떨어져 있다', () => {
    expect(slotContent(7, 3)).toEqual(slotContent(7, 3))
    for (const level of LEVEL_IDS) {
      const { obstacles } = visible(7, 0, 20000, level)
      expect(obstacles.length).toBeGreaterThan(5)
      for (let i = 1; i < obstacles.length; i++) expect(obstacles[i].x - obstacles[i - 1].x).toBeGreaterThanOrEqual(LEVELS[level].slot)
    }
  })
  it('가만히 있으면 장애물에 부딪혀 하트가 줄고 끝날 수 있다', () => {
    const s = run(newRun(7), 45)
    expect(s.hearts).toBeLessThan(START_HEARTS)
  })
  it('단계마다 알맞게 뛰면 끝까지 달리고 별을 모으며 보너스를 받는다', () => {
    for (const level of LEVEL_IDS) {
      for (const seed of [1, 7, 42, 99, 1234, 5, 6, 8]) {
        const s = run(newRun(seed, level), LEVELS[level].duration + 1, smart)
        expect(s.over, `${level} seed ${seed}`).toBe('done')
        expect(s.hearts, `${level} seed ${seed}`).toBe(START_HEARTS)
        expect(s.coins).toBeGreaterThan(0)
        expect(rewardStars(s)).toBe(s.coins + LEVELS[level].bonus)
      }
    }
  })
  it('높은 단계일수록 빠르고, 장애물이 촘촘하고, 오래 달리고, 보너스가 크다', () => {
    const [e, n, h] = LEVEL_IDS.map((l) => LEVELS[l])
    expect(e.speed).toBeLessThan(n.speed); expect(n.speed).toBeLessThan(h.speed)
    expect(e.slot).toBeGreaterThan(n.slot); expect(n.slot).toBeGreaterThan(h.slot)
    expect(e.chance).toBeLessThan(n.chance); expect(n.chance).toBeLessThan(h.chance)
    expect(e.bonus).toBeLessThan(n.bonus); expect(n.bonus).toBeLessThan(h.bonus)
    // 장애물 사이는 점프 한 번(약 0.9초)과 다시 뛸 준비를 할 만큼 항상 떨어져 있다
    for (const level of LEVEL_IDS) {
      const end = LEVELS[level].speed + LEVELS[level].up * LEVELS[level].duration
      expect(LEVELS[level].slot / end, level).toBeGreaterThan(1.05)
    }
  })
  it('점프는 땅에서 한 번, 공중에서 한 번 더(두 번까지), 세 번째는 안 된다', () => {
    let s = newRun(1)
    s = jump(s); s = stepRun(s, 0.05)
    expect(s.y).toBeGreaterThan(0); expect(s.jumps).toBe(1)
    const vy1 = s.vy
    s = jump(s); s = stepRun(s, 0.05)
    expect(s.jumps).toBe(2); expect(s.vy).toBeGreaterThan(vy1 - 200) // 다시 위로 솟는다
    const third = jump(s)
    expect(third.vy).toBe(s.vy) // 세 번째는 안 된다
    s = run(s, 2)
    expect(s.y).toBe(0); expect(s.jumps).toBe(0)
  })
  it('높이 뜬 선물 상자는 한 번 뛰어서는 못 먹고, 두 번 뛰어야 먹는다', () => {
    let seed = 1, slot = 0
    outer: for (seed = 1; seed < 80; seed++) for (slot = 3; slot < 30; slot++) if (slotContent(seed, slot).gift) break outer
    const g = slotContent(seed, slot).gift!
    const at = (jumps: number) => {
      let s = newRun(seed)
      s = { ...s, x: g.x - PLAYER_SCREEN_X - 330, taken: [], hearts: 99 }
      let did = 0
      for (let t = 0; t < 200; t++) {
        const dist = g.x - (s.x + PLAYER_SCREEN_X)
        if (did === 0 && dist < 230) { s = jump(s); did = 1 }
        else if (jumps === 2 && did === 1 && s.vy < 120 && s.y > 120) { s = jump(s); did = 2 }
        s = stepRun(s, 1 / 60)
      }
      return s.gifts
    }
    expect(at(1)).toBe(0)
    expect(at(2)).toBe(1)
  })
  it('하트를 다 써서 끝나도 모은 코인은 별로 받고 보너스는 없다', () => {
    expect(rewardStars({ coins: 6, over: 'hurt' })).toBe(6)
    expect(rewardStars({ coins: 6, over: 'done' })).toBe(16)
  })
})
