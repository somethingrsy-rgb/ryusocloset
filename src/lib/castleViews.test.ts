import { describe, expect, it } from 'vitest'
import { castleViewBlend } from './castleViews'

describe('성 여덟 방향', () => {
  it('360도에서 정면으로 이어지고 음수 회전도 처리한다', () => {
    for (let i = -16; i <= 16; i++) {
      const view = castleViewBlend(i * Math.PI / 4)
      expect(view.mix > 0.5 ? view.b : view.a).toBe((i % 8 + 8) % 8)
    }
  })
  it('각 방향 경계에서 두 이웃 그림만 부드럽게 전환한다', () => {
    for (let i = 0; i < 8; i++) {
      const view = castleViewBlend((i + 0.5) * Math.PI / 4)
      expect(view.a).toBe(i); expect(view.b).toBe((i + 1) % 8)
      expect(view.mix).toBeCloseTo(0.5)
    }
  })
})
