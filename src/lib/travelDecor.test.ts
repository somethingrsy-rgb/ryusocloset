import { describe, expect, it } from 'vitest'
import { PLACES } from './game'
import { LAYOUTS, decorForPlace, decorLayer } from './travelDecor'

describe('travel scene furnishings', () => {
  it('furnishes every destination with existing, unique, in-bounds assets', () => {
    for (const place of PLACES) {
      const decor = decorForPlace(place.id)
      expect(decor.length, place.id).toBeGreaterThanOrEqual(5)
      expect(decor.length).toBe(LAYOUTS[place.id].length) // 모든 id 가 실제 아이템
      expect(new Set(decor.map(({ item }) => item.id)).size).toBe(decor.length)
      for (const prop of decor) {
        expect(prop.item.image).toMatch(/^assets\//)
        expect(prop.x - prop.width / 2).toBeGreaterThanOrEqual(0)
        expect(prop.x + prop.width / 2).toBeLessThanOrEqual(100)
      }
    }
  })
  it('never uses collectible theme props (those are found while travelling)', () => {
    for (const place of PLACES) for (const { item } of decorForPlace(place.id)) expect(item.id.startsWith('theme_'), item.id).toBe(false)
  })
  it('keeps rugs and wall decorations behind furniture', () => {
    for (const place of PLACES) {
      for (const decor of decorForPlace(place.id)) {
        if (decor.item.group === 'rug' || decor.item.group === 'wall') expect(decorLayer(decor)).toBeLessThan(10)
        else expect(decorLayer(decor)).toBe(Math.round(decor.y))
      }
    }
  })
})
