import { describe, expect, it } from 'vitest'
import { roadSpot } from './roadItems'
import { CHUNK_W, GROUND, gateX } from './world'
import { findItem } from './game'

describe('길에서 줍는 아이템', () => {
  it('늘 같은 자리·같은 아이템이고, 구간의 3분의 1쯤에만 있다', () => {
    let n = 0
    for (let c = 0; c < 60; c++) {
      const a = roadSpot(c)
      expect(roadSpot(c)).toEqual(a)
      if (a) n++
    }
    expect(n).toBeGreaterThan(8)
    expect(n).toBeLessThan(35)
  })
  it('길 위, 문에서 떨어진 곳에 있다', () => {
    for (let c = 0; c < 60; c++) {
      const a = roadSpot(c)
      if (!a) continue
      expect(a.y).toBeGreaterThanOrEqual(GROUND.minY)
      expect(a.y).toBeLessThanOrEqual(GROUND.maxY)
      expect(Math.abs(a.x - gateX(c))).toBeGreaterThanOrEqual(150)
      expect(Math.floor(a.x / CHUNK_W)).toBeGreaterThanOrEqual(c)
    }
  })
  it('찾으면 그 자리는 사라진다', () => {
    const c = Array.from({ length: 60 }, (_, i) => i).find((i) => roadSpot(i))!
    const a = roadSpot(c)!
    expect(findItem(a.id)).toBe(true)
    expect(roadSpot(c)).toBeNull()
  })
})
