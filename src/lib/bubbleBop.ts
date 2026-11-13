/**
 * 별 거품: 한 화면 발판 게임(규칙만, 화면과 분리). 거품을 뿜어 별 친구를 가두고, 몸으로 터뜨리면 과일이 나온다.
 * 좌표는 칸 단위(가로 16 × 세로 12), y 는 발바닥 높이(아래로 갈수록 커진다). 발판은 아래에서 뛰어 통과하고 위에서 밟는다.
 */
export const COLS = 16, ROWS = 12
export const CFG = {
  hw: 0.32, ph: 1.3, // 내 몸 반폭·키
  g: 32, jump: 16.5, walk: 6, // 중력·점프 힘·걷기 속도
  shootCd: 0.35, bubbleSpeed: 10, bubbleFly: 0.3, bubbleRise: 1.8, bubbleLife: 9, trapLife: 8,
  foeWalk: 1.6, foeMad: 3, foeJump: 13,
  lives: 3, inv: 2.5, // 한 단계에 목숨 3개, 새 단계가 시작되면 다시 3개로 채운다
  clearWait: 2.5, fruitLife: 12,
  pts: { foe: 100, bubble: 10, fruit: [100, 200, 300, 400, 500] },
}

export interface Level { plats: [row: number, c0: number, c1: number][]; foes: [col: number, row: number][] }
export const LEVELS: Level[] = [
  { plats: [[8, 1, 5], [8, 10, 14], [5, 4, 11], [2, 1, 5], [2, 10, 14]], foes: [[12, 8], [3, 2], [7, 5]] },
  { plats: [[8, 3, 12], [5, 1, 5], [5, 10, 14], [2, 5, 10]], foes: [[6, 8], [2, 5], [12, 5], [7, 2]] },
  { plats: [[9, 1, 4], [9, 11, 14], [6, 3, 12], [3, 1, 4], [3, 11, 14]], foes: [[2, 9], [13, 9], [7, 6], [2, 3], [13, 3]] },
  { plats: [[9, 1, 6], [9, 9, 14], [6, 4, 11], [3, 1, 5], [3, 10, 14]], foes: [[3, 9], [12, 9], [7, 6], [3, 3], [12, 3]] },
  { plats: [[8, 1, 3], [8, 6, 9], [8, 12, 14], [5, 3, 6], [5, 9, 12], [2, 1, 4], [2, 11, 14]], foes: [[2, 8], [13, 8], [7, 8], [4, 5], [10, 5]] },
  { plats: [[9, 1, 5], [9, 10, 14], [6, 2, 6], [6, 9, 13], [3, 5, 10]], foes: [[3, 9], [12, 9], [4, 6], [11, 6], [7, 3], [6, 3]] },
  { plats: [[9, 1, 3], [9, 5, 10], [9, 12, 14], [6, 2, 6], [6, 9, 13], [3, 4, 11]], foes: [[2, 9], [7, 9], [13, 9], [4, 6], [11, 6], [7, 3]] },
  { plats: [[8, 1, 6], [8, 9, 14], [5, 1, 3], [5, 6, 9], [5, 12, 14], [2, 3, 6], [2, 9, 12]], foes: [[3, 8], [12, 8], [2, 5], [13, 5], [7, 5], [4, 2]] },
  { plats: [[9, 1, 4], [9, 11, 14], [6, 5, 10], [6, 1, 3], [6, 12, 14], [3, 3, 6], [3, 9, 12]], foes: [[2, 9], [13, 9], [7, 6], [2, 6], [13, 6], [4, 3], [10, 3]] },
]

export interface Body { x: number; y: number; vx: number; vy: number; on: boolean }
export interface Foe extends Body { id: number; dir: 1 | -1; mad: boolean; jumpT: number }
export interface Player extends Body { dir: 1 | -1; inv: number; cd: number; prevJump: boolean }
export interface Bubble { id: number; x: number; y: number; vx: number; vy: number; t: number; life: number; foe: Foe | null }
export interface Fruit { id: number; x: number; y: number; vy: number; kind: number; t: number; pts: number }
/** 대왕 몬스터: 3·6·9단계에 작은 몬스터들(3마리)과 함께 나오고, 그중 한 종류가 커진 모습이다. 거품에 맞으면 체력 1, 머리를 위에서 밟으면(콩!) 체력 2가 닳는다 */
export interface Boss { x: number; y: number; dir: 1 | -1; hp: number; max: number; hurt: number; age: number; /** 이 판의 작은 몬스터 중 어느 친구(번호)가 커진 모습인지 */ kindId: number; vx: number; vy: number; on: boolean; jumpT: number; dropT: number }
export const BOSS_LEVELS: Record<number, number> = { 2: 6, 5: 8, 8: 10 } // 단계 번호(0부터) → 체력
export const BOSS = { hw: 1.05, h: 2.6, walk: 1.4, madWalk: 2.4, hurtT: 0.55, stomp: 2, bounce: 13, jump: 17.5 }
export interface State {
  level: number; grid: boolean[][]; p: Player; foes: Foe[]; bubbles: Bubble[]; fruits: Fruit[]
  score: number; lives: number; phase: 'play' | 'clear' | 'won' | 'over'; clearT: number; nextId: number; t: number; stars: number; boss: Boss | null
}
export interface Input { left: boolean; right: boolean; jump: boolean; shoot: boolean }
export type Ev = { k: 'jump' | 'shoot' | 'trap' | 'defeat' | 'pop' | 'fruit' | 'hit' | 'escape' | 'bossHit' | 'bossStomp' | 'bossDown' | 'clear' | 'won' | 'over'; x?: number; y?: number }

export const SPAWN = { x: 2.5, y: 11 }

/** 그 자리 바로 밑(발바닥 높이 칸)에 발판이 있나 */
function tileUnder(grid: boolean[][], x: number, y: number) { const r = Math.round(y), c = Math.floor(x); return r >= ROWS - 1 || !!grid[r]?.[c] }
function buildGrid(lv: Level): boolean[][] {
  const g = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false))
  for (let c = 0; c < COLS; c++) g[ROWS - 1][c] = true
  for (const [r, a, b] of lv.plats) for (let c = a; c <= b; c++) g[r][c] = true
  return g
}
const newPlayer = (): Player => ({ x: SPAWN.x, y: SPAWN.y, vx: 0, vy: 0, on: true, dir: 1, inv: 0, cd: 0, prevJump: false })
const mkFoe = (id: number, [c, r]: [number, number]): Foe => ({ id, x: c + 0.5, y: r, vx: 0, vy: 0, on: true, dir: id % 2 ? 1 : -1, mad: false, jumpT: 2 + (id % 3) })

export function newLevel(n: number, keep?: Pick<State, 'score' | 'lives' | 'stars'>): State {
  const lv = LEVELS[n]
  let id = 1
  const bhp = BOSS_LEVELS[n]
  return { level: n, grid: buildGrid(lv), p: newPlayer(), foes: (bhp ? lv.foes.slice(0, 3) : lv.foes).map((f) => mkFoe(id++, f)), boss: bhp ? { x: COLS - 4, y: ROWS - 1, dir: -1, hp: bhp, max: bhp, hurt: 0, age: 0, kindId: 1 + (n % 3), vx: 0, vy: 0, on: true, jumpT: 2.5, dropT: 4 } : null, bubbles: [], fruits: [], score: keep?.score ?? 0, lives: keep?.lives ?? CFG.lives, phase: 'play', clearT: 0, nextId: id, t: 0, stars: keep?.stars ?? 0 }
}
export const newGame = () => newLevel(0)

/** 발판 위에 서기: 떨어지는 몸이 발판 윗면을 지나면 그 위에 선다 */
export function land(grid: boolean[][], b: { x: number; y: number; vy: number; on: boolean }, y0: number, hw: number) {
  b.on = false
  if (b.vy < 0) return
  const c0 = Math.max(0, Math.floor(b.x - hw)), c1 = Math.min(COLS - 1, Math.floor(b.x + hw))
  for (let r = Math.max(0, Math.ceil(y0 - 1e-6)); r <= Math.min(ROWS - 1, Math.floor(b.y + 1e-6)); r++) {
    for (let c = c0; c <= c1; c++) if (grid[r][c]) { b.y = r; b.vy = 0; b.on = true; return }
  }
}
const clampX = (x: number, hw: number) => Math.max(1 + hw, Math.min(COLS - 1 - hw, x))
const near = (ax: number, ay: number, bx: number, by: number, rx: number, ry: number) => Math.abs(ax - bx) < rx && Math.abs(ay - by) < ry

/** dt 초만큼 진행한다(긴 시간은 작게 나눠서). 일어난 일을 돌려준다 */
export function step(s: State, inp: Input, dt: number, rnd: () => number = Math.random): Ev[] {
  const ev: Ev[] = []
  let left = dt
  while (left > 1e-9) { const h = Math.min(left, 1 / 60); sub(s, inp, h, rnd, ev); left -= h }
  return ev
}

function sub(s: State, inp: Input, dt: number, rnd: () => number, ev: Ev[]) {
  if (s.phase === 'over' || s.phase === 'won') return
  s.t += dt
  const p = s.p, hw = CFG.hw
  // ── 나
  p.inv = Math.max(0, p.inv - dt); p.cd = Math.max(0, p.cd - dt)
  const mv = (inp.right ? 1 : 0) - (inp.left ? 1 : 0)
  p.vx = mv * CFG.walk; if (mv) p.dir = mv > 0 ? 1 : -1
  if (inp.jump && !p.prevJump && p.on) { p.vy = -CFG.jump; p.on = false; ev.push({ k: 'jump', x: p.x, y: p.y }) }
  p.prevJump = inp.jump
  if (inp.shoot && p.cd <= 0) {
    p.cd = CFG.shootCd
    s.bubbles.push({ id: s.nextId++, x: p.x + p.dir * 0.8, y: p.y - 0.75, vx: p.dir * CFG.bubbleSpeed, vy: 0, t: 0, life: CFG.bubbleLife, foe: null })
    ev.push({ k: 'shoot', x: p.x, y: p.y })
  }
  const y0 = p.y
  p.vy += CFG.g * dt; p.x = clampX(p.x + p.vx * dt, hw); p.y += p.vy * dt
  if (p.y - CFG.ph < 0.1) { p.y = CFG.ph + 0.1; if (p.vy < 0) p.vy = 0 }
  land(s.grid, p, y0, hw)
  // ── 별 친구
  for (const f of s.foes) {
    f.jumpT -= dt
    const sp = f.mad ? CFG.foeMad : CFG.foeWalk * (1 + 0.06 * s.level) // 단계가 올라갈수록 조금씩 빨라진다
    if (f.on) {
      const ax = f.x + f.dir * (hw + 0.15), r = Math.round(f.y)
      if (ax < 1.1 || ax > COLS - 1.1) f.dir = (f.dir * -1) as 1 | -1
      else if (!s.grid[Math.min(ROWS - 1, r)]?.[Math.floor(ax)] && !(r >= ROWS - 1) && rnd() < 0.05) f.dir = (f.dir * -1) as 1 | -1
      if (f.jumpT <= 0) { f.jumpT = 3 + rnd() * 3; if (p.y < f.y - 2 && Math.abs(p.x - f.x) < 5) { f.vy = -CFG.foeJump; f.on = false } }
    }
    f.vx = f.dir * sp
    const fy0 = f.y
    f.vy += CFG.g * dt; f.x = clampX(f.x + f.vx * dt, hw); if (f.x <= 1 + hw + 1e-6 || f.x >= COLS - 1 - hw - 1e-6) f.dir = (f.dir * -1) as 1 | -1
    f.y += f.vy * dt
    if (f.y - 1.1 < 0.1) { f.y = 1.2; if (f.vy < 0) f.vy = 0 }
    land(s.grid, f, fy0, hw)
  }
  // ── 거품
  for (const b of [...s.bubbles]) {
    b.t += dt
    if (!b.foe && b.t < CFG.bubbleFly) { b.x += b.vx * dt } else {
      if (!b.foe && b.t - dt < CFG.bubbleFly) { b.vx = 0; b.vy = -CFG.bubbleRise }
      b.y += b.vy * dt; if (b.y < 1.2) { b.y = 1.2; b.vx = Math.sin(b.id + s.t) * 0.6 }
      b.x += b.vx * dt
      if (!b.foe) b.life -= dt
      else { b.life -= dt; if (b.life <= 0) { // 갇힌 친구가 화가 나서 풀려난다
        const f = b.foe; f.x = b.x; f.y = Math.min(b.y + 0.4, ROWS - 1); f.vy = 0; f.mad = true; f.on = false; s.foes.push(f); s.bubbles.splice(s.bubbles.indexOf(b), 1); ev.push({ k: 'escape', x: b.x, y: b.y }); continue } }
    }
    b.x = clampX(b.x, 0.3)
    if (!b.foe && b.life <= 0) { s.bubbles.splice(s.bubbles.indexOf(b), 1); continue }
    // 별 친구를 가둔다
    if (!b.foe) for (const f of s.foes) if (near(b.x, b.y, f.x, f.y - 0.55, 0.85, 0.9)) {
      s.foes.splice(s.foes.indexOf(f), 1); b.foe = f; b.vx = 0; b.vy = -CFG.bubbleRise * 0.8; b.life = CFG.trapLife; b.t = Math.max(b.t, CFG.bubbleFly); ev.push({ k: 'trap', x: b.x, y: b.y }); break
    }
    // 대왕 몬스터에 맞으면 체력이 1 닳고 거품은 터진다
    const bo = s.boss
    if (bo && !b.foe && bo.hurt <= 0 && near(b.x, b.y, bo.x, bo.y - BOSS.h / 2, BOSS.hw + 0.4, BOSS.h / 2 + 0.3)) {
      s.bubbles.splice(s.bubbles.indexOf(b), 1); bo.hp--; bo.hurt = BOSS.hurtT; s.score += 20; ev.push({ k: 'bossHit', x: b.x, y: b.y }); continue
    }
    // 몸으로 터뜨린다(막 뿜은 거품은 잠깐 안전)
    if (b.t > 0.3 && near(p.x, p.y - CFG.ph / 2, b.x, b.y, 0.85, 1.05)) {
      s.bubbles.splice(s.bubbles.indexOf(b), 1)
      if (b.foe) {
        s.score += CFG.pts.foe; const kind = Math.floor(rnd() * CFG.pts.fruit.length)
        s.fruits.push({ id: s.nextId++, x: b.x, y: Math.min(b.y + 0.5, ROWS - 1.2), vy: 0, kind, t: 0, pts: CFG.pts.fruit[kind] })
        ev.push({ k: 'defeat', x: b.x, y: b.y })
      } else { s.score += CFG.pts.bubble; ev.push({ k: 'pop', x: b.x, y: b.y }) }
    }
  }
  // ── 과일
  for (const f of [...s.fruits]) {
    f.t += dt; const y0f = f.y; f.vy += CFG.g * 0.5 * dt; f.y += f.vy * dt
    const fb = { x: f.x, y: f.y, vy: f.vy, on: false }; land(s.grid, fb, y0f, 0.3); f.y = fb.y; f.vy = fb.vy
    if (f.t > CFG.fruitLife) { s.fruits.splice(s.fruits.indexOf(f), 1); continue }
    if (near(p.x, p.y - 0.6, f.x, f.y - 0.4, 0.8, 0.95)) { s.score += f.pts; s.fruits.splice(s.fruits.indexOf(f), 1); ev.push({ k: 'fruit', x: f.x, y: f.y }) }
  }
  // ── 대왕 몬스터: 바닥을 왔다 갔다 걷고(체력이 반 이하면 화가 나서 빨라진다), 머리를 밟으면 체력이 닳고, 몸에 닿으면 ♥가 줄어든다
  const bo = s.boss
  if (bo) {
    bo.age += dt; bo.hurt = Math.max(0, bo.hurt - dt)
    const sp = bo.hp <= bo.max / 2 ? BOSS.madWalk : BOSS.walk
    // 이곳저곳 다닌다: 발판 위를 걷다가 가장자리에서 돌아서거나(가끔은 그대로 내려가고), 가끔 크게 뛰어 위 발판으로 올라간다
    bo.jumpT -= dt; bo.dropT -= dt
    if (bo.on && bo.jumpT <= 0) { bo.vy = -BOSS.jump; bo.on = false; bo.jumpT = 2.4 + rnd() * 2.4; bo.dir = p.x >= bo.x ? 1 : -1 }
    if (bo.on) {
      const ahead = tileUnder(s.grid, bo.x + bo.dir * (BOSS.hw - 0.2), bo.y)
      if (!ahead) { if (bo.dropT <= 0) { bo.dropT = 4 + rnd() * 3 } else bo.dir = (bo.dir * -1) as 1 | -1 } // 가장자리: 보통은 돌아서고, 가끔은 내려간다
    }
    bo.x += bo.dir * sp * dt
    if (bo.x < 1 + BOSS.hw) { bo.x = 1 + BOSS.hw; bo.dir = 1 } else if (bo.x > COLS - 1 - BOSS.hw) { bo.x = COLS - 1 - BOSS.hw; bo.dir = -1 }
    const by0 = bo.y; bo.vy = Math.min(22, bo.vy + CFG.g * dt); bo.y += bo.vy * dt
    if (bo.y - BOSS.h < 0.3) { bo.y = BOSS.h + 0.3; if (bo.vy < 0) bo.vy = 0 } // 맨 위 칸 밖으로는 못 간다
    land(s.grid, bo, by0, BOSS.hw * 0.8)
    const top = bo.y - BOSS.h
    if (s.phase === 'play' && Math.abs(p.x - bo.x) < BOSS.hw + 0.15 && p.vy > 0 && p.y > top - 0.7 && p.y < top + 0.8 && bo.hurt <= 0) {
      bo.hp -= BOSS.stomp; bo.hurt = BOSS.hurtT; p.vy = -BOSS.bounce; p.on = false; s.score += 50; ev.push({ k: 'bossStomp', x: bo.x, y: top })
    } else if (s.phase === 'play' && p.inv <= 0 && Math.abs(p.x - bo.x) < BOSS.hw + 0.1 && p.y > top + 0.8 && p.y - CFG.ph < bo.y) {
      s.lives--; ev.push({ k: 'hit', x: p.x, y: p.y })
      if (s.lives <= 0) { s.phase = 'over'; ev.push({ k: 'over' }) } else { s.p = { ...newPlayer(), inv: CFG.inv, dir: p.dir } }
    }
    if (s.phase === 'play' && bo.hp <= 0) {
      s.boss = null; s.score += 1000; s.stars += 5
      for (let k = 0; k < 5; k++) s.fruits.push({ id: s.nextId++, x: bo.x - 2 + k, y: ROWS - 1, vy: -8 - k, kind: k % CFG.pts.fruit.length, t: 0, pts: CFG.pts.fruit[k % CFG.pts.fruit.length] })
      ev.push({ k: 'bossDown', x: bo.x, y: bo.y - BOSS.h / 2 })
    }
  }
  // ── 부딪힘
  if (s.phase === 'play' && p.inv <= 0) for (const f of s.foes) if (near(p.x, p.y - 0.65, f.x, f.y - 0.55, 0.62, 0.85)) {
    s.lives--; ev.push({ k: 'hit', x: p.x, y: p.y })
    if (s.lives <= 0) { s.phase = 'over'; ev.push({ k: 'over' }) } else { s.p = { ...newPlayer(), inv: CFG.inv, dir: p.dir } }
    break
  }
  // ── 단계 끝
  if (s.phase === 'play' && s.foes.length === 0 && !s.boss && !s.bubbles.some((b) => b.foe)) { s.phase = 'clear'; s.clearT = CFG.clearWait; s.stars += 5; ev.push({ k: 'clear' }) }
  if (s.phase === 'clear') {
    s.clearT -= dt
    if (s.clearT <= 0) {
      if (s.level + 1 >= LEVELS.length) { s.phase = 'won'; s.stars += 20; ev.push({ k: 'won' }) }
      else { const n = newLevel(s.level + 1, s); s.level = n.level; s.grid = n.grid; s.lives = CFG.lives; s.p = { ...n.p, inv: 1.5 }; s.foes = n.foes; s.boss = n.boss; s.bubbles = []; s.fruits = []; s.phase = 'play'; s.nextId = n.nextId }
    }
  }
}
