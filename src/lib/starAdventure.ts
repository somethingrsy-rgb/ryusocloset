/**
 * 별 모험: 옆으로 달리는 발판 게임(규칙만, 화면과 분리). 걷고 뛰어서 별 코인을 모으고, 별 친구를 밟아 물리치고,
 * 파이프(관)로 들어가 보너스 방에 다녀온 뒤 깃발까지 간다. 좌표는 칸 단위, y 는 발바닥 높이(아래로 갈수록 커진다).
 */
export const ROWS = 12
export const CFG = { hw: 0.32, ph: 1.3, bigPh: 1.7, g: 38, jump: 16, walk: 6.2, foe: 1.6, lives: 3 /* 한 단계에 목숨 3개, 새 단계가 시작되면 다시 3개로 채운다 */, inv: 2, bounce: 11 }
export const SOLID = '#=?ulrLRefxy' // 땅, 벽돌, 물음표(쓰기 전·후), 파이프
export const levelWidth = 64

export interface Foe { id: number; x: number; y: number; vy: number; dir: 1 | -1; alive: boolean; squash: number }
/** 하트 약병: 물음표에서 튀어나와 그 자리(블록 위)에 가만히 있다. 먹으면 몸이 커진다 */
export interface Item { id: number; x: number; y: number; vy: number; dir: 1 | -1; t: number; vx?: number }
export interface Room { rows: string[][]; foes: Foe[]; w: number; items: Item[] }
export interface Player { x: number; y: number; vx: number; vy: number; on: boolean; dir: 1 | -1; inv: number; big: boolean; dj: boolean /* 공중에서 두 번째 점프를 이미 썼나 */ }
export interface State {
  level: number; room: 'main' | 'bonus'; main: Room; bonus: Room; p: Player; ret: { col: number; row: number }
  flagX: number; score: number; coins: number; lives: number; phase: 'play' | 'clear' | 'won' | 'over'; t: number; stars: number; fade: number; prevJump: boolean; prevDown: boolean; clearT: number; qHits: number; nextId: number
}
export interface Input { left: boolean; right: boolean; jump: boolean; down: boolean }
export type Ev = { k: 'jump' | 'coin' | 'bump' | 'break' | 'stomp' | 'hit' | 'shrink' | 'grow' | 'potion' | 'pipe' | 'clear' | 'won' | 'over' | 'fall'; x?: number; y?: number }

interface Spec { stairs?: [number, number][]; w: number; pits: [number, number][]; pipes: { c: number; h: number; enter?: boolean }[]; qs: [number, number][]; bricks: [number, number][]; plats: [number, number, number][]; coins: [number, number][]; foes: (number | [number, number])[] }
const SPECS: Spec[] = [
  { w: 64, pits: [[18, 20], [44, 47]], pipes: [{ c: 10, h: 2 }, { c: 28, h: 2, enter: true }, { c: 38, h: 2 }, { c: 52, h: 2 }],
    qs: [[14, 6], [16, 6], [34, 6], [56, 6]], bricks: [[15, 6], [17, 6], [33, 6], [35, 6]], plats: [[24, 5, 4], [8, 5, 5]], stairs: [[5, 9], [6, 9], [6, 8], [7, 9], [7, 8], [7, 7]],
    coins: [[21, 8], [22, 7], [23, 8], [41, 8], [42, 7], [43, 8], [45, 7], [46, 7], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4]], foes: [13, 22, 32, 41, 50, 58, [10, 5], [26, 5]] },
  { w: 64, pits: [[14, 17], [30, 33], [48, 51]], pipes: [{ c: 8, h: 2 }, { c: 22, h: 2, enter: true }, { c: 40, h: 2 }, { c: 56, h: 2 }],
    qs: [[12, 6], [26, 6], [27, 6], [44, 6]], bricks: [[11, 6], [13, 6], [25, 6], [28, 6]], plats: [[34, 6, 5], [46, 6, 4], [8, 5, 3]], stairs: [[5, 9], [6, 9], [6, 8], [7, 9], [7, 8], [7, 7]],
    coins: [[15, 8], [16, 8], [31, 8], [32, 8], [49, 8], [50, 8], [35, 5], [36, 5], [8, 4], [9, 4], [10, 4]], foes: [12, 19, 27, 36, 43, 53, 59, [9, 5], [36, 6]] },
  { w: 64, pits: [[12, 15], [26, 29], [38, 41], [50, 53]], pipes: [{ c: 8, h: 2 }, { c: 20, h: 2, enter: true }, { c: 33, h: 2 }, { c: 46, h: 2 }, { c: 58, h: 2 }],
    qs: [[11, 6], [24, 6], [37, 6], [49, 6]], bricks: [[12, 6], [23, 6], [25, 6], [36, 6], [38, 6]], plats: [[27, 6, 3], [44, 6, 2], [51, 5, 3], [8, 5, 3]], stairs: [[5, 9], [6, 9], [6, 8], [7, 9], [7, 8], [7, 7]],
    coins: [[13, 8], [14, 8], [27, 8], [28, 8], [39, 8], [40, 8], [51, 7], [52, 7], [53, 7], [8, 4], [9, 4], [10, 4]], foes: [11, 18, 24, 31, 36, 44, 49, 56, 60, [9, 5], [45, 6]] },
]
export const LEVELS = 20 // 20단계: 배경은 레이스 장소 6곳(초원·눈·사탕·과일·바닷속·할로윈)을 차례로 돌고, 1~6단계는 손으로 만든 3가지 모양, 7~20단계는 단계마다 다른 모양을 만든다
const HAND = 6

/** 단계가 올라갈수록 어려워진다: 괴물 걸음이 빨라지고(0단계는 조금 느리게), 괴물 수가 달라진다(처음엔 적게, 뒤로 갈수록 더 많이) */
export const foeSpeed = (level: number) => CFG.foe * (level < HAND ? 0.9 + 0.12 * level : 1.5 + 0.04 * (Math.min(level, LEVELS - 1) - (HAND - 1)))
const EXTRA_COLS = [16, 25, 35, 47, 55, 61]
function foesFor(sp: Spec, level: number): Spec['foes'] {
  if (level >= HAND) return sp.foes // 7단계부터는 만들 때 이미 단계에 맞는 수
  const base = sp.foes.filter((_, i) => (level === 0 ? i % 3 !== 1 : level === 1 ? i % 4 !== 1 : true))
  const extra = Math.max(0, level - 2) // 3단계부터 1마리씩 더(3·4·5·6단계: +1, +2, +3)
  if (!extra) return base
  const near = (c: number) => base.some((f) => Math.abs((typeof f === 'number' ? f : f[0]) - c) < 3)
  const free = (c: number) => !sp.pits.some(([a, b]) => c >= a - 2 && c <= b + 2) && !sp.pipes.some((p) => c >= p.c - 2 && c <= p.c + 3) && !near(c)
  return [...base, ...EXTRA_COLS.filter(free).slice(0, extra)]
}

/** 7~20단계 판: 단계 번호로 정해서 만든다(같은 단계는 늘 같은 모양). 단계가 올라갈수록 구덩이·관·괴물이 많고 간격이 좁아진다.
 *  넘을 수 있는 모양만 나오게 규칙을 지킨다(starAdventure.layout.test.ts): 관 높이 ≤2, 관 위 머리 공간, 구덩이 폭 ≤4, 장애물 사이 땅 ≥4칸 */
const generated = new Map<number, Spec>()
function genSpec(level: number): Spec {
  const hit = generated.get(level); if (hit) return hit
  let seed = (level * 7919 + 13) >>> 0
  const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const d = level - HAND // 0..13
  const w = 64 + 4 * Math.floor(d / 4)
  const sp: Spec = { w, pits: [], pipes: [], qs: [], bricks: [], plats: [], coins: [], stairs: [[5, 9], [6, 9], [6, 8], [7, 9], [7, 8], [7, 7]], foes: [] }
  const gap = Math.max(4, 7 - Math.floor(d / 3)) // 장애물 사이 땅(뒤로 갈수록 좁아짐, 늘 4칸 이상)
  const maxPit = Math.min(4, 2 + Math.floor(d / 4))
  let x = 11, enter = false
  const kinds: ('pit' | 'pipe' | 'bricks' | 'plat')[] = ['pit', 'pipe', 'bricks', 'plat', 'pit', 'pipe']
  let last = ''
  while (x < w - 12) {
    let k = kinds[Math.floor(rnd() * kinds.length)]
    if (k === last && k !== 'bricks') k = kinds[(kinds.indexOf(k) + 2) % kinds.length] // 같은 모양이 계속 나오지 않게
    last = k
    if (k === 'pit') {
      const n = 2 + Math.floor(rnd() * (maxPit - 1))
      sp.pits.push([x, x + n - 1])
      for (let i = 0; i < n; i++) sp.coins.push([x + i, i === 0 || i === n - 1 ? 8 : 7])
      x += n + gap
    } else if (k === 'pipe') {
      const h = rnd() < 0.5 ? 1 : 2
      sp.pipes.push({ c: x, h, enter: !enter && x > w / 3 ? (enter = true) : false })
      x += 2 + gap
    } else if (k === 'bricks') {
      sp.bricks.push([x, 6], [x + 2, 6]); sp.qs.push([x + 1, 6])
      x += 3 + gap
    } else {
      const n = 3 + Math.floor(rnd() * 3)
      sp.plats.push([x, 6, n])
      for (let i = 0; i < n; i++) sp.coins.push([x + i, 5])
      x += n + gap
    }
  }
  if (!sp.pipes.some((p) => p.enter) && sp.pipes.length) sp.pipes[0].enter = true
  // 괴물: 땅 위에서 구덩이·관에서 2칸 이상 떨어진 곳에, 서로 3칸 이상 떨어지게(수는 단계에 비례), 몇 마리는 발판 위에
  const total = 8 + Math.floor(d * 0.8)
  const ok = (c: number) => c >= 12 && c <= w - 8 && !sp.pits.some(([a, b]) => c >= a - 1 && c <= b + 1) && !sp.pipes.some((p) => c >= p.c - 1 && c <= p.c + 2) && !sp.plats.some(([pc, , n]) => c >= pc - 1 && c <= pc + n) && !sp.bricks.some(([bc]) => c >= bc - 1 && c <= bc + 1)
  const cols: number[] = []
  for (let tries = 0; cols.length < total && tries < 400; tries++) { const c = 12 + Math.floor(rnd() * (w - 20)); if (ok(c) && cols.every((q) => Math.abs(q - c) >= 2)) cols.push(c) }
  sp.foes = cols.sort((a, b) => a - b)
  for (const [pc, pr, n] of sp.plats) { sp.foes.push([pc + Math.floor(n / 2), pr]); if (d >= 6 && n >= 4) sp.foes.push([pc + n - 1, pr]) }
  generated.set(level, sp)
  return sp
}

function build(sp: Spec, level = 0): Room {
  const rows = Array.from({ length: ROWS }, () => Array<string>(sp.w).fill('.'))
  for (let c = 0; c < sp.w; c++) if (!sp.pits.some(([a, b]) => c >= a && c <= b)) { rows[10][c] = '#'; rows[11][c] = '#' }
  for (const p of sp.pipes) { const top = 10 - p.h; for (let r = top; r < 10; r++) { const t = r === top; rows[r][p.c] = t ? (p.enter ? 'e' : 'l') : 'L'; rows[r][p.c + 1] = t ? (p.enter ? 'f' : 'r') : 'R' } }
  for (const [c, r] of sp.qs) rows[r][c] = '?'
  for (const [c, r] of sp.bricks) rows[r][c] = '='
  for (const [c, r] of sp.stairs ?? []) rows[r][c] = '='
  for (const [r, c0, n] of sp.plats.map(([a, b, n]) => [b, a, n] as [number, number, number])) for (let c = c0; c < c0 + n; c++) rows[r][c] = '='
  for (const [c, r] of sp.coins) rows[r][c] = 'o'
  for (let r = 2; r < 10; r++) rows[r][sp.w - 4] = 'F'
  const foes: Foe[] = foesFor(sp, level).map((f, i) => { const [c, r] = typeof f === 'number' ? [f, 10] : f; return { id: i + 1, x: c + 0.5, y: r, vy: 0, dir: -1 as const, alive: true, squash: 0 } })
  return { rows, foes, w: sp.w, items: [] }
}
function bonusRoom(): Room {
  const w = 22, rows = Array.from({ length: ROWS }, () => Array<string>(w).fill('.'))
  for (let c = 0; c < w; c++) { rows[10][c] = '#'; rows[11][c] = '#'; rows[0][c] = '='; rows[1][c] = '=' }
  for (let r = 0; r < ROWS; r++) rows[r][0] = '='
  rows[8][19] = 'x'; rows[8][20] = 'y'; rows[9][19] = 'L'; rows[9][20] = 'R'
  rows[9][8] = '='; rows[9][9] = '=' // 계단 → 높은 판으로 올라가 위쪽 별까지 먹을 수 있다
  for (let c = 11; c <= 17; c++) rows[7][c] = '='
  for (let c = 3; c <= 7; c++) rows[8][c] = 'o' // 바닥에서 먹는 별
  for (let c = 11; c <= 17; c += 2) rows[6][c] = 'o' // 높은 판 위의 별
  for (let c = 11; c <= 17; c++) if (c % 2) rows[4][c] = 'o' // 점프로 먹는 위쪽 별
  return { rows, foes: [], w, items: [] }
}

export function newRun(level: number, keep?: Pick<State, 'score' | 'coins' | 'lives' | 'stars'>): State {
  const sp = level < HAND ? SPECS[level % SPECS.length] : genSpec(level)
  return { level, room: 'main', main: build(sp, level), bonus: bonusRoom(), p: { x: 2.5, y: 10, vx: 0, vy: 0, on: true, dir: 1, inv: 0, big: false, dj: false }, ret: { col: 0, row: 0 }, flagX: sp.w - 3.5,
    score: keep?.score ?? 0, coins: keep?.coins ?? 0, lives: keep?.lives ?? CFG.lives, phase: 'play', t: 0, stars: keep?.stars ?? 0, fade: 0, prevJump: false, prevDown: false, clearT: 0, qHits: 0, nextId: 1 }
}

const roomOf = (s: State) => (s.room === 'main' ? s.main : s.bonus)
const tileAt = (r: Room, c: number, row: number) => (row < 0 ? (c < 0 || c >= r.w ? '#' : '.') : c < 0 || c >= r.w ? '#' : row >= ROWS ? '.' : r.rows[row][c])
export const solid = (ch: string) => SOLID.includes(ch)
const E = 1e-4

export function step(s: State, inp: Input, dt: number): Ev[] {
  const ev: Ev[] = []
  let left = dt
  while (left > 1e-9) { const h = Math.min(left, 1 / 60); sub(s, inp, h, ev); left -= h }
  return ev
}

function hurt(s: State, ev: Ev[]) {
  if (s.p.big) { s.p.big = false; s.p.inv = 1.5; ev.push({ k: 'shrink', x: s.p.x, y: s.p.y }); return } // 커진 상태면 원래 크기로 돌아올 뿐 ♥는 그대로
  s.lives--; ev.push({ k: 'hit', x: s.p.x, y: s.p.y })
  if (s.lives <= 0) { s.phase = 'over'; ev.push({ k: 'over' }); return }
  s.p.inv = CFG.inv
}
/** 아래에서 블록을 치면 그 블록 위에 서 있던 괴물은 튕겨 나가 물리쳐진다 */
function killOnTop(s: State, R: Room, c: number, r: number, ev: Ev[]) {
  for (const f of R.foes) if (f.alive && Math.abs(f.x - (c + 0.5)) < 0.85 && f.y > r - 1.3 && f.y <= r + 0.25) { f.alive = false; s.score += 100; ev.push({ k: 'stomp', x: f.x, y: f.y }) }
}
function respawn(s: State) { s.p.big = false; s.room = 'main'; s.p.x = 2.5; s.p.y = 10; s.p.vx = s.p.vy = 0; s.p.on = true; s.p.inv = CFG.inv }

function sub(s: State, inp: Input, dt: number, ev: Ev[]) {
  if (s.phase === 'over' || s.phase === 'won') return
  s.t += dt; s.fade = Math.max(0, s.fade - dt)
  if (s.phase === 'clear') { s.clearT -= dt; if (s.clearT <= 0) { if (s.level + 1 >= LEVELS) { s.phase = 'won'; s.stars += 20; ev.push({ k: 'won' }) } else { const n = newRun(s.level + 1, { ...s, lives: CFG.lives }); Object.assign(s, n) } } return }
  const R = roomOf(s), p = s.p, hw = CFG.hw, ph = p.big ? CFG.bigPh : CFG.ph
  p.inv = Math.max(0, p.inv - dt)
  const mv = (inp.right ? 1 : 0) - (inp.left ? 1 : 0)
  p.vx = mv * CFG.walk; if (mv) p.dir = mv > 0 ? 1 : -1
  if (p.on) p.dj = false
  if (inp.jump && !s.prevJump) {
    if (p.on) { p.vy = -CFG.jump; p.on = false; ev.push({ k: 'jump', x: p.x, y: p.y }) }
    else if (!p.dj) { p.dj = true; p.vy = -CFG.jump * 0.95; ev.push({ k: 'jump', x: p.x, y: p.y }) } // 공중에서 한 번 더 뛴다(더블 점프)
  }
  if (!inp.jump && p.vy < -5) p.vy = -5 // 짧게 누르면 낮게 뛴다
  s.prevJump = inp.jump
  // 파이프로 들어가기(아래 버튼, 파이프 위에 서 있을 때)
  if (inp.down && !s.prevDown && p.on) {
    const ch = tileAt(R, Math.floor(p.x), Math.round(p.y))
    if (s.room === 'main' && (ch === 'e' || ch === 'f')) { s.ret = { col: Math.floor(p.x) - (ch === 'f' ? 1 : 0), row: Math.round(p.y) }; s.room = 'bonus'; p.x = 3; p.y = 10; p.vx = p.vy = 0; s.fade = 0.5; ev.push({ k: 'pipe' }); s.prevDown = inp.down; return }
    if (s.room === 'bonus' && (ch === 'x' || ch === 'y')) { s.room = 'main'; p.x = s.ret.col + 1; p.y = s.ret.row; p.vx = p.vy = 0; s.fade = 0.5; ev.push({ k: 'pipe' }); s.prevDown = inp.down; return }
  }
  s.prevDown = inp.down
  // 옆으로 움직이고 벽에 막힌다
  p.x += p.vx * dt
  p.x = Math.max(hw, Math.min(R.w - hw, p.x))
  { const r0 = Math.floor(p.y - ph + E), r1 = Math.floor(p.y - E), c0 = Math.floor(p.x - hw + E), c1 = Math.floor(p.x + hw - E)
    // 벽에 닿으면 온 방향의 반대로만 밀어낸다(처음 닿은 한 칸으로 끝낸다. 속도를 0으로 바꾼 뒤 다른 줄에서 또 밀면 관 반대편으로 순간이동했다)
    const mvx = p.vx
    if (mvx !== 0) hit: for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(tileAt(R, c, r))) { p.x = mvx > 0 ? c - hw : c + 1 + hw; p.vx = 0; break hit } }
  // 위아래
  p.vy = Math.min(22, p.vy + CFG.g * dt); p.y += p.vy * dt; p.on = false
  { const c0 = Math.floor(p.x - hw + E), c1 = Math.floor(p.x + hw - E)
    if (p.vy >= 0) { const r = Math.floor(p.y + E); if (r >= 0 && r < ROWS) { for (let c = c0; c <= c1; c++) if (solid(tileAt(R, c, r)) && p.y - p.vy * dt <= r + 1e-3) { p.y = r; p.vy = 0; p.on = true; break } } }
    else { const r = Math.floor(p.y - ph); for (let c = c0; c <= c1; c++) { const ch = tileAt(R, c, r); if (r >= 0 && solid(ch)) {
      p.y = r + 1 + ph; p.vy = 0
      if (ch === '?' || ch === '=') killOnTop(s, R, c, r, ev)
      if (ch === '?') {
        R.rows[r][c] = 'u'; s.qHits++
        // 세 번에 한 번(1·4·7번째)은 하트 약병이 옆으로 튀어나와 아래 땅에 내려앉아 그 자리에 있고, 나머지는 코인
        if (s.qHits % 3 === 1) { R.items.push({ id: s.nextId++, x: c + 0.5, y: r, vy: -9, dir: p.x < c + 0.5 ? 1 : -1, t: 0, vx: (p.x < c + 0.5 ? 1 : -1) * 2.6 }); ev.push({ k: 'potion', x: c + 0.5, y: r }) }
        else { s.score += 10; s.coins++; ev.push({ k: 'coin', x: c + 0.5, y: r }) }
      }
      else if (ch === '=') { R.rows[r][c] = '.'; s.score += 5; ev.push({ k: 'break', x: c + 0.5, y: r }) } else ev.push({ k: 'bump', x: c + 0.5, y: r })
      break } } } }
  // 하트 약병: 튀어나온 뒤 블록 위에 내려앉아 그 자리에 있다(도망가지 않는다)
  for (const it of [...R.items]) {
    it.t += dt
    if (it.vx) { if (solid(tileAt(R, Math.floor(it.x + Math.sign(it.vx) * 0.4), Math.floor(it.y - 0.5)))) it.vx = 0; else it.x += it.vx * dt }
    const iy0 = it.y; it.vy = Math.min(20, it.vy + CFG.g * dt); it.y += it.vy * dt
    const ir = Math.floor(it.y + E); if (it.vy >= 0 && ir >= 0 && ir < ROWS && solid(tileAt(R, Math.floor(it.x), ir)) && iy0 <= ir + 1e-3) { it.y = ir; it.vy = 0; it.vx = 0 }
    if (it.y > ROWS + 4) { R.items.splice(R.items.indexOf(it), 1); continue }
    if (it.t > 0.4 && Math.abs(p.x - it.x) < 0.75 && p.y - 0.1 > it.y - 1.2 && p.y - ph < it.y) {
      R.items.splice(R.items.indexOf(it), 1); s.score += 50
      if (!p.big) { p.big = true; ev.push({ k: 'grow', x: it.x, y: it.y }) } else ev.push({ k: 'coin', x: it.x, y: it.y })
    }
  }
  // 별 코인
  for (let r = Math.floor(p.y - ph); r <= Math.floor(p.y); r++) for (let c = Math.floor(p.x - 0.5); c <= Math.floor(p.x + 0.5); c++) if (tileAt(R, c, r) === 'o' && Math.abs(c + 0.5 - p.x) < 0.8 && Math.abs(r + 0.5 - (p.y - 0.65)) < 1) { R.rows[r][c] = '.'; s.score += 10; s.coins++; ev.push({ k: 'coin', x: c + 0.5, y: r + 0.5 }) }
  // 별 친구
  for (const f of R.foes) {
    if (!f.alive) { f.squash += dt; continue }
    const ahead = tileAt(R, Math.floor(f.x + f.dir * 0.45), Math.floor(f.y - 0.5))
    if (solid(ahead) || f.x < 0.6 || f.x > R.w - 0.6) f.dir = (f.dir * -1) as 1 | -1
    if (f.vy === 0) { const fx = f.x + f.dir * 0.5; if (!solid(tileAt(R, Math.floor(fx), Math.round(f.y)))) f.dir = (f.dir * -1) as 1 | -1 } // 낭떠러지 앞에서 돌아선다(떨어져 혼자 죽지 않게)
    f.x += f.dir * foeSpeed(s.level) * dt
    const y0 = f.y; f.vy = Math.min(20, f.vy + CFG.g * dt); f.y += f.vy * dt
    const r = Math.floor(f.y + E); if (f.vy >= 0 && r >= 0 && r < ROWS && solid(tileAt(R, Math.floor(f.x), r)) && y0 <= r + 1e-3) { f.y = r; f.vy = 0 }
    if (f.y > ROWS + 4) f.alive = false
    if (s.phase === 'play' && Math.abs(p.x - f.x) < 0.65 && p.y - 0.1 > f.y - 1.2 && p.y - ph < f.y) {
      if (p.vy > 0 && p.y - 0.3 < f.y - 0.55) { f.alive = false; p.vy = -CFG.bounce; s.score += 100; ev.push({ k: 'stomp', x: f.x, y: f.y }) }
      else if (p.inv <= 0) { hurt(s, ev); p.vy = -8; p.on = false }
    }
  }
  // 구덩이에 빠지면 처음으로
  if (p.y > ROWS + 3) { ev.push({ k: 'fall' }); hurt(s, ev); if (s.phase === 'play') respawn(s) }
  // 깃발
  if (s.phase === 'play' && s.room === 'main' && p.x >= s.flagX) { s.phase = 'clear'; s.clearT = 2.2; s.score += 500; s.stars += 5; ev.push({ k: 'clear' }) }
}
