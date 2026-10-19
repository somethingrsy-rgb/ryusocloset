import { describe, expect, it } from 'vitest'
import { COLORS, SIZE, allMoves, applyMove, findMove, isOver, movesFrom, newGame, setsOf, undo, type Board } from './jumpPuzzle'

const seeded = () => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647) }
const empty = (): Board => Array.from({ length: SIZE }, () => Array(SIZE).fill(0))

describe('점프 퍼즐', () => {
  it('새 판은 가운데 4칸만 비고 네 색이 15개씩이다', () => {
    const g = newGame(seeded())
    const flat = g.board.flat()
    expect(flat.filter((v) => v === 0)).toHaveLength(4)
    for (const k of [3, 4]) for (const j of [3, 4]) expect(g.board[k][j]).toBe(0)
    for (let c = 1; c <= COLORS; c++) expect(flat.filter((v) => v === c)).toHaveLength(15)
  })
  it('처음에는 뛸 수 있는 수가 있고 가운데 쪽으로만 뛴다', () => {
    const g = newGame(seeded())
    const moves = allMoves(g.board)
    expect(moves.length).toBeGreaterThan(0)
    expect(moves.every((m) => g.board[m.to.r][m.to.c] === 0)).toBe(true)
  })
  it('이웃한 말을 뛰어넘어 빈칸에 내려놓고 그 말을 모은다', () => {
    const b = empty(); b[0][0] = 1; b[0][1] = 3
    const g = applyMove({ board: b, pocket: [0, 0, 0, 0], history: [] }, { from: { r: 0, c: 0 }, over: { r: 0, c: 1 }, to: { r: 0, c: 2 } })
    expect(g.board[0][0]).toBe(0); expect(g.board[0][1]).toBe(0); expect(g.board[0][2]).toBe(1)
    expect(g.pocket).toEqual([0, 0, 1, 0])
  })
  it('대각선, 빈칸 뛰어넘기, 두 칸 이상 뛰기, 말 위에 내리기는 안 된다', () => {
    const b = empty(); b[2][2] = 1; b[3][3] = 2; b[2][3] = 3; b[2][4] = 4; b[4][2] = 2
    expect(findMove(b, { r: 2, c: 2 }, { r: 4, c: 4 })).toBeNull() // 대각선
    expect(findMove(b, { r: 2, c: 2 }, { r: 2, c: 4 })).toBeNull() // 내릴 자리에 말이 있음
    expect(findMove(b, { r: 2, c: 2 }, { r: 0, c: 2 })).toBeNull() // 위는 빈칸
    expect(movesFrom(b, { r: 2, c: 2 })).toHaveLength(0)
  })
  it('판 밖으로는 뛰지 못한다', () => {
    const b = empty(); b[0][0] = 1; b[0][1] = 2
    expect(movesFrom(b, { r: 0, c: 1 })).toHaveLength(0)
  })
  it('되돌리기는 한 수 전으로 돌아간다', () => {
    const g0 = newGame(seeded()); const m = allMoves(g0.board)[0]
    const g1 = applyMove(g0, m)
    expect(g1.history).toHaveLength(1)
    const g2 = undo(g1)
    expect(g2.board).toEqual(g0.board); expect(g2.pocket).toEqual(g0.pocket)
    expect(undo(g0)).toBe(g0)
  })
  it('세트는 네 색 중 가장 적게 모은 수이고, 뛸 곳이 없으면 끝난다', () => {
    expect(setsOf([3, 2, 5, 4])).toBe(2); expect(setsOf([1, 0, 1, 1])).toBe(0)
    expect(isOver(empty())).toBe(true)
  })
})
