import { describe, expect, it } from 'vitest'
import { PLAYER_SCREEN_X, LEVELS, LEVEL_IDS, startHearts, jump, newRun, rewardStars, slotContent, speedAt, stepRun, visible, type RunState } from './runner'

const run = (s: RunState, secs: number, jumper?: (s: RunState) => boolean) => {
  for (let t = 0; t < secs * 60 && !s.over; t++) {
    if (jumper?.(s)) s = jump(s)
    s = stepRun(s, 1 / 60)
  }
  return s
}
/** 앞에 장애물이 가까우면 뛰는 사람 */
const smart = (s: RunState) => {
  if (s.jumps > 0) return false // 땅에서만 한 번 누른다(공중에서 또 누르면 두 번 점프가 된다)
  const px = s.x + PLAYER_SCREEN_X
  return visible(s.seed, px, px + 260 * s.k, s.level, s.k).obstacles.some((o) => o.x - px > 0 && o.x - px < speedAt(s.elapsed, s.level) * s.k * 0.42)
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
  it('초급은 하트 5개, 나머지는 3개로 시작한다', () => {
    expect(newRun(1, 'easy').hearts).toBe(5)
    expect(newRun(1, 'normal').hearts).toBe(3)
    expect(newRun(1, 'hard').hearts).toBe(3)
  })
  it('가만히 있으면 장애물에 부딪혀 하트가 줄고 끝날 수 있다', () => {
    const s = run(newRun(7), 45)
    expect(s.hearts).toBeLessThan(startHearts(s.level))
  })
  it('단계마다 알맞게 뛰면 끝까지 달리고 별을 모으며 보너스를 받는다', () => {
    for (const level of LEVEL_IDS) {
      for (const seed of [1, 7, 42, 99, 1234, 5, 6, 8]) {
        const s = run(newRun(seed, level), LEVELS[level].duration + 1, smart)
        expect(s.over, `${level} seed ${seed}`).toBe('done')
        expect(s.hearts, `${level} seed ${seed}`).toBe(startHearts(level))
        expect(s.coins).toBeGreaterThan(0)
        expect(rewardStars(s)).toBe(s.coins + LEVELS[level].bonus)
      }
    }
  })
  it('넓은 화면(k)일수록 빨리 달리고 장애물 간격도 같은 비율로 넓어져, 그래도 끝까지 달릴 수 있다', () => {
    for (const level of LEVEL_IDS) {
      for (const k of [1.5, 2, 2.2]) {
        for (const seed of [1, 7, 42, 99]) {
          const s = run(newRun(seed, level, k), LEVELS[level].duration + 1, smart)
          expect(s.over, `${level} k${k} seed ${seed}`).toBe('done')
          expect(s.hearts, `${level} k${k} seed ${seed}`).toBe(startHearts(level))
        }
      }
    }
    const a = run(newRun(3, 'normal', 1), 5); const b = run(newRun(3, 'normal', 2), 5)
    expect(b.x / a.x).toBeCloseTo(2, 1)
  })
  it('장애물 위 별 3개는 알맞게 뛰면 모두 먹을 수 있다(단계·화면 폭·타이밍이 조금 달라도)', () => {
    for (const k of [1, 2]) for (const level of LEVEL_IDS) for (const f of [0.38, 0.45, 0.52]) {
      let got = 0, passed = 0
      for (const seed of [1, 7, 42]) {
        let s = newRun(seed, level, k)
        for (let t = 0; t < 60 * 55 && !s.over; t++) {
          const px = s.x + PLAYER_SCREEN_X
          if (s.jumps === 0 && visible(seed, px, px + 300 * k, level, k).obstacles.some((o) => o.x - px > 0 && o.x - px < speedAt(s.elapsed, level) * k * f)) s = jump(s)
          s = stepRun(s, 1 / 60)
        }
        const obs = visible(seed, 0, s.x + 300, level, k).obstacles.filter((o) => o.x < s.x + PLAYER_SCREEN_X - 10)
        passed += obs.length
        got += s.taken.filter((id) => obs.some((o) => id > o.id && id <= o.id + 3)).length
      }
      expect(got / passed, `k${k} ${level} lead ${f}`).toBeGreaterThan(2.8)
    }
  })
  it('점프는 낮고 두 번 점프해도 너무 높이 솟지 않는다(아바타가 화면 밖으로 나가지 않게)', () => {
    let max = 0
    for (const at of [0.05, 0.15, 0.25, 0.35, 0.43, 0.55]) {
      let s = jump(newRun(1)); let m = 0
      for (let t = 0; t < at; t += 1 / 60) { s = stepRun(s, 1 / 60); m = Math.max(m, s.y) }
      s = jump(s)
      for (let i = 0; i < 120; i++) { s = stepRun(s, 1 / 60); m = Math.max(m, s.y) }
      max = Math.max(max, m)
    }
    let one = jump(newRun(1)); let m1 = 0
    for (let i = 0; i < 90; i++) { one = stepRun(one, 1 / 60); m1 = Math.max(m1, one.y) }
    expect(m1).toBeLessThan(125); expect(max).toBeLessThan(230)
  })
  it('두 번째 점프는 속도가 갑자기 튀지 않고 부드럽게 솟는다', () => {
    let s = newRun(1)
    s = jump(s); s = run(s, 0.4)
    const before = s.vy
    s = jump(s)
    expect(s.vy).toBe(before) // 누른 순간에는 속도가 그대로
    const next = stepRun(s, 1 / 60)
    expect(Math.abs(next.vy - before)).toBeLessThan(120) // 한 프레임에 크게 바뀌지 않는다
    let t = s; for (let i = 0; i < 30; i++) t = stepRun(t, 1 / 60)
    expect(t.y).toBeGreaterThan(0)
  })
  it('높은 단계일수록 빠르고, 장애물이 촘촘하고, 오래 달리고, 보너스가 크다', () => {
    const [e, n, h] = LEVEL_IDS.map((l) => LEVELS[l])
    expect(e.speed).toBeLessThan(n.speed); expect(n.speed).toBeLessThan(h.speed)
    // 1초에 만나는 장애물 수(끝 무렵): 높은 단계일수록 많다
    const density = (l: (typeof e)) => ((l.speed + l.up * l.duration) * l.chance) / l.slot
    expect(density(e)).toBeLessThan(density(n)); expect(density(n)).toBeLessThan(density(h))
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
        if (did === 0 && dist < 140) { s = jump(s); did = 1 }
        else if (jumps === 2 && did === 1 && s.vy < 150 && s.y > 60) { s = jump(s); did = 2 }
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
