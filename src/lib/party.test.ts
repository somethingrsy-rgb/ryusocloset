import { describe, expect, it } from 'vitest'
import { CALL_ANIMALS } from './animalCalls'
import { arrive, byeLine, helloLine, leaveAll, partyLine, stepGuests } from './party'

const floor = { minX: 10, maxX: 90, minY: 70, maxY: 95 }
const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

describe('집 파티', () => {
  it('인사: 유하야·유엘아 안녕? 초대해 줘서 고마워!', () => {
    expect(helloLine('유하')).toBe('유하야, 안녕? 초대해 줘서 고마워!')
    expect(helloLine('유엘')).toBe('유엘아, 안녕? 초대해 줘서 고마워!')
    expect(byeLine('유엘')).toContain('유엘아')
  })
  it('문 밖에서 들어와 한 번 인사하고, 그 뒤로는 바닥 안에서만 돌아다닌다', () => {
    const rnd = seeded(3)
    let gs = [arrive(0, floor, rnd), arrive(5, floor, rnd)]
    expect(gs[0].x).toBeLessThan(0)
    const hellos: number[] = []
    for (let t = 0; t < 60 * 60; t++) {
      const r = stepGuests(gs, 1 / 60, floor, rnd)
      gs = r.guests
      hellos.push(...r.arrivedNow)
      if (t > 60 * 15) for (const g of gs) {
        expect(g.x).toBeGreaterThanOrEqual(floor.minX - 0.01); expect(g.x).toBeLessThanOrEqual(floor.maxX + 0.01)
        expect(g.y).toBeGreaterThanOrEqual(floor.minY - 0.01); expect(g.y).toBeLessThanOrEqual(floor.maxY + 0.01)
      }
    }
    expect(hellos.sort()).toEqual([0, 5])
    expect(new Set(gs.map((g) => Math.round(g.x))).size).toBeGreaterThan(1)
  })
  it('파티를 끝내면 모두 문으로 나간다', () => {
    let gs = leaveAll([arrive(1, floor), arrive(2, floor)])
    const gone: number[] = []
    for (let t = 0; t < 60 * 30 && gs.length; t++) { const r = stepGuests(gs, 1 / 60, floor); gs = r.guests; gone.push(...r.gone) }
    expect(gs).toHaveLength(0)
    expect(gone.sort()).toEqual([1, 2])
  })
  it('파티 이야기에는 빈칸이 남지 않고, 친구 이름도 부른다', () => {
    const rnd = seeded(9)
    const lines = new Set<string>()
    for (let i = 0; i < 400; i++) for (let a = 0; a < CALL_ANIMALS.length; a++) lines.add(partyLine(a, [0, 1, 2].filter((x) => x !== a), '유하', rnd))
    for (const l of lines) expect(l).not.toMatch(/[{}]/)
    expect([...lines].some((l) => l.startsWith('곰이야,') || l.startsWith('몽실아,'))).toBe(true)
    expect([...lines].some((l) => l.includes('유하야'))).toBe(true)
  })
})
