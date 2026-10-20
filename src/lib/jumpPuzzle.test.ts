import { describe, expect, it } from 'vitest'
import { ANIMALS, COLORS, SIZE, allMoves, applyMove, findMove, isOver, movesFrom, newGame, parseSaved, setsOf, undo, type Board } from './jumpPuzzle'

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

import { newVs, planCpuTurn, vsCpuMove, vsEndTurn, vsHumanMove, vsResult } from './jumpPuzzle'
describe('컴퓨터와 겨루기', () => {
  it('내가 뛰고 더 못 뛰면 컴퓨터 차례가 되고, 더 뛸 수 있으면 같은 말로 이어간다', () => {
    const b = empty(); b[0][0] = 1; b[0][1] = 2; b[0][3] = 3; b[4][4] = 4
    const vs = { ...newVs(seeded()), board: b }
    const one = vsHumanMove(vs, { from: { r: 0, c: 0 }, over: { r: 0, c: 1 }, to: { r: 0, c: 2 } })
    expect(one.mine).toEqual([0, 1, 0, 0]); expect(one.turn).toBe('me'); expect(one.chain).toEqual({ r: 0, c: 2 })
    expect(vsHumanMove(one, { from: { r: 4, c: 4 }, over: { r: 4, c: 3 }, to: { r: 4, c: 2 } })).toBe(one) // 이어갈 때는 그 말만
    const two = vsHumanMove(one, { from: { r: 0, c: 2 }, over: { r: 0, c: 3 }, to: { r: 0, c: 4 } })
    expect(two.mine).toEqual([0, 1, 1, 0]); expect(two.turn).toBe(0); expect(two.chain).toBeNull() // 더 뛸 수 없으면 차례가 넘어감
    const end = vsEndTurn(one)
    expect(end.turn).toBe(0); expect(end.chain).toBeNull() // 끝내기
  })
  it('컴퓨터는 가능한 수만 두고 차례를 내게 돌려준다', () => {
    let vs = newVs(seeded()); vs = { ...vs, turn: 0 }
    const plan = planCpuTurn(vs.board, vs.cpus[0], seeded())
    expect(plan.length).toBeGreaterThan(0); expect(plan.length).toBeLessThanOrEqual(3)
    plan.forEach((m, i) => { vs = vsCpuMove(vs, m, i === plan.length - 1) })
    expect(vs.turn).toBe('me')
    expect(vs.cpus[0].reduce((s, n) => s + n, 0)).toBe(plan.length)
  })
  it('결과: 세트 → 모은 말 → 비김 순서로 가린다', () => {
    expect(vsResult({ mine: [2, 2, 2, 2], cpus: [[1, 3, 3, 3]] })).toBe('win')
    expect(vsResult({ mine: [1, 1, 1, 1], cpus: [[2, 2, 2, 2]] })).toBe('lose')
    expect(vsResult({ mine: [2, 2, 2, 5], cpus: [[2, 2, 2, 3]] })).toBe('win')
    expect(vsResult({ mine: [2, 2, 2, 2], cpus: [[2, 2, 2, 2]] })).toBe('draw')
  })
  it('저장한 판은 그대로 불러오고, 망가진 값은 버린다', () => {
    const saved = { vs: newVs(seeded(), 2), bonusPaid: 60 }
    expect(parseSaved(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
    expect(parseSaved(null)).toBeNull()
    expect(parseSaved({ ...saved, vs: { ...saved.vs, board: [[1]] } })).toBeNull()
    expect(parseSaved({ ...saved, vs: { ...saved.vs, turn: 'zzz' } })).toBeNull()
  })
  it('난이도: 초급은 한 번만 뛰고, 고급은 이어 뛸 수 있는 수를 잘 둔다', () => {
    for (let k = 1; k <= 20; k++) {
      const vs = newVs(seeded()); const rng = (() => { let x = k; return () => ((x = (x * 16807) % 2147483647) / 2147483647) })()
      expect(planCpuTurn(vs.board, vs.cpus[0], rng, 'easy').length).toBe(1)
      const hard = planCpuTurn(vs.board, vs.cpus[0], rng, 'hard')
      expect(hard.length).toBeGreaterThan(0); expect(hard.length).toBeLessThanOrEqual(3)
    }
  })
  it('컴퓨터가 이어 뛸 때는 방금 뛴 말만 움직인다', () => {
    const b = empty(); b[0][0] = 1; b[0][1] = 2; b[0][3] = 3; b[2][2] = 4; b[3][2] = 1
    const plan = planCpuTurn(b, [0, 0, 0, 0], seeded(), 'hard', { r: 0, c: 0 })
    expect(plan.length).toBeGreaterThan(0)
    expect(plan[0].from).toEqual({ r: 0, c: 0 })
    plan.slice(1).forEach((m, i) => expect(m.from).toEqual(plan[i].to))
    expect(planCpuTurn(b, [0, 0, 0, 0], seeded(), 'hard', { r: 7, c: 7 })).toEqual([]) // 이어 뛸 수 없으면 빈 계획
  })
  it('컴퓨터 여러 대: 나 → 컴퓨터 1 → 2 → 3 → 나 순서로 차례가 돈다', () => {
    let vs = newVs(seeded(), 3)
    expect(vs.cpus).toHaveLength(3)
    expect(newVs(seeded(), 9).cpus).toHaveLength(3); expect(newVs(seeded(), 0).cpus).toHaveLength(1)
    vs = { ...vs, turn: 0 }
    const seen: (string | number)[] = []
    for (let k = 0; k < 3; k++) {
      const plan = planCpuTurn(vs.board, vs.cpus[vs.turn as number], seeded())
      plan.forEach((m, i) => { vs = vsCpuMove(vs, m, i === plan.length - 1) })
      seen.push(vs.turn)
    }
    expect(seen).toEqual([1, 2, 'me'])
    expect(vs.cpus.map((p) => p.reduce((s, n) => s + n, 0)).every((n) => n > 0)).toBe(true)
  })
  it('컴퓨터 여러 대의 결과: 가장 높은 쪽이 이긴다', () => {
    expect(vsResult({ mine: [2, 2, 2, 2], cpus: [[1, 1, 1, 1], [1, 2, 2, 2], [0, 1, 1, 1]] })).toBe('win')
    expect(vsResult({ mine: [2, 2, 2, 2], cpus: [[1, 1, 1, 1], [3, 3, 3, 3]] })).toBe('lose')
    expect(vsResult({ mine: [2, 2, 2, 2], cpus: [[1, 1, 1, 1], [2, 2, 2, 2]] })).toBe('draw')
  })
  it('예전 저장본(컴퓨터 1대)도 불러온다', () => {
    const old = { vs: { board: newVs(seeded()).board, mine: [0, 0, 0, 0], cpu: [1, 0, 0, 0], turn: 'cpu', chain: null }, bonusPaid: 0 }
    const got = parseSaved(old)
    expect(got?.vs.cpus).toEqual([[1, 0, 0, 0]]); expect(got?.vs.turn).toBe(0)
    expect(parseSaved({ ...old, vs: { ...old.vs, turn: 'cpu', cpu: undefined } })).toBeNull()
  })
  it('상대 동물은 겹치지 않게 뽑고, 옛 저장본에는 순서대로 붙인다', () => {
    for (let k = 1; k <= 3; k++) {
      const vs = newVs(seeded(), k)
      expect(vs.animals).toHaveLength(k); expect(new Set(vs.animals).size).toBe(k)
      expect(vs.animals.every((a) => a >= 0 && a < ANIMALS.length)).toBe(true)
    }
    const v = newVs(seeded(), 2)
    expect(parseSaved({ mode: 'vs', game: newGame(seeded()), vs: { ...v, animals: undefined }, bonusPaid: 0 })?.vs.animals).toEqual([0, 1])
    expect(parseSaved({ mode: 'vs', game: newGame(seeded()), vs: { ...v, animals: [5, 3] }, bonusPaid: 0 })?.vs.animals).toEqual([5, 3])
  })
})
