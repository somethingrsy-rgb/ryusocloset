/**
 * 점프 퍼즐 같이 하기: 여러 자리(사람 또는 컴퓨터)가 같은 판에서 번갈아 뛴다. 순수 계산만 담는다(화면·서버는 다른 파일).
 * 모두의 화면이 같은 결과가 되도록, 판은 씨앗(seed)으로 만들고 「수(액션) 목록」을 같은 순서로 적용한다.
 * 규칙은 혼자 하기(jumpPuzzle.ts)와 같다: 이웃한 말 위로 뛰어 빈칸에 앉고, 뛰어넘은 말은 내 주머니에 들어온다.
 * 한 번 뛴 말이 또 뛸 수 있으면 같은 자리가 이어서 뛸 수 있고(이어 뛰기), 「끝내기」로 차례를 넘긴다.
 */
import { COLORS, SIZE, newGame, movesFrom, findMove, allMoves, setsOf, type Board, type Move, type Pos } from './jumpPuzzle'

export const MAX_SEATS = 4
/** 자리 하나: 사람(uid) 또는 컴퓨터(동물 번호) */
export type Seat = { kind: 'human'; uid: string; name: string } | { kind: 'cpu'; animal: number }
/** 서버에 쌓이는 한 수: s = 자리 번호, 점프면 fr/fc → tr/tc, 끝내기면 e = 1 */
export interface Action { s: number; fr?: number; fc?: number; tr?: number; tc?: number; e?: 1 }
export interface MState {
  board: Board
  /** 자리마다 모은 말 수(색별) */
  pockets: number[][]
  /** 지금 차례인 자리 번호 */
  turn: number
  /** 방금 뛴 말(이어 뛸 수 있을 때). 이 말만 더 뛸 수 있다 */
  chain: Pos | null
  /** 지금까지 적용한 수의 개수 */
  applied: number
  seats: number
}

/** 같은 씨앗·같은 자리 수면 누구에게나 같은 처음 판 */
export function newMState(seed: number, seats: number): MState {
  let h = (seed >>> 0) || 1
  const rng = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296 }
  return { board: newGame(rng).board, pockets: Array.from({ length: seats }, () => Array(COLORS).fill(0)), turn: 0, chain: null, applied: 0, seats }
}

const nextSeat = (s: MState) => (s.turn + 1) % s.seats
const clone = (b: Board): Board => b.map((row) => [...row] as Board[number])
export const isMOver = (s: MState) => allMoves(s.board).length === 0

/** 수 하나를 적용한다. 규칙에 맞지 않으면(차례가 아닌 자리, 이어 뛰기가 아닌 말, 못 뛰는 수) 같은 상태를 그대로 돌려준다 */
export function applyAction(s: MState, a: Action): MState {
  if (a.s !== s.turn || isMOver(s)) return s
  if (a.e === 1) {
    if (!s.chain) return s
    return { ...s, chain: null, turn: nextSeat(s), applied: s.applied + 1 }
  }
  const { fr, fc, tr, tc } = a
  if (![fr, fc, tr, tc].every((n) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < SIZE)) return s
  const from = { r: fr as number, c: fc as number }, to = { r: tr as number, c: tc as number }
  if (s.chain && (s.chain.r !== from.r || s.chain.c !== from.c)) return s
  const m = findMove(s.board, from, to)
  if (!m) return s
  const board = clone(s.board)
  const caught = board[m.over.r][m.over.c]
  board[m.to.r][m.to.c] = board[m.from.r][m.from.c]
  board[m.from.r][m.from.c] = 0
  board[m.over.r][m.over.c] = 0
  const pockets = s.pockets.map((p, i) => { if (i !== s.turn) return p; const q = [...p]; q[caught - 1]++; return q })
  const more = movesFrom(board, m.to).length > 0
  return { ...s, board, pockets, chain: more ? m.to : null, turn: more ? s.turn : nextSeat(s), applied: s.applied + 1 }
}
export const actionOf = (s: number, m: Move): Action => ({ s, fr: m.from.r, fc: m.from.c, tr: m.to.r, tc: m.to.c })

/** 자리마다 점수: 세트 수가 먼저, 같으면 모은 말 수 */
export const scoreOf = (p: number[]) => setsOf(p) * 1000 + p.reduce((a, b) => a + b, 0)
/** 결과: 1등 자리 번호들(같은 점수면 모두 1등 = 공동 우승) */
export function winnersOf(s: Pick<MState, 'pockets'>): number[] {
  const sc = s.pockets.map(scoreOf), best = Math.max(...sc)
  return sc.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0)
}
/** 별: 세트 하나마다 5개 + 끝까지 했으면 참가 선물 10개 + 1등이면 60개 더 */
export const SET_STARS = 5, JOIN_STARS = 10, WIN_STARS = 60
export function rewardFor(s: Pick<MState, 'pockets'>, seat: number): number {
  const sets = setsOf(s.pockets[seat])
  return sets * SET_STARS + JOIN_STARS + (winnersOf(s).includes(seat) ? WIN_STARS : 0)
}
