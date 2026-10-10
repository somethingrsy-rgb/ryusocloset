import { afterEach, describe, expect, it, vi } from 'vitest'
import { ENGLISH_LESSONS } from './englishLessons'
import { PLACES } from './game'

describe('English conversations', () => {
  it('provides three valid bilingual questions for every destination', () => {
    expect(Object.keys(ENGLISH_LESSONS).sort()).toEqual(PLACES.map(({ id }) => id).sort())
    for (const questions of Object.values(ENGLISH_LESSONS)) {
      expect(questions).toHaveLength(3)
      for (const question of questions) {
        expect(question.line.length).toBeGreaterThan(0)
        expect(question.meaning.length).toBeGreaterThan(0)
        expect(question.choices).toHaveLength(3)
        expect(new Set(question.choices.map(({ en }) => en)).size).toBe(3)
        expect(question.choices[question.answer]).toBeDefined()
        for (const choice of question.choices) expect(choice.ko.length).toBeGreaterThan(0)
        expect(question.explanation.ko.length).toBeGreaterThan(0)
        expect(question.explanation.en.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('English completion and rewards', () => {
  afterEach(() => vi.unstubAllGlobals())
  const setup = async (saved: object) => {
    const values = new Map([['ryuso.game.v1', JSON.stringify(saved)]])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
    vi.resetModules()
    return { game: await import('./game'), values }
  }
  it('loads old saves without losing collection or event progress', async () => {
    const { game } = await setup({ found: ['dress_1'], events: ['spring'], at: 'spring', reach: 4, chunk: 1 })
    expect(game.getGame().english).toEqual([])
    expect(game.getGame().found).toEqual(['dress_1'])
    expect(game.eventDone('spring')).toBe(true)
  })
  it('allows exactly one completion reward per place, independently of old events', async () => {
    const { game, values } = await setup({ events: ['spring'] })
    expect(game.finishEnglish('spring')).toBe(true)
    expect(game.finishEnglish('spring')).toBe(false)
    expect(game.finishEnglish('unknown')).toBe(false)
    expect(game.finishEnglish('toString')).toBe(false)
    expect(game.getGame().events).toEqual(['spring'])
    expect(JSON.parse(values.get('ryuso.game.v1')!).english).toEqual(['spring'])
    vi.resetModules()
    const reloaded = await import('./game')
    expect(reloaded.finishEnglish('spring')).toBe(false)
  })
  it('rejects invalid saved completions and deduplicates valid places', async () => {
    const { game } = await setup({ english: ['spring', 'spring', 'unknown', 'toString', 12] })
    expect(game.getGame().english).toEqual(['spring'])
    expect(game.finishEnglish('camp')).toBe(true)
  })
  it('does not claim rewards during backup restoration', async () => {
    const { game } = await setup({})
    const guard = await import('./restoreGuard')
    guard.beginRestore()
    expect(game.finishEnglish('spring')).toBe(false)
    guard.endRestore()
    expect(game.finishEnglish('spring')).toBe(true)
    game.resetGame()
    expect(game.getGame().english).toEqual([])
  })
})
