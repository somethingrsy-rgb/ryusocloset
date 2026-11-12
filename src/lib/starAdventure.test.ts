import { describe, expect, it } from 'vitest'
import { CFG, newRun, step, type Input, type State } from './starAdventure'

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
  it('아래에서 물음표 블록을 치면 코인이 나온다', () => {
    const s = newRun(0); s.main.foes = []; s.p.x = 14.5; s.p.y = 10
    const ev = run(s, { ...none, jump: true }, 0.5)
    expect(ev.some((e) => e.k === 'coin')).toBe(true); expect(s.coins).toBe(1); expect(s.main.rows[6][14]).toBe('u')
  })
  it('별 친구를 위에서 밟으면 물리치고 튀어 오르고, 옆으로 닿으면 목숨이 줄어든다', () => {
    const s = newRun(0); s.main.foes = [{ id: 1, x: 6.5, y: 10, vy: 0, dir: -1, alive: true, squash: 0 }]; s.p.x = 6.5; s.p.y = 8.5; s.p.vy = 4; s.p.on = false
    const ev = run(s, none, 0.2); expect(ev.some((e) => e.k === 'stomp')).toBe(true); expect(s.score).toBeGreaterThanOrEqual(100)
    const t = newRun(0); t.main.foes = [{ id: 1, x: 6.2, y: 10, vy: 0, dir: -1, alive: true, squash: 0 }]; t.p.x = 5.7; t.p.y = 10
    const ev2 = run(t, none, 0.3); expect(ev2.some((e) => e.k === 'hit')).toBe(true); expect(t.lives).toBe(CFG.lives - 1); expect(t.p.inv).toBeGreaterThan(0)
  })
  it('파이프 위에서 아래를 누르면 보너스 방으로, 거기서 나오는 파이프로 돌아온다', () => {
    const s = newRun(0); s.main.foes = []
    // 들어갈 수 있는 파이프(칸 28~29, 높이 3 → 윗면 7)
    s.p.x = 28.8; s.p.y = 7; s.p.on = true; run(s, none, 0.1); expect(s.p.y).toBeCloseTo(7, 2)
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
  it('목숨이 0이면 끝, 마지막 단계를 끝내면 승리', () => {
    const s = newRun(0); s.lives = 1; s.main.foes = [{ id: 1, x: 6.2, y: 10, vy: 0, dir: -1, alive: true, squash: 0 }]; s.p.x = 5.7; s.p.y = 10
    run(s, none, 0.3); expect(s.phase).toBe('over')
    const t = newRun(2); t.main.foes = []; t.p.x = t.flagX + 0.1; t.p.y = 10; run(t, none, 3); expect(t.phase).toBe('won'); expect(t.stars).toBe(25)
  })
})
