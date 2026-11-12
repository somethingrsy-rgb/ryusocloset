import { describe, expect, it } from 'vitest'
import { allMoves, setsOf } from './jumpPuzzle'
import { actionOf, applyAction, isMOver, newMState, rewardFor, winnersOf, type MState } from './jumpMulti'

const firstMove = (s: MState) => allMoves(s.board)[0]

describe('점프 같이 하기 규칙', () => {
  it('같은 씨앗이면 같은 판, 씨앗이 다르면 다른 판', () => {
    const a = newMState(42, 3), b = newMState(42, 3), c = newMState(43, 3)
    expect(a.board).toEqual(b.board); expect(a.board).not.toEqual(c.board)
    expect(a.pockets.length).toBe(3); expect(a.turn).toBe(0)
  })
  it('차례가 아닌 자리의 수는 무시한다', () => {
    const s = newMState(7, 3)
    const m = firstMove(s)
    expect(applyAction(s, actionOf(1, m))).toBe(s)
    expect(applyAction(s, actionOf(0, m)).applied).toBe(1)
  })
  it('뛴 말은 내 주머니에 들어오고, 더 못 뛰면 다음 자리로 넘어간다', () => {
    let s = newMState(7, 3)
    const before = s.board.flat().filter(Boolean).length
    const m = firstMove(s)
    const color = s.board[m.over.r][m.over.c]
    s = applyAction(s, actionOf(0, m))
    expect(s.board.flat().filter(Boolean).length).toBe(before - 1)
    expect(s.pockets[0][color - 1]).toBe(1)
    expect(s.pockets[1].every((n) => n === 0)).toBe(true)
    expect(s.turn).toBe(s.chain ? 0 : 1)
  })
  it('이어 뛸 수 있으면 같은 자리·같은 말만 더 뛰고, 끝내기로 차례를 넘긴다', () => {
    // 몇 수 둔 판에서 이어 뛰기가 생기는 수를 찾는다
    for (let seed = 1; seed < 60; seed++) {
      let s = newMState(seed, 2)
      for (let step = 0; step < 40 && !isMOver(s); step++) {
        for (const m of allMoves(s.board).filter((x) => !s.chain || (x.from.r === s.chain.r && x.from.c === s.chain.c))) {
          const t = applyAction(s, actionOf(s.turn, m))
          if (!t.chain) continue
          const seat = s.turn
          expect(t.turn).toBe(seat)
          const other = allMoves(t.board).find((x) => x.from.r !== t.chain!.r || x.from.c !== t.chain!.c)
          if (other) expect(applyAction(t, actionOf(seat, other))).toBe(t)       // 다른 말로는 못 뛴다
          expect(applyAction(t, { s: 1 - seat, e: 1 })).toBe(t)                  // 상대 자리는 못 둔다
          const ended = applyAction(t, { s: seat, e: 1 })
          expect(ended.turn).toBe(1 - seat); expect(ended.chain).toBeNull()
          expect(applyAction(ended, { s: 1 - seat, e: 1 })).toBe(ended)          // 이어 뛰기가 없으면 끝내기가 안 된다
          return
        }
        const mv = allMoves(s.board).filter((x) => !s.chain || (x.from.r === s.chain.r && x.from.c === s.chain.c))[0]
        s = applyAction(s, mv ? actionOf(s.turn, mv) : { s: s.turn, e: 1 })
      }
    }
    throw new Error('이어 뛰기를 만드는 판을 못 찾았어요')
  })
  it('못 뛰는 수·이상한 값은 무시한다', () => {
    const s = newMState(9, 2)
    expect(applyAction(s, { s: 0, fr: 0, fc: 0, tr: 0, tc: 1 })).toBe(s)
    expect(applyAction(s, { s: 0, fr: -1, fc: 0, tr: 0, tc: 0 })).toBe(s)
    expect(applyAction(s, { s: 0, fr: 0.5, fc: 0, tr: 2, tc: 0 })).toBe(s)
    expect(applyAction(s, { s: 0 })).toBe(s)
  })
  it('끝까지 두면 판이 끝나고 별 계산이 맞다', () => {
    let s = newMState(11, 3)
    for (let i = 0; i < 500 && !isMOver(s); i++) {
      const moves = allMoves(s.board)
      const mv = s.chain ? moves.filter((x) => x.from.r === s.chain!.r && x.from.c === s.chain!.c)[0] : moves[0]
      s = applyAction(s, mv ? actionOf(s.turn, mv) : { s: s.turn, e: 1 })
    }
    expect(isMOver(s)).toBe(true)
    const total = s.pockets.flat().reduce((a, b) => a + b, 0)
    expect(total).toBeGreaterThan(0)
    const w = winnersOf(s); expect(w.length).toBeGreaterThanOrEqual(1)
    for (let seat = 0; seat < 3; seat++) expect(rewardFor(s, seat)).toBe(setsOf(s.pockets[seat]) * 5 + 10 + (w.includes(seat) ? 60 : 0))
  })
  it('공동 1등은 모두 1등이다', () => {
    const s = { pockets: [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [0, 0, 0, 0, 1]] }
    expect(winnersOf(s)).toEqual([0, 1])
  })
})
