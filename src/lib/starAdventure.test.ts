import { describe, expect, it } from 'vitest'
import { CFG, LEVELS, foeSpeed, newRun, step, type Input, type State } from './starAdventure'

const none: Input = { left: false, right: false, jump: false, down: false }
const run = (s: State, inp: Input, sec: number) => { const ev = []; for (let t = 0; t < sec; t += 1 / 60) ev.push(...step(s, inp, 1 / 60)); return ev }

describe('별 모험 규칙', () => {
  it('땅에 서 있고 오른쪽으로 걷는다', () => {
    const s = newRun(0); run(s, none, 0.3); expect(s.p.y).toBeCloseTo(10, 3); expect(s.p.on).toBe(true)
    const x0 = s.p.x; run(s, { ...none, right: true }, 0.5); expect(s.p.x).toBeGreaterThan(x0 + 2)
  })
  it('점프하면 올라갔다 내려오고, 짧게 누르면 낮게 뛴다', () => {
    const a = newRun(0); a.main.foes = []; step(a, { ...none, jump: true }, 1 / 60); let ma = 99; for (let i = 0; i < 80; i++) { step(a, { ...none, jump: true }, 1 / 60); ma = Math.min(ma, a.p.y) }
    const b = newRun(0); b.main.foes = []; step(b, { ...none, jump: true }, 1 / 60); let mb = 99; for (let i = 0; i < 80; i++) { step(b, none, 1 / 60); mb = Math.min(mb, b.p.y) }
    expect(ma).toBeLessThan(7); expect(mb).toBeGreaterThan(ma + 0.8); expect(a.p.y).toBeCloseTo(10, 2)
  })
  it('파이프 옆면에 막힌다', () => {
    const s = newRun(0); s.main.foes = []; s.p.x = 8; run(s, { ...none, right: true }, 2)
    expect(s.p.x).toBeLessThan(10 - 0.3 + 0.01) // 첫 파이프(칸 10)
  })
  it('물음표는 세 번에 한 번 하트 약병이 나오고 나머지는 코인', () => {
    const s = newRun(0); s.main.foes = []; s.p.x = 14.5; s.p.y = 10
    const ev = run(s, { ...none, jump: true }, 0.5)
    expect(ev.some((e) => e.k === 'potion')).toBe(true); expect(s.main.items.length).toBe(1); expect(s.p.big).toBe(false); expect(s.main.rows[6][14]).toBe('u')
    s.p.x = 16.5; s.p.y = 10; s.p.vy = 0; s.p.on = true; s.p.inv = 99
    run(s, none, 0.1); const ev2 = run(s, { ...none, jump: true }, 0.5); expect(ev2.some((e) => e.k === 'coin')).toBe(true); expect(s.coins).toBe(1)
    s.qHits = 3; s.p.x = 34.5; s.p.y = 10; s.p.vy = 0; s.p.on = true
    run(s, none, 0.1); const ev3 = run(s, { ...none, jump: true }, 0.5); expect(ev3.some((e) => e.k === 'potion')).toBe(true)
  })
  it('하트 약병은 도망가지 않고, 튀어나온 뒤 아래 땅에 내려앉아 그 자리에 있다', () => {
    const s = newRun(0); s.main.foes = []; s.p.x = 14.5; s.p.y = 10; s.p.inv = 99
    run(s, { ...none, jump: true }, 0.5); expect(s.main.items.length).toBe(1)
    s.p.x = 3; s.p.y = 10; s.p.vy = 0; s.p.on = true
    run(s, none, 2); const a = s.main.items[0]; expect(a.y).toBeCloseTo(10, 1); expect(a.vy).toBe(0)
    const x0 = a.x; s.p.x = a.x + 1.5; run(s, none, 0.05); s.p.x = a.x + 3; run(s, none, 3)
    expect(Math.abs(s.main.items[0].x - x0)).toBeLessThan(0.01)
  })
  it('공중에서 한 번 더 뛸 수 있다(더블 점프), 세 번째는 안 된다', () => {
    const peak = (taps: (i: number) => boolean) => { const t = newRun(0); t.main.foes = []; t.p.x = 3.5; let min = 99; for (let i = 0; i < 150; i++) { step(t, { ...none, jump: taps(i) }, 1 / 60); min = Math.min(min, t.p.y) } return min }
    const hop = peak((i) => i < 6) // 짧은 점프 하나
    const dbl = peak((i) => i < 6 || (i >= 14 && i < 40)) // 공중에서 한 번 더
    const trip = peak((i) => i < 6 || (i >= 14 && i < 22) || (i >= 30 && i < 60)) // 세 번째 시도
    expect(hop).toBeGreaterThan(7.8); expect(dbl).toBeLessThan(hop - 1.5)
    expect(trip).toBeGreaterThan(dbl - 0.05)
  })
  it('관 옆면에 두 줄 이상 닿아도 관을 넘어 순간이동하지 않고 그 앞에서 멈춘다', () => {
    for (const big of [false, true]) for (const y of [8.9, 9.04, 9.5, 10]) {
      const s = newRun(0); s.main.foes = []; s.p.inv = 99; s.p.big = big; s.p.x = 9.62; s.p.y = y; s.p.vy = 0
      for (let i = 0; i < 10; i++) { step(s, { ...none, right: true }, 1 / 60); expect(s.p.x).toBeLessThanOrEqual(10 - CFG.hw + 1e-6) } // 첫 관의 왼쪽 면은 x = 10
    }
    const t = newRun(0); t.main.foes = []; t.p.inv = 99; t.p.x = 12.38; t.p.y = 9.04; t.p.vy = 0 // 관 오른쪽에서 왼쪽으로 부딪힐 때도 마찬가지
    for (let i = 0; i < 10; i++) { step(t, { ...none, left: true }, 1 / 60); expect(t.p.x).toBeGreaterThanOrEqual(12 + CFG.hw - 1e-6) }
  })
  it('하트 약병을 먹으면 커지고, 커지면서 제자리를 유지한다', () => {
    const s = newRun(0); s.main.foes = []; s.p.x = 6.5; s.p.y = 10
    s.main.items.push({ id: 1, x: 6.9, y: 10, vy: 0, dir: 1, t: 1 })
    const ev = run(s, none, 0.1); expect(ev.some((e) => e.k === 'grow')).toBe(true); expect(s.p.big).toBe(true); expect(s.main.items.length).toBe(0)
    run(s, none, 1); expect(s.p.y).toBeCloseTo(10, 2)
  })
  it('아래에서 벽돌·물음표를 치면 그 위에 있던 괴물이 물리쳐진다', () => {
    const s = newRun(0); s.main.foes = [{ id: 1, x: 17.5, y: 6, vy: 0, dir: 1, alive: true, squash: 0 }, { id: 2, x: 24.5, y: 6, vy: 0, dir: 1, alive: true, squash: 0 }]
    s.p.x = 17.5; s.p.y = 10; s.p.inv = 99 // 벽돌 아래(칸 17, 줄 6)
    const ev = run(s, { ...none, jump: true }, 0.4)
    expect(ev.some((e) => e.k === 'break')).toBe(true); expect(s.main.foes[0].alive).toBe(false); expect(s.main.foes[1].alive).toBe(true)
    const t = newRun(0); t.main.foes = [{ id: 1, x: 14.5, y: 6, vy: 0, dir: 1, alive: true, squash: 0 }]; t.p.x = 14.5; t.p.y = 10; t.p.inv = 99 // 물음표 아래
    run(t, { ...none, jump: true }, 0.4); expect(t.main.foes[0].alive).toBe(false); expect(t.score).toBeGreaterThanOrEqual(100)
  })
  it('커진 상태에서 친구에게 닿으면 원래 크기로 돌아오고 ♥는 그대로, 한 번 더 닿으면 ♥가 줄어든다', () => {
    const s = newRun(0); s.main.foes = [{ id: 1, x: 15.2, y: 10, vy: 0, dir: -1, alive: true, squash: 0 }]; s.p.x = 14.7; s.p.y = 10; s.p.big = true
    const ev = run(s, none, 0.3); expect(ev.some((e) => e.k === 'shrink')).toBe(true); expect(s.p.big).toBe(false); expect(s.lives).toBe(CFG.lives); expect(s.p.inv).toBeGreaterThan(0)
    s.p.inv = 0; s.p.y = 10; s.p.vy = 0; s.p.on = true; s.main.foes = [{ id: 2, x: s.p.x + 0.5, y: 10, vy: 0, dir: -1, alive: true, squash: 0 }]
    run(s, none, 0.3); expect(s.lives).toBe(CFG.lives - 1)
  })
  it('별 친구는 낭떠러지 앞에서 돌아서서 떨어지지 않는다', () => {
    for (const lv of [0, 1, 2]) {
      const s = newRun(lv); s.p.inv = 99; s.p.x = 1.5; s.p.on = true
      for (let i = 0; i < 60 * 40; i++) { step(s, none, 1 / 60); s.p.x = 1.5; s.p.y = 10; s.p.vy = 0 }
      expect(s.main.foes.filter((f) => f.alive).length).toBe(s.main.foes.length)
    }
  })
  it('별 친구를 위에서 밟으면 물리치고 튀어 오르고, 옆으로 닿으면 목숨이 줄어든다', () => {
    const s = newRun(0); s.main.foes = [{ id: 1, x: 15.5, y: 10, vy: 0, dir: -1, alive: true, squash: 0 }]; s.p.x = 15.5; s.p.y = 8.5; s.p.vy = 4; s.p.on = false
    const ev = run(s, none, 0.2); expect(ev.some((e) => e.k === 'stomp')).toBe(true); expect(s.score).toBeGreaterThanOrEqual(100)
    const t = newRun(0); t.main.foes = [{ id: 1, x: 15.2, y: 10, vy: 0, dir: -1, alive: true, squash: 0 }]; t.p.x = 14.7; t.p.y = 10
    const ev2 = run(t, none, 0.3); expect(ev2.some((e) => e.k === 'hit')).toBe(true); expect(t.lives).toBe(CFG.lives - 1); expect(t.p.inv).toBeGreaterThan(0)
  })
  it('파이프 위에서 아래를 누르면 보너스 방으로, 거기서 나오는 파이프로 돌아온다', () => {
    const s = newRun(0); s.main.foes = []
    // 들어갈 수 있는 파이프(칸 28~29, 높이 2 → 윗면 8)
    s.p.x = 28.8; s.p.y = 8; s.p.on = true; run(s, none, 0.1); expect(s.p.y).toBeCloseTo(8, 2)
    const ev = run(s, { ...none, down: true }, 0.05); expect(ev.some((e) => e.k === 'pipe')).toBe(true); expect(s.room).toBe('bonus')
    run(s, { ...none, down: false }, 0.1)
    s.p.x = 19.8; s.p.y = 8; s.p.on = true; run(s, none, 0.1)
    run(s, { ...none, down: true }, 0.05); expect(s.room).toBe('main'); expect(s.p.x).toBeCloseTo(29, 0)
  })
  it('구덩이에 빠지면 목숨이 줄고 처음으로, 깃발에 닿으면 단계 끝', () => {
    const s = newRun(0); s.main.foes = []; s.p.x = 19; s.p.y = 10.5; s.p.on = false
    const ev = run(s, none, 2); expect(ev.some((e) => e.k === 'fall')).toBe(true); expect(s.lives).toBe(CFG.lives - 1); expect(s.p.x).toBeCloseTo(2.5, 1)
    const t = newRun(0); t.main.foes = []; t.p.x = t.flagX + 0.1; t.p.y = 10
    const ev2 = run(t, none, 0.1); expect(ev2.some((e) => e.k === 'clear')).toBe(true); expect(t.stars).toBe(5)
    run(t, none, 2.5); expect(t.level).toBe(1)
  })
  it('새 단계가 시작되면 목숨이 다시 3개로 채워진다', () => {
    const s = newRun(0); s.lives = 1; s.main.foes = []; s.p.x = s.flagX + 0.1; s.p.y = 10
    run(s, none, 3); expect(s.level).toBe(1); expect(s.lives).toBe(CFG.lives); expect(CFG.lives).toBe(3)
  })
  it('목숨이 0이면 끝, 마지막 단계를 끝내면 승리', () => {
    const s = newRun(0); s.lives = 1; s.main.foes = [{ id: 1, x: 15.2, y: 10, vy: 0, dir: -1, alive: true, squash: 0 }]; s.p.x = 14.7; s.p.y = 10
    run(s, none, 0.3); expect(s.phase).toBe('over')
    const t = newRun(LEVELS - 1); t.main.foes = []; t.p.x = t.flagX + 0.1; t.p.y = 10; run(t, none, 3); expect(t.phase).toBe('won'); expect(t.stars).toBe(25)
  })

  it('단계가 올라갈수록 괴물이 빨라지고, 처음엔 적고 뒤로 갈수록 많아진다', () => {
    const speeds = Array.from({ length: LEVELS }, (_, l) => foeSpeed(l))
    for (let l = 1; l < LEVELS; l++) expect(speeds[l]).toBeGreaterThan(speeds[l - 1])
    expect(speeds[0]).toBeLessThan(CFG.foe)
    const n = Array.from({ length: LEVELS }, (_, l) => newRun(l).main.foes.length)
    expect(n[0]).toBeLessThan(n[2]) // 같은 판 모양(0·3단계)이라도 3단계가 더 어렵다
    expect(n[3]).toBeGreaterThan(newRun(0).main.foes.length)
    expect(n[LEVELS - 1]).toBeGreaterThan(n[3] - 1)
    // 괴물은 구덩이 위나 관 안에 놓이지 않는다
    for (let l = 0; l < LEVELS; l++) { const r = newRun(l); for (const f of r.main.foes) expect(['#', '=', '.'].includes(r.main.rows[10][Math.floor(f.x)]) ? true : false).toBe(true) }
  })
})
