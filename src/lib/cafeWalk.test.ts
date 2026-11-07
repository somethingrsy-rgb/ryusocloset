import { describe, expect, it } from 'vitest'
import { stepCafe } from './cafeWalk'

describe('자유 이동 카페', () => {
  it('가운데 길 밖 잔디까지 이동하고 목표에서 멈춘다', () => {
    let p = { x: 0, z: 0 }
    for (let i = 0; i < 200; i++) p = stepCafe(p, { x: 7, z: 5 }, 0.1, [])
    expect(p.x).toBeCloseTo(7); expect(p.z).toBeCloseTo(5)
  })
  it('정원을 벗어나지 않는다', () => {
    let p = { x: 0, z: 0 }
    for (let i = 0; i < 300; i++) p = stepCafe(p, { x: 100, z: 100 }, 0.1, [])
    expect(p.x).toBeLessThanOrEqual(8.5); expect(p.z).toBeLessThanOrEqual(6.5)
  })
  it('테이블 안으로 들어가지 않고 옆으로 돌아간다', () => {
    let p = { x: -3, z: 0 }
    const table = { x: 0, z: 0, r: 0.7 }
    for (let i = 0; i < 300; i++) {
      p = stepCafe(p, { x: 3, z: 0 }, 0.05, [table])
      expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(1.0499)
    }
    expect(p.x).toBeCloseTo(3); expect(p.z).toBeCloseTo(0)
  })
})
