import { describe, expect, it } from 'vitest'
import { matchesReply, normalizeSpeech, SPEAKING_LESSONS } from './speakingLessons'
describe('short spoken conversations', () => {
  it('provides three complete missions with reusable words and supported replies', () => {
    expect(new Set(SPEAKING_LESSONS.map(l => l.id)).size).toBe(3)
    for (const lesson of SPEAKING_LESSONS) {
      expect(lesson.words).toHaveLength(4)
      expect(lesson.turns).toHaveLength(3)
      for (const turn of lesson.turns) {
        expect(turn.question).toBeTruthy(); expect(turn.meaning).toBeTruthy(); expect(turn.cue).toBeTruthy()
        expect(matchesReply(turn.answer, turn)).toBe(true)
        for (const alternative of turn.alternatives ?? []) expect(matchesReply(alternative, turn)).toBe(true)
      }
    }
  })
  it('accepts case, punctuation and short polite variants without rejecting beginners', () => {
    const coffee = SPEAKING_LESSONS[0].turns[0]
    expect(matchesReply('COFFEE!', coffee)).toBe(true)
    expect(matchesReply('I’d like a coffee please', coffee)).toBe(true)
    expect(normalizeSpeech('  No, THANK you!  ')).toBe('no thank you')
  })
  it('does not accept a different requested item, negation or an empty recording', () => {
    const coffee = SPEAKING_LESSONS[0].turns[0]
    for (const wrong of ['Tea please', 'No coffee please', '', 'please', 'I hate coffee']) expect(matchesReply(wrong, coffee)).toBe(false)
  })
})
