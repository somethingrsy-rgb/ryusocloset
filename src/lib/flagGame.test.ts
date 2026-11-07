import { describe, expect, it } from 'vitest'
import { FLAG_COUNTRIES, FLAG_ROUNDS, makeFlagQuiz } from './flagGame'

describe('국기 퀴즈 출제', () => {
  it('한 판에 중복 없이 10개 국기를 출제한다', () => {
    const questions = makeFlagQuiz()
    expect(questions).toHaveLength(FLAG_ROUNDS)
    expect(new Set(questions.map(q => q.country.code)).size).toBe(FLAG_ROUNDS)
  })
  it('매 문제 보기는 서로 다른 네 나라이고 정답은 정확히 하나다', () => {
    for (const random of [() => 0, () => 0.9999, Math.random]) for (const q of makeFlagQuiz(random)) {
      expect(q.choices).toHaveLength(4)
      expect(new Set(q.choices.map(c => c.code)).size).toBe(4)
      expect(q.choices.filter(c => c.code === q.country.code)).toHaveLength(1)
      expect(q.choices.every(c => FLAG_COUNTRIES.includes(c))).toBe(true)
    }
  })
})
