import { describe, expect, it } from 'vitest'
import { CALL_ANIMALS } from './animalCalls'
import { MEET_GAP, MEET_WALK, SOLVE_PER_FRIEND, canMeet, notCollected, pickVisitor, sanitizeMeet, solveOne, talkFor, type MeetState } from './meet'

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

describe('친구 모으기(수학)', () => {
  it('수학 문제를 10개 풀 때마다 아직 못 모은 친구를 한 명씩 모은다', () => {
    let s: MeetState = { met: [], last: 0, solved: 0 }
    const rnd = seeded(5)
    const got: number[] = []
    for (let k = 0; k < SOLVE_PER_FRIEND * CALL_ANIMALS.length + 15; k++) {
      const r = solveOne(s, rnd)
      if (r.got !== null) { got.push(r.got); expect(k % SOLVE_PER_FRIEND).toBe(SOLVE_PER_FRIEND - 1) }
      s = r.next
    }
    expect(new Set(got).size).toBe(CALL_ANIMALS.length) // 겹치지 않게 8마리 모두
    expect(notCollected(s)).toEqual([])
    expect(solveOne(s, rnd).got).toBe(null) // 다 모으면 더 없다
  })
})

describe('산책길 만남(이야기만)', () => {
  it('충분히 걷고 지난번 만남에서 30초가 지나야 나타난다(다 모았어도 같다)', () => {
    const now = 1_000_000_000
    const s = { met: [0], last: now - MEET_GAP + 1000, solved: 0 }
    expect(canMeet(s, MEET_WALK, now)).toBe(false)
    expect(canMeet({ ...s, last: now - MEET_GAP }, MEET_WALK - 1, now)).toBe(false)
    expect(canMeet({ ...s, last: now - MEET_GAP }, MEET_WALK, now)).toBe(true)
    expect(canMeet({ met: CALL_ANIMALS.map((_, i) => i), last: now - MEET_GAP, solved: 0 }, MEET_WALK, now)).toBe(true)
    const rnd = seeded(3)
    for (let k = 0; k < 30; k++) expect(pickVisitor(rnd)).toBeLessThan(CALL_ANIMALS.length)
  })
  it('아바타 이름을 불러 인사하고(처음엔 자기소개), 서로 다른 질문 둘에 대답 셋씩', () => {
    const t = talkFor(0, '유하', true, seeded(1))
    expect(t.hello).toBe('유하야, 안녕? 나는 곰이야! 만나서 반가워!')
    expect(t.asks).toHaveLength(2)
    expect(t.asks[0].ask).not.toBe(t.asks[1].ask)
    for (const a of t.asks) expect(a.replies).toHaveLength(3)
    for (let k = 1; k < 40; k++) { const u = talkFor(k % 8, '유하', false, seeded(k)); expect(u.asks[0].ask).not.toBe(u.asks[1].ask) }
    expect(talkFor(2, '유엘', false, seeded(2)).hello).toBe('유엘아, 안녕? 또 만났네!')
  })
  it('저장된 값이 이상해도 안전하게 읽는다', () => {
    expect(sanitizeMeet({ met: [1, 1, 99, -1, 'x'], last: 'no', solved: 42 })).toEqual({ met: [1], last: 0, solved: SOLVE_PER_FRIEND - 1 })
    expect(sanitizeMeet(null)).toEqual({ met: [], last: 0, solved: 0 })
  })
})
