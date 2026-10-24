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
  it('점프는 땅에서만, 한 번 뛰면 다시 땅에 내려온다', () => {
    let s = newRun(1)
    s = jump(s); s = stepRun(s, 0.05)
    expect(s.y).toBeGreaterThan(0)
    const air = jump(s)
    expect(air.vy).toBe(s.vy) // 공중에서는 다시 못 뛴다
    s = run(s, 1.2)
    expect(s.y).toBe(0)
  })
  it('하트를 다 써서 끝나도 모은 코인은 별로 받고 보너스는 없다', () => {
    expect(rewardStars({ coins: 6, over: 'hurt' })).toBe(6)
    expect(rewardStars({ coins: 6, over: 'done' })).toBe(16)
  })
})
