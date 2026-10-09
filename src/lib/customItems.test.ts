import { describe, expect, it } from 'vitest'
import { CANVAS_H, CANVAS_W, CATEGORIES } from './layers'
import { alphaBounds, categoryStats, components, defaultBox, removeBackground, roomBaseWidth, shoePairFit } from './customItems'

function image(w: number, h: number, fill: [number, number, number, number]) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) d.set(fill, i * 4)
  return d
}
const paint = (d: Uint8ClampedArray, w: number, x0: number, y0: number, x1: number, y1: number, c: [number, number, number, number]) => {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) d.set(c, (y * w + x) * 4)
}

describe('defaultBox', () => {
  it('항상 캔버스 안에 들어가고 비율을 유지한다', () => {
    for (const c of CATEGORIES) {
      for (const [w, h] of [[100, 100], [900, 200], [200, 900], [1, 1]]) {
        const b = defaultBox(c, w, h)
        expect(b.x).toBeGreaterThanOrEqual(0)
        expect(b.y).toBeGreaterThanOrEqual(0)
        expect(b.x + b.w).toBeLessThanOrEqual(CANVAS_W)
        expect(b.y + b.h).toBeLessThanOrEqual(CANVAS_H)
        if (w > 20 && h > 20) expect(Math.abs(b.w / b.h - w / h) / (w / h)).toBeLessThan(0.05)
      }
    }
  })
  it('신발은 발 쪽, 액세서리는 머리 쪽에 놓인다', () => {
    expect(defaultBox('shoes', 300, 100).y).toBeGreaterThan(1300)
    expect(defaultBox('accessory', 300, 200).y).toBeLessThan(400)
  })
})

describe('removeBackground', () => {
  it('가장자리에서 이어진 단색 배경만 지운다 (옷 안쪽의 같은 색은 남긴다)', () => {
    const w = 20, h = 20
    const d = image(w, h, [255, 255, 255, 255])
    paint(d, w, 4, 4, 16, 16, [200, 40, 60, 255]) // 옷
    paint(d, w, 8, 8, 12, 12, [255, 255, 255, 255]) // 옷 안쪽 흰 무늬
    expect(removeBackground(d, w, h)).toBe(true)
    expect(d[3]).toBe(0) // 모서리
    expect(d[(10 * w + 10) * 4 + 3]).toBe(255) // 안쪽 무늬
    expect(d[(6 * w + 6) * 4 + 3]).toBe(255) // 옷
    expect(alphaBounds(d, w, h)).toEqual({ x: 4, y: 4, w: 12, h: 12 })
  })
  it('이미 투명한 사진이나 모서리 색이 제각각인 사진은 건드리지 않는다', () => {
    const t = image(10, 10, [0, 0, 0, 0])
    expect(removeBackground(t, 10, 10)).toBe(false)
    const m = image(10, 10, [255, 255, 255, 255])
    m.set([0, 0, 0, 255], 0)
    expect(removeBackground(m, 10, 10)).toBe(false)
    expect(m[(5 * 10 + 5) * 4 + 3]).toBe(255)
  })
})

describe('alphaBounds', () => {
  it('완전히 투명하면 null', () => expect(alphaBounds(image(4, 4, [0, 0, 0, 0]), 4, 4)).toBeNull())
})

describe('roomBaseWidth', () => {
  it('가로로 넓은 물건은 기본 폭, 세로로 긴 물건은 높이 한도에 맞춰 좁아진다', () => {
    expect(roomBaseWidth('furniture', 800, 400)).toBe(320)
    expect(roomBaseWidth('furniture', 200, 1000)).toBe(104)
    expect(roomBaseWidth('wall', 10, 1000)).toBe(40)
  })
})

describe('사이트의 기본 옷 조건에 맞추기', () => {
  const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h })
  const items = [
    { id: 'top_a', category: 'top' as const, box: box(200, 620, 600, 340) },
    { id: 'top_b', category: 'top' as const, box: box(220, 630, 580, 350) },
    { id: 'top_c', category: 'top' as const, box: box(210, 640, 620, 360) },
    { id: 'custom_x', category: 'top' as const, box: box(0, 0, 10, 10) },
  ]
  it('내 옷은 빼고 기본 옷의 중앙값을 구한다', () => {
    const st = categoryStats('top', items)!
    expect(st.w).toBe(600)
    expect(st.y).toBe(630)
    expect(categoryStats('dress', items)).toBeNull()
  })
  it('기본 옷과 같은 폭·가운데·맨 위(어깨선)에 놓는다', () => {
    const st = categoryStats('top', items)!
    const b = defaultBox('top', 1200, 700, st)
    expect(b.w).toBe(600)
    expect(b.y).toBe(630)
    expect(Math.abs(b.x + b.w / 2 - st.cx)).toBeLessThanOrEqual(1)
  })
  it('세로로 너무 긴 옷은 높이 한도에 맞춰 줄인다', () => {
    const st = categoryStats('top', items)!
    expect(defaultBox('top', 300, 900, st).h).toBeLessThanOrEqual(Math.round(st.h * 1.3))
  })
  it('두 덩어리를 찾는다 (작은 점은 무시)', () => {
    const w = 60, h = 20
    const d = image(w, h, [0, 0, 0, 0])
    paint(d, w, 2, 2, 22, 18, [10, 10, 10, 255])
    paint(d, w, 36, 2, 56, 18, [10, 10, 10, 255])
    paint(d, w, 30, 5, 31, 6, [10, 10, 10, 255])
    const parts = components(d, w, h, 50)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toEqual({ x: 2, y: 2, w: 20, h: 16 })
  })
  it('신발 두 짝은 아바타 발 가운데·바닥에 맞춘다', () => {
    const parts = [box(100, 40, 200, 100), box(500, 40, 200, 100)]
    const f = shoePairFit(parts, box(0, 0, 800, 140))!
    // 두 발 가운데 사이가 175 이어야 한다 → 배율 ≈ 175/400 근처
    expect(f.s).toBeGreaterThan(0.3)
    expect(f.s).toBeLessThan(0.5)
    expect(f.ty + 140 * f.s).toBeCloseTo(1509, 0)
    expect(shoePairFit([box(0, 0, 10, 10)], box(0, 0, 10, 10))).toBeNull()
  })
})
