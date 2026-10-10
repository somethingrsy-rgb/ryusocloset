import { describe, expect, it } from 'vitest'
import { PLACES } from './game'
import { decorForPlace, decorLayer } from './travelDecor'

describe('travel scene furnishings', () => {
  it('furnishes every destination with existing, unique assets', () => {
    for (const place of PLACES) {
      const decor = decorForPlace(place.id)
      expect(decor.length).toBeGreaterThanOrEqual(5)
      expect(new Set(decor.map(({ item }) => item.id)).size).toBe(decor.length)
      for (const prop of decor) {
        expect(prop.item.image).toMatch(/^assets\//)
        expect(prop.item.w).toBeGreaterThan(0)
        expect(prop.item.h).toBeGreaterThan(0)
        expect(prop.x - prop.width / 2).toBeGreaterThanOrEqual(0)
        expect(prop.x + prop.width / 2).toBeLessThanOrEqual(100)
      }
    }
  })
  it('keeps rugs and wall decorations behind residents and furniture', () => {
    for (const place of PLACES) {
      for (const decor of decorForPlace(place.id)) {
        if (decor.item.group === 'rug' || decor.item.group === 'wall') {
          expect(decorLayer(decor)).toBeLessThan(10)
        } else {
          expect(decorLayer(decor)).toBeLessThan(84)
          expect(decorLayer(decor)).toBe(Math.round(decor.y))
        }
      }
    }
  })
  it('uses different furnishings for each destination', () => {
    const layouts = PLACES.map(({ id }) => decorForPlace(id).map(({ item }) => item.id).join(','))
    expect(new Set(layouts).size).toBe(PLACES.length)
    expect(decorForPlace('unknown')).toEqual([])
  })
})
