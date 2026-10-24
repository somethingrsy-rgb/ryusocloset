import { describe, expect, it } from 'vitest'
import { BYES, CALL_ANIMALS, HELLOS, SHARED_TOPICS, fillLine, kidWords, planCall } from './animalCalls'

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
      for (const kid of ['유하', '유엘', undefined]) for (const line of lines) expect(fillLine(line, a, kid), `${a.name}: ${line}`).not.toMatch(/[{}]/)
    }
    expect(fillLine('안녕{e}! 나 {me}{e}.', CALL_ANIMALS[2])).toBe('안녕냥! 나 냥이야냥.')
  })
  it('아바타 이름으로 부른다: 유하야·유하구나, 유엘아·유엘이구나', () => {
    expect(kidWords('유하')).toEqual({ call: '유하야', kid: '유하' })
    expect(kidWords('유엘')).toEqual({ call: '유엘아', kid: '유엘이' })
    expect(kidWords('소영')).toEqual({ call: '소영아', kid: '소영이' })
    expect(fillLine(HELLOS[1], CALL_ANIMALS[0], '유하')).toBe('여보세요~? 앗, 유하구나! 유하야, 안녕? 목소리 들으니까 너무 좋다곰!')
    const plan = planCall(2, Math.random, '유엘')
    expect(plan.hello + plan.bye).toContain('유엘')
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
