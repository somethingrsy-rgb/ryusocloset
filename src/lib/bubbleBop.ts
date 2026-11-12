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
  lives: 5, inv: 2.5, clearWait: 2.5, fruitLife: 12,
  pts: { foe: 100, bubble: 10, fruit: [100, 200, 300, 400, 500] },
}

export interface Level { plats: [row: number, c0: number, c1: number][]; foes: [col: number, row: number][] }
export const LEVELS: Level[] = [
  { plats: [[8, 1, 5], [8, 10, 14], [5, 4, 11], [2, 1, 5], [2, 10, 14]], foes: [[12, 8], [3, 2], [7, 5]] },
  { plats: [[8, 3, 12], [5, 1, 5], [5, 10, 14], [2, 5, 10]], foes: [[6, 8], [2, 5], [12, 5], [7, 2]] },
  { plats: [[9, 1, 4], [9, 11, 14], [6, 3, 12], [3, 1, 4], [3, 11, 14]], foes: [[2, 9], [13, 9], [7, 6], [2, 3], [13, 3]] },
]

export interface Body { x: number; y: number; vx: number; vy: number; on: boolean }
export interface Foe extends Body { id: number; dir: 1 | -1; mad: boolean; jumpT: number }
export interface Player extends Body { dir: 1 | -1; inv: number; cd: number; prevJump: boolean }
export interface Bubble { id: number; x: number; y: number; vx: number; vy: number; t: number; life: number; foe: Foe | null }
export interface Fruit { id: number; x: number; y: number; vy: number; kind: number; t: number; pts: number }
export interface State {
  level: number; grid: boolean[][]; p: Player; foes: Foe[]; bubbles: Bubble[]; fruits: Fruit[]
  score: number; lives: number; phase: 'play' | 'clear' | 'won' | 'over'; clearT: number; nextId: number; t: number; stars: number
}
export interface Input { left: boolean; right: boolean; jump: boolean; shoot: boolean }
export type Ev = { k: 'jump' | 'shoot' | 'trap' | 'defeat' | 'pop' | 'fruit' | 'hit' | 'escape' | 'clear' | 'won' | 'over'; x?: number; y?: number }

export const SPAWN = { x: 2.5, y: 11 }

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
  return { level: n, grid: buildGrid(lv), p: newPlayer(), foes: lv.foes.map((f) => mkFoe(id++, f)), bubbles: [], fruits: [], score: keep?.score ?? 0, lives: keep?.lives ?? CFG.lives, phase: 'play', clearT: 0, nextId: id, t: 0, stars: keep?.stars ?? 0 }
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
    const sp = f.mad ? CFG.foeMad : CFG.foeWalk
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
  // ── 부딪힘
  if (s.phase === 'play' && p.inv <= 0) for (const f of s.foes) if (near(p.x, p.y - 0.65, f.x, f.y - 0.55, 0.62, 0.85)) {
    s.lives--; ev.push({ k: 'hit', x: p.x, y: p.y })
    if (s.lives <= 0) { s.phase = 'over'; ev.push({ k: 'over' }) } else { s.p = { ...newPlayer(), inv: CFG.inv, dir: p.dir } }
    break
  }
  // ── 단계 끝
  if (s.phase === 'play' && s.foes.length === 0 && !s.bubbles.some((b) => b.foe)) { s.phase = 'clear'; s.clearT = CFG.clearWait; s.stars += 5; ev.push({ k: 'clear' }) }
  if (s.phase === 'clear') {
    s.clearT -= dt
    if (s.clearT <= 0) {
      if (s.level + 1 >= LEVELS.length) { s.phase = 'won'; s.stars += 20; ev.push({ k: 'won' }) }
      else { const n = newLevel(s.level + 1, s); s.level = n.level; s.grid = n.grid; s.p = { ...n.p, inv: 1.5 }; s.foes = n.foes; s.bubbles = []; s.fruits = []; s.phase = 'play'; s.nextId = n.nextId }
    }
  }
}
