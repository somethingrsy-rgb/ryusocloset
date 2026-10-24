import { describe, expect, it } from 'vitest'
import { BYES, CALL_ANIMALS, HELLOS, SHARED_TOPICS, fillLine, planCall } from './animalCalls'

const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

describe('동물 전화 놀이', () => {
  it('카페 동물 8마리 모두 대사가 있고, 이야기마다 대답이 2~3개다', () => {
    expect(CALL_ANIMALS).toHaveLength(8)
    for (const a of CALL_ANIMALS) {
      expect(a.topics.length).toBeGreaterThanOrEqual(2)
      for (const tp of [...a.topics, ...SHARED_TOPICS]) {
        expect(tp.replies.length).toBeGreaterThanOrEqual(2)
        expect(tp.replies.length).toBeLessThanOrEqual(3)
      }
    }
  })
  it('모든 대사의 {…} 가 남김없이 바뀐다', () => {
    for (const a of CALL_ANIMALS) {
      const lines = [...HELLOS, ...BYES, ...[...a.topics, ...SHARED_TOPICS].flatMap((tp) => [tp.ask, ...tp.replies.flatMap((r) => [r.label, r.answer])])]
      for (const line of lines) expect(fillLine(line, a), `${a.name}: ${line}`).not.toMatch(/[{}]/)
    }
    expect(fillLine('안녕{e}! 나 {me}{e}.', CALL_ANIMALS[2])).toBe('안녕냥! 나 냥이야냥.')
  })
  it('한 통화는 인사, 서로 다른 이야기 3개(그 동물만의 이야기 포함), 끝인사', () => {
    for (let animal = 0; animal < CALL_ANIMALS.length; animal++) for (let s = 1; s < 30; s++) {
      const plan = planCall(animal, seeded(s))
      expect(plan.hello).toBeTruthy(); expect(plan.bye).toBeTruthy()
      expect(plan.topics).toHaveLength(3)
      expect(new Set(plan.topics.map((tp) => tp.ask)).size).toBe(3)
      const own = CALL_ANIMALS[animal].topics.map((tp) => fillLine(tp.ask, CALL_ANIMALS[animal]))
      expect(plan.topics.some((tp) => own.includes(tp.ask))).toBe(true)
    }
  })
})
