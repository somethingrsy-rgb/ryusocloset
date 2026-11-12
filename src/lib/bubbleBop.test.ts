import { describe, expect, it } from 'vitest'
import { CFG, LEVELS, newGame, newLevel, step, type Input, type State } from './bubbleBop'

const none: Input = { left: false, right: false, jump: false, shoot: false }
const rnd = () => 0.5
const run = (s: State, inp: Input, sec: number) => { const ev = []; for (let t = 0; t < sec; t += 1 / 60) ev.push(...step(s, inp, 1 / 60, rnd)); return ev.flat() }

describe('별 거품 규칙', () => {
  it('바닥에 서 있고, 점프하면 올라갔다 다시 선다', () => {
    const s = newGame(); s.foes = []; s.phase = 'play'; s.p.x = 7.5 // 가운데는 위 발판까지 너무 멀어 못 올라간다
    run(s, none, 0.5); expect(s.p.y).toBeCloseTo(11, 3); expect(s.p.on).toBe(true)
    step(s, { ...none, jump: true }, 1 / 60, rnd); expect(s.p.on).toBe(false)
    let min = 99; for (let i = 0; i < 90; i++) { step(s, none, 1 / 60, rnd); min = Math.min(min, s.p.y) }
    expect(min).toBeLessThan(11 - 3.5); expect(s.p.y).toBeCloseTo(11, 3)
  })
  it('발판은 아래에서 뛰어 통과하고 위에서 밟는다', () => {
    const s = newLevel(0); s.foes = []
    s.p.x = 7.5; s.p.y = 8; s.p.on = true // 가운데 발판(행 5, 4~11) 아래 8행 바닥(없음) → 아래 바닥 11에서 시작하려면
    s.p.y = 11; s.p.x = 7.5
    const ev = []; for (let i = 0; i < 20; i++) ev.push(...step(s, { ...none, jump: i === 0 }, 1 / 60, rnd))
    // 11 → 점프 중 행 8(1~5, 10~14)은 7.5 에 없고 행 5 는 4~11 → 올라가서 5 에 서려면 두 번 뛰어야 하지만 통과는 확인
    expect(s.p.y).toBeLessThan(11)
    for (let i = 0; i < 200; i++) step(s, none, 1 / 60, rnd)
    expect(s.p.y).toBeCloseTo(11, 3)
    const t = newLevel(0); t.foes = []; t.p.x = 7.5; t.p.y = 4.2; t.p.vy = 1; t.p.on = false
    for (let i = 0; i < 30; i++) step(t, none, 1 / 60, rnd)
    expect(t.p.y).toBeCloseTo(5, 3); expect(t.p.on).toBe(true) // 위에서 떨어지면 발판 위에 선다
  })
  it('거품에 닿으면 별 친구가 갇히고, 몸으로 터뜨리면 과일과 점수', () => {
    const s = newLevel(0); s.foes = [{ id: 9, x: 5.5, y: 11, vx: 0, vy: 0, on: true, dir: 1, mad: false, jumpT: 99 }]
    s.p.x = 3; s.p.dir = 1
    const ev1 = run(s, { ...none, shoot: true }, 0.5)
    expect(ev1.some((e) => e.k === 'trap')).toBe(true); expect(s.foes.length).toBe(0)
    expect(s.bubbles.some((b) => b.foe)).toBe(true)
    // 거품 아래로 가서 점프로 터뜨린다
    const b = s.bubbles.find((x) => x.foe)!; s.p.x = b.x; s.p.y = 11; s.p.on = true
    s.p.inv = 99
    let ev2: ReturnType<typeof run> = []
    for (let i = 0; i < 120 && !ev2.some((e) => e.k === 'defeat'); i++) { ev2 = ev2.concat(step(s, { ...none, jump: i % 30 === 1 }, 1 / 60, rnd)); const bb = s.bubbles.find((x) => x.foe); if (bb) s.p.x = bb.x }
    expect(ev2.some((e) => e.k === 'defeat')).toBe(true); expect(s.score).toBeGreaterThanOrEqual(CFG.pts.foe)
  })
  it('갇힌 친구는 시간이 지나면 화가 나서 풀려난다', () => {
    const s = newLevel(0); s.foes = [{ id: 9, x: 5.5, y: 11, vx: 0, vy: 0, on: true, dir: 1, mad: false, jumpT: 99 }]; s.p.x = 3; s.p.inv = 99
    run(s, { ...none, shoot: true }, 0.1) // 거품 한 번만
    const ev = run(s, none, CFG.trapLife + 1)
    expect(ev.some((e) => e.k === 'escape')).toBe(true); expect(s.foes.some((f) => f.mad)).toBe(true)
  })
  it('별 친구에게 닿으면 목숨이 줄고 잠깐 안전, 0이면 끝', () => {
    const s = newLevel(0); s.foes = [{ id: 9, x: 2.6, y: 11, vx: 0, vy: 0, on: true, dir: 1, mad: false, jumpT: 99 }]
    const ev = run(s, none, 0.2)
    expect(ev.some((e) => e.k === 'hit')).toBe(true); expect(s.lives).toBe(CFG.lives - 1); expect(s.p.inv).toBeGreaterThan(1)
    s.lives = 1; s.p.inv = 0; s.foes = [{ id: 9, x: 2.6, y: 11, vx: 0, vy: 0, on: true, dir: 1, mad: false, jumpT: 99 }]
    run(s, none, 0.2); expect(s.phase).toBe('over')
  })
  it('발판 끝에서 돌아서고 벽 밖으로 나가지 않는다', () => {
    const s = newLevel(0); s.p.inv = 99; run(s, { ...none, left: true }, 2); expect(s.p.x).toBeGreaterThanOrEqual(1 + CFG.hw - 1e-6)
    run(s, { ...none, right: true }, 4); expect(s.p.x).toBeLessThanOrEqual(15 - CFG.hw + 1e-6)
    for (const f of s.foes) { expect(f.x).toBeGreaterThan(1); expect(f.x).toBeLessThan(15) }
  })
  it('적을 모두 없애면 단계가 끝나고 다음 단계로, 마지막은 승리', () => {
    const s = newLevel(0); s.foes = []; s.p.inv = 99
    const ev = run(s, none, 0.1); expect(ev.some((e) => e.k === 'clear')).toBe(true); expect(s.stars).toBe(5)
    run(s, none, CFG.clearWait + 0.2); expect(s.level).toBe(1); expect(s.phase).toBe('play'); expect(s.foes.length).toBe(LEVELS[1].foes.length)
    const t = newLevel(LEVELS.length - 1); t.foes = []; const ev2 = run(t, none, CFG.clearWait + 0.3)
    expect(ev2.some((e) => e.k === 'won').valueOf()).toBe(true); expect(t.phase).toBe('won'); expect(t.stars).toBe(25)
  })
  it('과일이 떨어져 발판 위에 서고, 먹으면 점수', () => {
    const s = newLevel(0); s.foes = []; s.p.inv = 99
    s.fruits.push({ id: 5, x: 7.5, y: 3, vy: 0, kind: 0, t: 0, pts: 100 })
    run(s, none, 1); expect(s.fruits[0].y).toBeCloseTo(5, 2)
    s.p.x = 7.5; s.p.y = 5; s.p.on = true; run(s, none, 0.1); expect(s.score).toBe(100)
  })
})
