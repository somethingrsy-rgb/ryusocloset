import { describe, expect, it } from 'vitest'
import { CFG, applyCatch, fillStars, finishIfTimeUp, newRound, newStar, pickCatch, stepStar, stepWalker, surrounded, targetFor, tick, type Who } from './starChase'

const w = (uid: string, x: number, y: number, on = true): Who => ({ uid, x, y, on })
const rnd = () => 0.5

describe('별 잡기 규칙', () => {
  it('목표 수는 인원별로 6/8/10', () => { expect([targetFor(2), targetFor(3), targetFor(4)]).toEqual([6, 8, 10]) })
  it('잡기 반경 1.2: 안쪽만 잡히고 가장 가까운 별 하나', () => {
    const a = newStar(1, 0, 0, rnd), b = newStar(2, 1.2, 0, rnd), c = newStar(3, 1.21, 0, rnd)
    expect(pickCatch([c], { x: 0, y: 0 })).toBeNull()
    expect(pickCatch([b], { x: 0, y: 0 })?.id).toBe(2)
    expect(pickCatch([b, a], { x: 0.1, y: 0 })?.id).toBe(1)
    const e1 = newStar(5, 1, 0, rnd), e2 = newStar(4, -1, 0, rnd)
    expect(pickCatch([e1, e2], { x: 0, y: 0 })?.id).toBe(4) // 같은 거리면 id 작은 별
  })
  it('포위 각도 110도 경계와 거리 경계', () => {
    const s = { x: 0, y: 0 }
    const at = (deg: number, d = 2) => w('b', Math.cos((deg * Math.PI) / 180) * d, Math.sin((deg * Math.PI) / 180) * d)
    expect(surrounded(s, [w('a', 2, 0), at(110)])).toBe(true)
    expect(surrounded(s, [w('a', 2, 0), at(109)])).toBe(false)
    expect(surrounded(s, [w('a', 2, 0), at(180, 2.8)])).toBe(true)
    expect(surrounded(s, [w('a', 2, 0), at(180, 2.81)])).toBe(false)
    expect(surrounded(s, [w('a', 2, 0), w('b', 0, 0)])).toBe(false) // 영벡터(겹침)는 제외
    expect(surrounded(s, [w('a', 2, 0), at(180), ].map((p, i) => (i ? { ...p, on: false } : p)))).toBe(false) // 연결 끊긴 사람은 제외
  })
  it('포위는 0.35초 뒤 CORNERED, 최소 1.2초 유지, 풀려도 0.5초 뒤에야 도주', () => {
    let s = newStar(1, 0, 0, rnd)
    const ps = [w('a', -2, 0), w('b', 2, 0)]
    for (let i = 0; i < 6; i++) s = stepStar(s, ps, 0.05, rnd) // 0.30초
    expect(s.mode).not.toBe('cornered')
    for (let i = 0; i < 2; i++) s = stepStar(s, ps, 0.05, rnd)
    expect(s.mode).toBe('cornered')
    const far = [w('a', -9, 0), w('b', 9, 0)]
    for (let i = 0; i < 20; i++) s = stepStar(s, far, 0.05, rnd) // 1.0초: 아직 유지
    expect(s.mode).toBe('cornered')
    for (let i = 0; i < 6; i++) s = stepStar(s, far, 0.05, rnd)
    expect(s.mode).not.toBe('cornered')
  })
  it('가까이 가면 도망가고 포위되면 느림', () => {
    let a = newStar(1, 0, 0, rnd), b = newStar(1, 0, 0, rnd)
    for (let i = 0; i < 10; i++) { a = stepStar(a, [w('p', -2, 0)], 0.1, rnd); b = stepStar(b, [w('p', -2, 0), w('q', 2, 0)], 0.1, rnd) }
    expect(a.mode).toBe('flee'); expect(a.x).toBeGreaterThan(1.5)
    expect(b.mode).toBe('cornered'); expect(Math.hypot(b.x, b.y)).toBeLessThan(a.x)
  })
  it('경계 밖으로 나가지 않고 NaN이 없다', () => {
    let s = newStar(1, CFG.w / 2 - 0.4, CFG.h / 2 - 0.4, rnd)
    for (let i = 0; i < 400; i++) { s = stepStar(s, [w('p', s.x - 1, s.y - 1)], 0.05, rnd); expect(Number.isFinite(s.x + s.y)).toBe(true); expect(Math.abs(s.x)).toBeLessThanOrEqual(CFG.w / 2); expect(Math.abs(s.y)).toBeLessThanOrEqual(CFG.h / 2) }
  })
  it('걷기는 대각선도 같은 속도, 경계 안', () => {
    const p = stepWalker({ x: 0, y: 0 }, 1, 1, 1)
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(CFG.walk, 5)
    expect(stepWalker({ x: 11, y: 0 }, 1, 0, 5).x).toBeCloseTo(CFG.w / 2 - CFG.avatarR, 5)
  })
  it('시작 별: 친구에게서 4 이상, 활성 별 3개 이하, 목표를 넘지 않음', () => {
    const ps = [w('a', 0, 0), w('b', 3, 3)]
    let r = fillStars(newRound(1, 2, 1000), ps, 0, Math.random, true)
    expect(r.stars.length).toBe(3)
    for (const s of r.stars) for (const p of ps) expect(Math.hypot(s.x - p.x, s.y - p.y)).toBeGreaterThanOrEqual(4 - 1e-9)
    r = { ...r, caught: 5, stars: r.stars.slice(0, 1) }
    expect(fillStars({ ...r, respawnAt: [0, 0] }, ps, 1, Math.random).stars.length).toBe(1) // 잡은 5 + 활성 1 = 6 = 목표
  })
  it('포획: 잘못된 라운드·쿨다운·끝난 뒤는 거부, 한 번에 별 하나, 목표 달성 시 win', () => {
    const ps = w('a', 0, 0)
    let r = newRound(7, 2, 1000); r.stars = [newStar(1, 0.5, 0, rnd), newStar(2, 0.6, 0, rnd)]
    expect(applyCatch(r, { round: 6, cdLeft: 0 }, ps, 10).star).toBeNull()
    expect(applyCatch(r, { round: 7, cdLeft: 0.3 }, ps, 10).star).toBeNull()
    expect(applyCatch(r, { round: 7, cdLeft: 0 }, ps, 1001).star).toBeNull()
    expect(applyCatch(r, { round: 7, cdLeft: 0 }, { ...ps, on: false }, 10).star).toBeNull()
    const ok = applyCatch(r, { round: 7, cdLeft: 0 }, ps, 10)
    expect(ok.star?.id).toBe(1); expect(ok.round.caught).toBe(1); expect(ok.round.stars.length).toBe(1)
    const last = { ...r, caught: r.target - 1 }
    expect(applyCatch(last, { round: 7, cdLeft: 0 }, ps, 10).round.res).toBe('win')
    expect(applyCatch({ ...last, res: 'win' }, { round: 7, cdLeft: 0 }, ps, 10).star).toBeNull() // 종료 후 거부
  })
  it('시간이 끝나면 한 번만 결과가 정해지고 이후 틱은 바뀌지 않음', () => {
    const r = newRound(1, 2, 100)
    const t = finishIfTimeUp({ ...r, caught: 2 }, 100)
    expect(t.res).toBe('lose')
    expect(tick(t, [w('a', 0, 0)], 0.05, 101, rnd)).toBe(t)
    expect(finishIfTimeUp({ ...r, caught: 6 }, 100).res).toBe('win')
  })
})
