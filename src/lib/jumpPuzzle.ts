/** 점프 퍼즐(혼자 하는 말 뛰어넘기): 8×8 판에 4가지 색 말을 채우고 가운데 2×2만 비운다. 말을 가로·세로로 이웃한 말 위로 뛰어넘어 빈칸에 내려놓으면 뛰어넘은 말을 모은다. */
export const SIZE = 8
export const COLORS = 4
/** 보상: 4색을 하나씩 모은 한 세트마다 코인 */
export const COINS_PER_SET = 5
export type Cell = 0 | 1 | 2 | 3 | 4 // 0 = 빈칸, 1~4 = 색
export type Board = Cell[][]
export interface Pos { r: number; c: number }
export interface Move { from: Pos; over: Pos; to: Pos }
export interface Game {
  board: Board
  /** 색별로 모은 말 수 (index 0 = 1번 색) */
  pocket: number[]
  /** 지금까지 한 수 (되돌리기용). 각 항목은 그 수를 두기 전 상태 */
  history: { board: Board; pocket: number[] }[]
}

const CENTER = new Set([`${SIZE / 2 - 1},${SIZE / 2 - 1}`, `${SIZE / 2 - 1},${SIZE / 2}`, `${SIZE / 2},${SIZE / 2 - 1}`, `${SIZE / 2},${SIZE / 2}`])
const clone = (b: Board): Board => b.map((row) => [...row] as Cell[])

/** 새 판: 가운데 4칸을 빼고 4가지 색을 같은 수(60칸 → 15개씩)로 섞어 채운다. rng 는 0 이상 1 미만의 수를 돌려주는 함수 */
export function newGame(rng: () => number = Math.random): Game {
  const cells: Pos[] = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!CENTER.has(`${r},${c}`)) cells.push({ r, c })
  const colors: Cell[] = cells.map((_, i) => ((i % COLORS) + 1) as Cell)
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[colors[i], colors[j]] = [colors[j], colors[i]]
  }
  const board: Board = Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(0))
  cells.forEach((p, i) => { board[p.r][p.c] = colors[i] })
  return { board, pocket: Array(COLORS).fill(0), history: [] }
}

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const
const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE

/** 이 말이 지금 뛸 수 있는 모든 수 */
export function movesFrom(board: Board, from: Pos): Move[] {
  if (!board[from.r]?.[from.c]) return []
  const out: Move[] = []
  for (const [dr, dc] of DIRS) {
    const orr = from.r + dr, oc = from.c + dc, tr = from.r + 2 * dr, tc = from.c + 2 * dc
    if (inside(tr, tc) && board[orr][oc] !== 0 && board[tr][tc] === 0) out.push({ from, over: { r: orr, c: oc }, to: { r: tr, c: tc } })
  }
  return out
}

export function allMoves(board: Board): Move[] {
  const out: Move[] = []
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) out.push(...movesFrom(board, { r, c }))
  return out
}

/** (from → to) 로 뛰는 수가 가능하면 그 수, 아니면 null */
export function findMove(board: Board, from: Pos, to: Pos): Move | null {
  return movesFrom(board, from).find((m) => m.to.r === to.r && m.to.c === to.c) ?? null
}

export function applyMove(game: Game, move: Move): Game {
  if (!findMove(game.board, move.from, move.to)) return game
  const board = clone(game.board)
  const caught = board[move.over.r][move.over.c]
  board[move.to.r][move.to.c] = board[move.from.r][move.from.c]
  board[move.from.r][move.from.c] = 0
  board[move.over.r][move.over.c] = 0
  const pocket = [...game.pocket]
  pocket[caught - 1]++
  return { board, pocket, history: [...game.history, { board: game.board, pocket: game.pocket }] }
}

export function undo(game: Game): Game {
  const last = game.history[game.history.length - 1]
  return last ? { board: last.board, pocket: last.pocket, history: game.history.slice(0, -1) } : game
}

/** 4색을 하나씩 모은 세트 수 */
export const setsOf = (pocket: number[]) => Math.min(...pocket)
export const isOver = (board: Board) => allMoves(board).length === 0

/* ---------- 컴퓨터와 겨루기 ---------- */
/** 이긴 사람에게 주는 보너스 코인 (세트 코인과 별도) */
export const WIN_BONUS = 15
export interface Vs {
  board: Board
  mine: number[]
  cpu: number[]
  turn: 'me' | 'cpu'
  /** 내가 방금 뛴 말(이어서 더 뛸 수 있을 때). 이 말만 더 뛸 수 있고 "끝내기"로 차례를 넘긴다 */
  chain: Pos | null
  /** 컴퓨터가 이번 차례에 방금 뛴 말(이어 뛰는 중). 이어 뛸 때는 이 말만 움직인다 */
  cpuChain: Pos | null
}
export const newVs = (rng: () => number = Math.random): Vs => ({ board: newGame(rng).board, mine: Array(COLORS).fill(0), cpu: Array(COLORS).fill(0), turn: 'me', chain: null, cpuChain: null })

function jump(board: Board, m: Move): { board: Board; caught: Cell } {
  const b = clone(board)
  const caught = b[m.over.r][m.over.c]
  b[m.to.r][m.to.c] = b[m.from.r][m.from.c]
  b[m.from.r][m.from.c] = 0
  b[m.over.r][m.over.c] = 0
  return { board: b, caught }
}

/** 내가 한 번 뛴다. 이어서 같은 말로 더 뛸 수 있으면 chain 이 남고, 없으면 컴퓨터 차례가 된다 */
export function vsHumanMove(vs: Vs, m: Move): Vs {
  if (vs.turn !== 'me' || (vs.chain && (vs.chain.r !== m.from.r || vs.chain.c !== m.from.c))) return vs
  if (!findMove(vs.board, m.from, m.to)) return vs
  const { board, caught } = jump(vs.board, m)
  const mine = [...vs.mine]; mine[caught - 1]++
  const more = movesFrom(board, m.to).length > 0
  return { ...vs, board, mine, chain: more ? m.to : null, turn: more ? 'me' : 'cpu' }
}
export const vsEndTurn = (vs: Vs): Vs => (vs.turn === 'me' && vs.chain ? { ...vs, chain: null, turn: 'cpu' } : vs)
export function vsCpuMove(vs: Vs, m: Move, last: boolean): Vs {
  if (!findMove(vs.board, m.from, m.to)) return { ...vs, turn: 'me', cpuChain: null }
  const { board, caught } = jump(vs.board, m)
  const cpu = [...vs.cpu]; cpu[caught - 1]++
  return { ...vs, board, cpu, turn: last ? 'me' : 'cpu', cpuChain: last ? null : m.to }
}

export type Level = 'easy' | 'normal' | 'hard'
/** 난이도별 컴퓨터: random = 아무 수나 둘 확률, stop/stepStop = 이어 뛸 수 있을 때 멈출 확률(첫 점프 뒤 stop, 한 번 더 뛸 때마다 stepStop 만큼 늘어남), noise = 점수에 섞는 흔들림, chain = 이어 뛸 수 있는 수에 주는 점수 */
const LEVELS: Record<Level, { random: number; stop: number; stepStop: number; noise: number; chain: number }> = {
  easy: { random: 0.6, stop: 1, stepStop: 0, noise: 1, chain: 0 },
  normal: { random: 0.15, stop: 0.3, stepStop: 0.3, noise: 0.5, chain: 0 },
  hard: { random: 0, stop: 0.1, stepStop: 0.2, noise: 0.1, chain: 0.6 },
}

/** 컴퓨터가 이번 차례에 할 수를 미리 정한다(연속 점프 포함, 최대 3번). 모자란 색을 잡는 수를 좋아하고, 난이도에 따라 실수·연속 점프 정도가 다르다 */
export function planCpuTurn(board: Board, cpu: number[], rng: () => number = Math.random, level: Level = 'normal', start: Pos | null = null): Move[] {
  const L = LEVELS[level]
  const plan: Move[] = []
  let b = board
  let from: Pos | null = start
  const have = [...cpu]
  for (let step = 0; step < 3; step++) {
    const moves: Move[] = from ? movesFrom(b, from) : allMoves(b)
    if (moves.length === 0) break
    const top = Math.max(...have)
    const score = (m: Move) => {
      const next = jump(b, m).board
      return top - have[b[m.over.r][m.over.c] - 1] + 1 + rng() * L.noise + (movesFrom(next, m.to).length > 0 ? L.chain : 0)
    }
    const m: Move = rng() < L.random ? moves[Math.floor(rng() * moves.length)] : moves.map((x) => ({ x, v: score(x) })).reduce((best, y) => (y.v > best.v ? y : best)).x
    plan.push(m)
    const r = jump(b, m)
    have[r.caught - 1]++
    b = r.board
    from = m.to
    if (movesFrom(b, m.to).length === 0 || rng() < L.stop + step * L.stepStop) break
  }
  return plan
}

/** 결과: 세트가 많은 쪽이 이기고, 같으면 모은 말이 많은 쪽, 그래도 같으면 비김 */
export function vsResult(vs: Pick<Vs, 'mine' | 'cpu'>): 'win' | 'lose' | 'draw' {
  const a = setsOf(vs.mine), b = setsOf(vs.cpu)
  if (a !== b) return a > b ? 'win' : 'lose'
  const x = vs.mine.reduce((s, n) => s + n, 0), y = vs.cpu.reduce((s, n) => s + n, 0)
  return x === y ? 'draw' : x > y ? 'win' : 'lose'
}

/** 이어서 하려고 저장해 두는 판 상태 */
export interface Saved { mode: 'solo' | 'vs'; game: Game; vs: Vs; paid: number; bonusPaid: number }

const okBoard = (b: unknown): b is Board => Array.isArray(b) && b.length === SIZE && b.every((row) => Array.isArray(row) && row.length === SIZE && row.every((v) => Number.isInteger(v) && v >= 0 && v <= COLORS))
const okPocket = (p: unknown): p is number[] => Array.isArray(p) && p.length === COLORS && p.every((n) => Number.isInteger(n) && n >= 0)
const okPos = (p: unknown): p is Pos => !!p && typeof p === 'object' && Number.isInteger((p as Pos).r) && Number.isInteger((p as Pos).c)

/** 저장된 값이 쓸 수 있는 모양인지 검사하고, 아니면 null (새 판으로 시작) */
export function parseSaved(raw: unknown): Saved | null {
  const s = raw as Saved | null
  if (!s || typeof s !== 'object' || (s.mode !== 'solo' && s.mode !== 'vs')) return null
  const g = s.game, v = s.vs
  if (!g || !okBoard(g.board) || !okPocket(g.pocket) || !Array.isArray(g.history) || !g.history.every((h) => okBoard(h?.board) && okPocket(h?.pocket))) return null
  if (!v || !okBoard(v.board) || !okPocket(v.mine) || !okPocket(v.cpu) || (v.turn !== 'me' && v.turn !== 'cpu') || (v.chain !== null && !okPos(v.chain)) || (v.cpuChain != null && !okPos(v.cpuChain))) return null
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0)
  return { mode: s.mode, game: g, vs: { ...v, cpuChain: v.cpuChain ?? null }, paid: n(s.paid), bonusPaid: n(s.bonusPaid) }
}
