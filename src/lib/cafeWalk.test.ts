import { describe, expect, it } from 'vitest'
import { CAFE_GUEST_GAP, nearestCafeGuest, stepCafeCrowd, stepCafe } from './cafeWalk'

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

describe('카페 손님 간격', () => {
  it('여러 손님이 마주 걸어도 서로의 몸을 통과하지 않는다', () => {
    const people = [{ x: -4, z: 0 }, { x: 4, z: 0 }, { x: 0, z: -4 }, { x: 0, z: 4 }]
    const goals = [{ x: 4, z: 0 }, { x: -4, z: 0 }, { x: 0, z: 4 }, { x: 0, z: -4 }]
    for (let frame = 0; frame < 500; frame++) {
      people.forEach((p, i) => { people[i] = stepCafeCrowd(p, goals[i], 0.03, [], people.filter((_, j) => j !== i)) })
      people.forEach((p, i) => people.slice(i + 1).forEach(o => expect(Math.hypot(p.x - o.x, p.z - o.z)).toBeGreaterThanOrEqual(CAFE_GUEST_GAP - 0.0001)))
    }
  })
  it('앉아 있는 손님은 움직이지 않고 산책 손님만 옆으로 피한다', () => {
    const seated = { x: 0, z: 0 }
    let p = { x: -3, z: 0 }
    for (let frame = 0; frame < 300; frame++) {
      p = stepCafeCrowd(p, { x: 3, z: 0 }, 0.03, [], [seated])
      expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(CAFE_GUEST_GAP - 0.0001)
    }
    expect(seated).toEqual({ x: 0, z: 0 })
    expect(p.x).toBeGreaterThan(0)
  })
  it('가까운 손님 한 마리만 펼치고 멀리 있으면 모두 접는다', () => {
    expect(nearestCafeGuest({ x: 0, z: 0 }, [{ x: 1.5, z: 0 }, { x: 1, z: 0 }])).toBe(1)
    expect(nearestCafeGuest({ x: 0, z: 0 }, [{ x: 5, z: 0 }])).toBeNull()
  })
})

it('화면 회전 직후 가까워진 손님도 멀어지는 방향으로 빠져나온다', () => {
  let p = { x: 1, z: 0 }
  for (let i = 0; i < 40; i++) p = stepCafeCrowd(p, { x: 3, z: 0 }, 0.03, [], [{ x: 0, z: 0 }])
  expect(p.x).toBeGreaterThan(CAFE_GUEST_GAP)
})
