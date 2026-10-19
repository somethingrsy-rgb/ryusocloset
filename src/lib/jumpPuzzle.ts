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
