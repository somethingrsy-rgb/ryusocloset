import { describe, expect, it } from 'vitest'
import { BOSS, BOSS_LEVELS, CFG, COLS, LEVELS, ROWS, newGame, newLevel, step, type Input, type State } from './bubbleBop'

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
    const t = newLevel(LEVELS.length - 1); t.foes = []; t.boss = null; const ev2 = run(t, none, CFG.clearWait + 0.3)
    expect(ev2.some((e) => e.k === 'won').valueOf()).toBe(true); expect(t.phase).toBe('won'); expect(t.stars).toBe(25)
  })
  it('새 단계가 시작되면 목숨이 다시 3개로 채워진다', () => {
    const s = newLevel(0); s.foes = []; s.lives = 1; s.p.inv = 99
    run(s, none, CFG.clearWait + 0.3); expect(s.level).toBe(1); expect(s.lives).toBe(CFG.lives); expect(CFG.lives).toBe(3)
  })
  it('과일이 떨어져 발판 위에 서고, 먹으면 점수', () => {
    const s = newLevel(0); s.foes = []; s.p.inv = 99
    s.fruits.push({ id: 5, x: 7.5, y: 3, vy: 0, kind: 0, t: 0, pts: 100 })
    run(s, none, 1); expect(s.fruits[0].y).toBeCloseTo(5, 2)
    s.p.x = 7.5; s.p.y = 5; s.p.on = true; run(s, none, 0.1); expect(s.score).toBe(100)
  })
  it('3·6·9단계에는 대왕 몬스터가 작은 몬스터 3마리와 함께 나오고, 그중 한 종류가 커진 모습이다', () => {
    for (const lv of [2, 5, 8]) { const g = newLevel(lv); expect(g.boss?.hp).toBe(BOSS_LEVELS[lv]); expect(g.foes.length).toBe(3); expect(g.foes.some((f) => f.id === g.boss!.kindId)).toBe(true) }
    for (const lv of [0, 1, 3, 4]) expect(newLevel(lv).boss).toBeNull()
  })
  it('대왕 몬스터는 거품에 맞을 때마다 체력이 1 닳고, 거품은 터진다', () => {
    const s = newLevel(2); s.foes = []; s.p.inv = 99; s.boss!.x = 8; s.boss!.dir = 1; s.p.x = 4.5; s.p.dir = 1
    const hp0 = s.boss!.hp
    const ev = run(s, { ...none, shoot: true }, 0.5)
    expect(ev.some((e) => e.k === 'bossHit')).toBe(true); expect(s.boss!.hp).toBe(hp0 - 1)
    expect(s.boss!.hurt).toBeGreaterThan(0) // 맞은 직후에는 잠깐 안전
  })
  it('대왕 몬스터 머리를 위에서 밟으면(콩!) 체력 2가 닳고 튀어 오르며, 옆으로 닿으면 ♥가 줄어든다', () => {
    const s = newLevel(2); s.foes = []; const b = s.boss!; b.x = 8; b.dir = 1
    s.p.x = 8; s.p.y = 11 - BOSS.h - 0.5; s.p.vy = 6; s.p.on = false; s.p.inv = 0
    const ev = run(s, none, 0.05)
    expect(ev.some((e) => e.k === 'bossStomp')).toBe(true); expect(b.hp).toBe(BOSS_LEVELS[2] - BOSS.stomp); expect(s.p.vy).toBeLessThan(0); expect(s.lives).toBe(CFG.lives)
    const t = newLevel(2); t.foes = []; t.boss!.x = 8; t.p.x = 7.2; t.p.y = 11; t.p.inv = 0
    run(t, none, 0.2); expect(t.lives).toBe(CFG.lives - 1)
  })
  it('대왕 몬스터를 쓰러뜨리면 과일이 나오고 단계가 끝난다', () => {
    const s = newLevel(2); s.foes = []; s.p.inv = 99; s.boss!.hp = 1; s.boss!.x = 8; s.boss!.dir = 1; s.p.x = 4.5
    const ev = run(s, { ...none, shoot: true }, 0.5)
    expect(ev.some((e) => e.k === 'bossDown')).toBe(true); expect(s.boss).toBeNull(); expect(s.fruits.length).toBe(5); expect(s.score).toBeGreaterThanOrEqual(1000)
    run(s, none, 0.2); expect(s.phase === 'clear' || s.level === 3).toBe(true)
  })
  it('대왕 몬스터는 벽에서 돌아서고, 체력이 반 이하면 빨라진다', () => {
    const s = newLevel(2); s.foes = []; s.p.inv = 99; s.p.x = 1.5; const b = s.boss!
    run(s, none, 12); expect(b.x).toBeGreaterThanOrEqual(1 + BOSS.hw - 1e-6); expect(b.x).toBeLessThanOrEqual(15 - BOSS.hw + 1e-6)
    const t = newLevel(2); t.foes = []; t.p.inv = 99; t.boss!.x = 6; t.boss!.dir = 1; t.boss!.hp = 2; const x0 = t.boss!.x; run(t, none, 1); expect(t.boss!.x - x0).toBeGreaterThan(BOSS.walk + 0.3)
  })
  it('작은 몬스터를 모두 없애도 대왕 몬스터가 남아 있으면 단계가 끝나지 않고, 둘 다 없애야 끝난다', () => {
    const s = newLevel(2); s.p.inv = 99; s.foes = []
    run(s, none, 0.3); expect(s.phase).toBe('play')
    s.boss = null; run(s, none, 0.3); expect(s.phase).toBe('clear')
    const t = newLevel(2); t.p.inv = 99; t.boss!.hp = 1; t.boss!.x = 8; t.p.x = 4.5; run(t, { ...none, shoot: true }, 0.5)
    expect(t.boss).toBeNull(); expect(t.phase).toBe('play') // 작은 몬스터가 남아 있으면 아직
  })
  it('대왕 몬스터는 바닥에만 있지 않고 점프로 발판에 올라가 이곳저곳 다니며, 화면 밖이나 바닥 아래로 가지 않는다', () => {
    for (const lv of [2, 5, 8]) {
      const s = newLevel(lv); s.foes = []; s.p.inv = 99; const b = s.boss!
      let minY = 99, maxY = 0, levels = new Set<number>()
      for (let i = 0; i < 60 * 60; i++) { step(s, none, 1 / 60, rnd); minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y); if (b.on) levels.add(Math.round(b.y)); expect(b.x).toBeGreaterThanOrEqual(1 + BOSS.hw - 1e-6); expect(b.x).toBeLessThanOrEqual(15 - BOSS.hw + 1e-6) }
      expect(minY).toBeLessThan(10); expect(maxY).toBeLessThanOrEqual(11 + 1e-6); expect(levels.size).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('별 거품 20단계', () => {
  it('20단계까지 있고, 대왕 단계(3·6·9·12·15·18·20)의 체력이 갈수록 늘어난다', () => {
    expect(LEVELS.length).toBe(20)
    const bosses = Object.keys(BOSS_LEVELS).map(Number).sort((a, b) => a - b)
    expect(bosses.map((n) => n + 1)).toEqual([3, 6, 9, 12, 15, 18, 20])
    const hp = bosses.map((n) => BOSS_LEVELS[n]); for (let i = 1; i < hp.length; i++) expect(hp[i]).toBeGreaterThan(hp[i - 1])
  })
  for (let n = 0; n < 20; n++) {
    it(`${n + 1}단계: 모든 발판에 뛰어 올라갈 수 있고, 괴물은 발판 위에 서 있다`, () => {
      const lv = LEVELS[n], reach = (CFG.jump * CFG.jump) / (2 * CFG.g) // 한 번 뛰어 오르는 높이(칸)
      const rows = [...lv.plats].sort((a, b) => b[0] - a[0])
      for (const [r, a, b] of lv.plats) {
        expect(a >= 1 && b <= COLS - 2 && a <= b).toBe(true)
        // 아래쪽 발판(또는 땅)이 reach 안에 있고 옆으로 3칸 안이면 뛰어 올라갈 수 있다
        const below = [ROWS - 1, ...rows.filter(([r2]) => r2 > r).map(([r2]) => r2)]
        const ok = below.some((r2) => r2 - r <= reach && (r2 === ROWS - 1 || lv.plats.some(([rr, aa, bb]) => rr === r2 && aa <= b + 3 && bb >= a - 3)))
        expect(ok, `발판 (${r},${a}-${b})이 너무 높아요`).toBe(true)
      }
      for (const [c, r] of lv.foes) expect(lv.plats.some(([pr, a, b]) => pr === r && c >= a && c <= b) || r === ROWS - 1, `괴물 (${c},${r})`).toBe(true)
    })
  }
})

describe('별 거품: 모든 단계를 시작해서 몇 초 돌려도 멈추지 않는다', () => {
  it('1~20단계', () => { for (let n = 0; n < 20; n++) { const s = newLevel(n); for (let i = 0; i < 60 * 5; i++) step(s, { ...none, right: i % 120 < 60, shoot: i % 20 === 0 }, 1 / 60, rnd); expect(Number.isFinite(s.p.x) && s.foes.every((f) => Number.isFinite(f.x))).toBe(true) } })
})
