import { describe, expect, it } from 'vitest'
import { CALL_ANIMALS } from './animalCalls'
import { MEET_GAP, MEET_GAP_ALL, MEET_WALK, canMeet, pickVisitor, sanitizeMeet, talkFor } from './meet'

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

describe('산책길 친구 만나기', () => {
  it('충분히 걷고, 지난번 만남에서 시간이 지나야 나타난다(너무 자주 만나지 않게)', () => {
    const now = 1_000_000_000
    const s = { met: [0], last: now - MEET_GAP + 1000 } // 30초에서 1초 모자람
    expect(canMeet(s, MEET_WALK, now)).toBe(false) // 아직 시간이 덜 지남
    expect(canMeet({ ...s, last: now - MEET_GAP }, MEET_WALK - 1, now)).toBe(false) // 덜 걸음
    expect(canMeet({ ...s, last: now - MEET_GAP }, MEET_WALK, now)).toBe(true)
    // 다 만났으면 더 드물게
    const all = { met: CALL_ANIMALS.map((_, i) => i), last: now - MEET_GAP }
    expect(canMeet(all, MEET_WALK, now)).toBe(false)
    expect(canMeet({ ...all, last: now - MEET_GAP_ALL }, MEET_WALK, now)).toBe(true)
  })
  it('아직 못 만난 친구가 먼저 나타난다', () => {
    const rnd = seeded(3)
    for (let k = 0; k < 50; k++) expect([5, 7]).toContain(pickVisitor({ met: [0, 1, 2, 3, 4, 6], last: 0 }, rnd))
    expect(pickVisitor({ met: CALL_ANIMALS.map((_, i) => i), last: 0 }, rnd)).toBeLessThan(CALL_ANIMALS.length)
  })
  it('아바타 이름을 불러 인사하고(처음엔 자기소개), 대답 셋 중에서 고른다', () => {
    const t = talkFor(0, '유하', true, seeded(1))
    expect(t.hello).toBe('유하야, 안녕? 나는 곰이야! 만나서 반가워!')
    // 질문은 서로 다른 두 개, 질문마다 대답 셋
    expect(t.asks).toHaveLength(2)
    expect(t.asks[0].ask).not.toBe(t.asks[1].ask)
    for (const a of t.asks) expect(a.replies).toHaveLength(3)
    for (let k = 1; k < 40; k++) { const u = talkFor(k % 8, '유하', false, seeded(k)); expect(u.asks[0].ask).not.toBe(u.asks[1].ask) }
    expect(talkFor(2, '유엘', false, seeded(2)).hello).toBe('유엘아, 안녕? 또 만났네!')
  })
  it('저장된 값이 이상해도 안전하게 읽는다', () => {
    expect(sanitizeMeet({ met: [1, 1, 99, -1, 'x'], last: 'no' })).toEqual({ met: [1], last: 0 })
    expect(sanitizeMeet(null)).toEqual({ met: [], last: 0 })
  })
})
