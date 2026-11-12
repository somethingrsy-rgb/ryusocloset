import { describe, expect, it } from 'vitest'
import { curveAt, curveKind, curveSlope, CURVE_START, CURVE_SEG, setHold, glide, rankNow, type Race, LAP, LAPS, TIME_LIMIT, itemsBetween, lapOf, newRace, rewardStars, useBoost, GAUGE_MAX, steer, stepRace, timeLeft } from './race'

const run = (r: ReturnType<typeof newRace>, sec: number, dt = 0.05) => { for (let i = 0; i < sec / dt && r.phase !== 'done'; i++) r = stepRace(r, dt); return r }

describe('자동차 레이스', () => {
  it('3초 세고 출발한다', () => {
    let r = newRace(1)
    r = run(r, 2.9)
    expect(r.phase).toBe('count'); expect(r.d).toBe(0)
    r = run(r, 0.5)
    expect(r.phase).toBe('run')
  })
  it('칸은 세 칸을 넘지 않는다', () => {
    let r = newRace(1)
    r = steer(steer(steer(r, -1), -1), -1)
    expect(r.lane).toBe(-1)
    r = steer(steer(steer(steer(r, 1), 1), 1), 1)
    expect(r.lane).toBe(1)
  })
  it('같은 씨앗이면 같은 길, 아이템은 구간 안에서 한 번씩만 나온다', () => {
    const a = itemsBetween(0, 2000, 7), b = itemsBetween(0, 2000, 7)
    expect(a).toEqual(b)
    expect(new Set(a.map((i) => i.id)).size).toBe(a.length)
    expect(itemsBetween(0, 1000, 7).concat(itemsBetween(1000, 2000, 7))).toEqual(a)
    expect(a.some((i) => i.kind === 'star') && a.some((i) => i.kind === 'banana')).toBe(true)
    expect(itemsBetween(0, 50, 7)).toEqual([])
  })
  it('별은 먹으면 쌓이고 부스터는 빨라지고 바나나는 느려진다', () => {
    const items = itemsBetween(0, 3000, 3)
    const star = items.find((i) => i.kind === 'star')!, boost = items.find((i) => i.kind === 'boost')!, banana = items.find((i) => i.kind === 'banana')!
    const at = (it: typeof star) => ({ ...newRace(3), phase: 'run' as const, count: 0, d: it.d - 0.5, x: it.lane, lane: it.lane, speed: 30 })
    const s = stepRace(at(star), 0.1)
    expect(s.stars).toBe(1); expect(s.gauge).toBe(1); expect(s.taken).toContain(star.id); expect(s.events).toEqual(['star'])
    const b = stepRace(at(boost), 0.1)
    expect(b.boost).toBeGreaterThan(0); expect(b.events).toEqual(['boost'])
    const n = stepRace(at(banana), 0.1)
    expect(n.slow).toBeGreaterThan(0); expect(n.events).toEqual(['slip']); expect(n.stars).toBe(0)
    // 다른 칸이면 지나간다
    const other = { ...at(star), x: star.lane === 1 ? -1 : 1, lane: (star.lane === 1 ? -1 : 1) as -1 | 1 }
    expect(stepRace(other, 0.1).stars).toBe(0)
  })
  it('부스터는 빠르게 한다', () => {
    const base: Race = { ...newRace(5), phase: 'run', count: 0 }
    const v = (r: Race) => run(r, 1).speed
    expect(v({ ...base, boost: 2 })).toBeGreaterThan(v(base))
  })
  it('두 바퀴를 다 달리면 끝나고 별을 받는다', () => {
    const r = run(newRace(9), 200)
    expect(r.phase).toBe('done')
    expect(r.finish).toBe('laps'); expect(r.d).toBeGreaterThan(LAP * LAPS)
    expect(r.t).toBeLessThan(TIME_LIMIT)
    expect(rewardStars(r)).toBeGreaterThanOrEqual(3)
  })
  it('시간이 다 되어도 끝나고, 꼴등이어도 별을 받는다', () => {
    const slow = { ...newRace(9), phase: 'run' as const, count: 0, t: TIME_LIMIT - 0.01, d: 10 }
    const r = stepRace(slow, 0.1)
    expect(r.phase).toBe('done'); expect(r.finish).toBe('time')
    expect(rewardStars(r)).toBe(1)
    expect(rewardStars(newRace())).toBe(0)
  })
  it('결승선을 지나도 바로 멈추지 않고 잠깐 더 달린다', () => {
    let r: Race = { ...newRace(9), phase: 'run', count: 0, d: LAP * LAPS - 1, speed: 30 }
    r = stepRace(r, 0.1); r = stepRace(r, 0.1); r = stepRace(r, 0.1)
    expect(r.finish).toBe('laps'); expect(r.phase).toBe('run'); expect(r.d).toBeGreaterThan(LAP * LAPS)
    const t0 = r.t; r = run(r, 3)
    expect(r.phase).toBe('done'); expect(r.t).toBe(t0)
  })
  it('바퀴와 남은 시간을 센다', () => {
    const r = { ...newRace(1), d: LAP + 5, t: 12.2 }
    expect(lapOf(r)).toBe(2); expect(timeLeft(r)).toBe(48)
    expect(lapOf({ ...r, d: LAP * LAPS })).toBe(LAPS)
  })
  it('옆 칸으로 갈 땐 한 번에 튀지 않고 미끄러지듯 가서 칸에 멈춘다', () => {
    let x = 0, vx = 0, maxStep = 0
    for (let i = 0; i < 40; i++) { const [nx, nv] = glide(x, vx, 1, 1 / 60); maxStep = Math.max(maxStep, Math.abs(nx - x)); x = nx; vx = nv }
    expect(maxStep).toBeLessThan(0.07); expect(x).toBeGreaterThan(0.4); expect(x).toBeLessThan(1.1)
    for (let i = 0; i < 90; i++) { const [nx, nv] = glide(x, vx, 1, 1 / 60); x = nx; vx = nv }
    expect(Math.abs(x - 1)).toBeLessThan(0.01); expect(Math.abs(vx)).toBeLessThan(0.05)
  })
  it('컴퓨터 친구는 최대 3대, 모두 결승선까지 달리고 별 순위 선물을 준다', () => {
    expect(newRace(1).rivals.length).toBe(0); expect(rankNow(newRace(1))).toBe(0)
    expect(newRace(1, [0, 1, 2, 3, 4]).rivals.length).toBe(3)
    let r = newRace(5, [0, 1, 2])
    for (let i = 0; i < 4000 && r.phase !== 'done'; i++) r = stepRace(r, 0.05)
    expect(r.phase).toBe('done'); expect(r.rank).toBeGreaterThanOrEqual(1); expect(r.rank).toBeLessThanOrEqual(4)
    expect(r.rivals.every((v) => v.d > 100 && v.d < LAP * LAPS + 400)).toBe(true)
    expect(rewardStars({ ...r, rank: 1, stars: 0, finish: 'laps' })).toBe(6); expect(rewardStars({ ...r, rank: 4, stars: 0, finish: 'laps' })).toBe(3)
    // 혼자 달릴 땐 순위 선물이 없다
    expect(rewardStars({ ...r, rivals: [], rank: 0, stars: 0, finish: 'laps' })).toBe(3)
  })
  it('혼자는 3칸, 친구와 함께는 5칸 길이다', () => {
    expect(newRace(1).lanes).toBe(3); expect(newRace(1, [0]).lanes).toBe(5)
    let r = newRace(1, [0, 1]); for (let i = 0; i < 5; i++) r = steer(r, 1)
    expect(r.lane).toBe(2)
    for (let i = 0; i < 9; i++) r = steer(r, -1)
    expect(r.lane).toBe(-2)
    let s = newRace(1); for (let i = 0; i < 5; i++) s = steer(s, 1)
    expect(s.lane).toBe(1)
    const lanes5 = new Set(itemsBetween(0, 6000, 3, 5).map((i) => i.lane)), lanes3 = new Set(itemsBetween(0, 6000, 3).map((i) => i.lane))
    expect([...lanes5].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]); expect([...lanes3].sort((a, b) => a - b)).toEqual([-1, 0, 1])
    expect(newRace(1, [0, 1, 2]).rivals.map((v) => v.lane)).toEqual([-2, 2, 1])
  })
  it('단추를 누르고 있으면 칸에 걸리지 않고 쭉 가고, 떼면 그 자리에서 멈춘다', () => {
    let r: Race = { ...newRace(1, [0]), phase: 'run', count: 0 }
    r = setHold(steer(r, 1), 1)
    for (let i = 0; i < 6; i++) r = stepRace(r, 0.05)
    expect(r.lane).toBeGreaterThan(1.2); expect(r.lane).toBeLessThan(2); expect(r.x).toBeGreaterThan(0.5)
    expect(Number.isInteger(r.lane)).toBe(false)
    for (let i = 0; i < 40; i++) r = stepRace(r, 0.05)
    expect(r.lane).toBe(2)
    r = setHold(r, -1); for (let i = 0; i < 6; i++) r = stepRace(r, 0.05)
    r = setHold(r, 0); const stay = r.lane
    for (let i = 0; i < 20; i++) r = stepRace(r, 0.05)
    expect(r.lane).toBe(stay)
  })
  it('코인을 먹으면 부스터 게이지가 차고, 가득 차야만 단추로 쓸 수 있고, 별(돈)은 따로 주지 않는다', () => {
    const run = (g: number): Race => ({ ...newRace(1), phase: 'run', count: 0, gauge: g, speed: 30 })
    expect(useBoost(run(GAUGE_MAX - 1))).toEqual(run(GAUGE_MAX - 1))
    const b = useBoost(run(GAUGE_MAX))
    expect(b.gauge).toBe(0); expect(b.boost).toBeGreaterThan(2); expect(b.events).toEqual(['boost'])
    expect(useBoost({ ...run(GAUGE_MAX), phase: 'count' }).boost).toBe(0)
    const fast = stepRace(b, 1).speed, slow = stepRace(run(0), 1).speed
    expect(fast).toBeGreaterThan(slow)
    // 코인을 많이 먹어도 별 선물은 그대로(끝까지 달리면 3개)
    expect(rewardStars({ ...run(0), phase: 'done', finish: 'laps', stars: 50 })).toBe(3)
    // 게이지는 가득 차면 더 쌓이지 않는다
    const star = itemsBetween(0, 3000, 3).find((i) => i.kind === 'star')!
    const full = stepRace({ ...run(GAUGE_MAX), seed: 3, d: star.d - 0.5, x: star.lane, lane: star.lane }, 0.1)
    expect(full.gauge).toBe(GAUGE_MAX)
  })
  it('휘는 길: 출발·결승 근처는 곧고, 같은 씨앗이면 같고, 자주 휘고, 부드럽게 이어진다', () => {
    for (let d = 0; d <= CURVE_START; d += 10) expect(Math.abs(curveAt(d, 5))).toBe(0)
    expect(Math.abs(curveAt(LAP * LAPS, 5))).toBe(0); expect(Math.abs(curveAt(LAP * LAPS - 20, 5))).toBe(0)
    expect(curveAt(500, 7)).toBe(curveAt(500, 7))
    let curvy = 0, total = 0, maxStep = 0, maxAbs = 0
    for (let seed = 1; seed <= 20; seed++) {
      let prev = curveAt(CURVE_START, seed)
      for (let d = CURVE_START; d < LAP * LAPS; d += 1) { const c = curveAt(d, seed); maxStep = Math.max(maxStep, Math.abs(c - prev)); maxAbs = Math.max(maxAbs, Math.abs(c)); prev = c }
      for (let seg = 0; seg < 9; seg++) { total++; if (curveKind(seg, seed) !== 0) curvy++ }
    }
    expect(curvy / total).toBeGreaterThan(0.6)     // 자주 휜다
    expect(maxStep).toBeLessThan(0.5)              // 1칸마다 옆으로 0.5 이상 튀지 않는다(부드럽다)
    expect(maxAbs).toBeLessThanOrEqual(14.01)
    // 왼쪽·오른쪽이 모두 나온다
    const signs = new Set<number>(); for (let seg = 0; seg < 30; seg++) signs.add(Math.sign(curveKind(seg, 3)))
    expect(signs.has(-1) && signs.has(1)).toBe(true)
    expect(Math.abs(curveSlope(CURVE_START + CURVE_SEG * 0.25, 4)) + Math.abs(curveSlope(CURVE_START + CURVE_SEG * 1.25, 4))).toBeGreaterThan(0)
  })
})
