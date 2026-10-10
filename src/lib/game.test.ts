import { describe, expect, it } from 'vitest'
import { PLACES, assignPlaces, inPool, spotFor } from './game'

describe('여행 게임', () => {
  const ids = Array.from({ length: 53 }, (_, i) => `item_${i}`)
  it('모든 아이템이 정확히 한 장소에 숨는다', () => {
    const a = assignPlaces(ids)
    const all = Object.values(a).flat()
    expect(all.sort()).toEqual([...ids].sort())
    expect(Object.keys(a)).toHaveLength(PLACES.length)
  })
  it('장소마다 고르게 나뉜다 (차이 1 이하)', () => {
    const sizes = Object.values(assignPlaces(ids)).map((l) => l.length)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  })
  it('목록 순서가 달라도 같은 결과다', () => {
    expect(assignPlaces([...ids].reverse())).toEqual(assignPlaces(ids))
  })
  it('숨은 자리는 화면 안이고 같은 장소 안에서 겹치지 않는다', () => {
    const list = assignPlaces(ids)[PLACES[0].id]
    const spots = list.map((id, i) => spotFor(id, i))
    for (const s of spots) {
      expect(s.x).toBeGreaterThan(0); expect(s.x).toBeLessThan(100)
      expect(s.y).toBeGreaterThan(0); expect(s.y).toBeLessThan(100)
    }
    expect(new Set(spots.map((s) => `${Math.round(s.x / 8)},${Math.round(s.y / 8)}`)).size).toBe(spots.length)
  })
  it('기본 상의·하의, 내가 추가한 옷은 게임 대상이 아니다', () => {
    expect(inPool({ id: 'top_a', category: 'top', native: true })).toBe(false)
    expect(inPool({ id: 'custom_1', category: 'costume', native: true })).toBe(false)
    expect(inPool({ id: 'costume_a', category: 'costume', native: true })).toBe(true)
  })
})
