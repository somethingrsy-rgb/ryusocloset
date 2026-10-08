import { describe, expect, it } from 'vitest'
import { CANVAS_H, CANVAS_W, LAYER_Z, type Category } from './layers'
import {
  MAX_TWEAK_MOVE,
  MAX_TWEAK_SCALE,
  MIN_TWEAK_SCALE,
  cssTransform,
  moveTweak,
  pickWorn,
  pivotOf,
  pruneTweaks,
  resetTweak,
  sanitizeTweaks,
  scaleTweak,
  setScaleTweak,
  toItemSpace,
} from './tweaks'
import type { Mask } from './roomHit'
import type { Item } from './types'

const mk = (id: string, category: Category, box = { x: 100, y: 200, w: 400, h: 300 }): Item => ({
  id, category, name: { ko: id, en: id }, color: null, colorName: null, colorHex: null,
  box, image: `${id}.webp`, thumb: `${id}.webp`, zIndex: LAYER_Z[category],
})
const top = mk('top1', 'top')
const outer = mk('outer1', 'outer')
const byId = { top1: top, outer1: outer }

describe('tweaks', () => {
  it('이동·크기는 범위로 제한된다', () => {
    expect(moveTweak({}, 'top', 9999, -9999).top).toMatchObject({ dx: MAX_TWEAK_MOVE, dy: -MAX_TWEAK_MOVE })
    expect(setScaleTweak({}, 'top', 99).top!.scale).toBe(MAX_TWEAK_SCALE)
    expect(setScaleTweak({}, 'top', 0.01).top!.scale).toBe(MIN_TWEAK_SCALE)
  })
  it('원래 위치·크기로 돌아오면 항목이 사라진다', () => {
    const t = scaleTweak(moveTweak({}, 'top', 30, 0), 'top', 1.2)
    expect(t.top).toBeDefined()
    expect(moveTweak(t, 'top', -30, 0).top).toBeDefined() // 크기는 그대로라 남음
    expect(setScaleTweak(moveTweak(t, 'top', -30, 0), 'top', 1).top).toBeUndefined()
    expect(resetTweak(t, 'top').top).toBeUndefined()
  })
  it('원본 객체를 바꾸지 않는다', () => {
    const t = { top: { dx: 1, dy: 2, scale: 1.1 } }
    const before = JSON.stringify(t)
    moveTweak(t, 'top', 5, 5); scaleTweak(t, 'top', 2); resetTweak(t, 'top')
    expect(JSON.stringify(t)).toBe(before)
  })
  it('옷이 바뀐 카테고리의 조절값은 버린다', () => {
    const tw = { top: { dx: 10, dy: 0, scale: 1 }, outer: { dx: 0, dy: 0, scale: 1.2 }, shoes: { dx: 1, dy: 1, scale: 1 } }
    const out = pruneTweaks({ top: 'a', outer: 'b', shoes: 's' }, { top: 'a2', outer: 'b' }, tw)
    expect(Object.keys(out)).toEqual(['outer'])
  })
  it('저장 데이터 검증', () => {
    expect(sanitizeTweaks({ top: { dx: 'x', dy: 5, scale: 9 }, bag: { dx: 1, dy: 1, scale: 1.2 }, outer: 3 }, { top: 'a', outer: 'b' })).toEqual({
      top: { dx: 0, dy: 5, scale: MAX_TWEAK_SCALE },
    })
    expect(sanitizeTweaks(null, { top: 'a' })).toEqual({})
  })
})

describe('변환 수학', () => {
  it('기준점은 옷 영역의 중심', () => {
    expect(pivotOf(top)).toEqual({ x: 300, y: 350 })
  })
  it('CSS 변환: 기준점(%)과 이동(%)', () => {
    const c = cssTransform(top, { dx: CANVAS_W / 10, dy: CANVAS_H / 5, scale: 1.5 })
    expect(c.transformOrigin).toBe(`${(300 / CANVAS_W) * 100}% ${(350 / CANVAS_H) * 100}%`)
    expect(c.transform).toBe('translate(10%, 20%) scale(1.5)')
  })
  it('화면 좌표 ↔ 옷 이미지 좌표는 서로 역변환이다', () => {
    const t = { dx: 40, dy: -25, scale: 1.4 }
    const q = { x: 180, y: 260 }
    const p = pivotOf(top)
    const shown = { x: p.x + (q.x - p.x) * t.scale + t.dx, y: p.y + (q.y - p.y) * t.scale + t.dy }
    const back = toItemSpace(top, t, shown.x, shown.y)
    expect(back.x).toBeCloseTo(q.x); expect(back.y).toBeCloseTo(q.y)
  })
})

describe('pickWorn', () => {
  const solid: Mask = { w: 4, h: 4, data: new Uint8Array(16).fill(255) }
  const none: Mask = { w: 4, h: 4, data: new Uint8Array(16).fill(0) }
  it('위에 있는 옷을 고른다 (아우터 > 상의)', () => {
    expect(pickWorn({ top: 'top1', outer: 'outer1' }, {}, byId, 300, 350, () => solid)).toBe('outer')
  })
  it('투명한 부분은 통과해서 아래 옷을 고른다', () => {
    expect(pickWorn({ top: 'top1', outer: 'outer1' }, {}, byId, 300, 350, (id) => (id === 'outer1' ? none : solid))).toBe('top')
    expect(pickWorn({ top: 'top1' }, {}, byId, 300, 350, () => none)).toBeNull()
  })
  it('옮기거나 키운 옷은 조절된 위치로 판정한다', () => {
    const tw = { top: { dx: 300, dy: 0, scale: 1 } }
    expect(pickWorn({ top: 'top1' }, tw, byId, 300, 350, () => undefined)).toBeNull() // 원래 자리는 비었다
    expect(pickWorn({ top: 'top1' }, tw, byId, 600, 350, () => undefined)).toBe('top')
  })
  it('마스크가 없으면 경계 상자로 판정한다', () => {
    expect(pickWorn({ top: 'top1' }, {}, byId, 300, 350, () => undefined)).toBe('top')
    expect(pickWorn({ top: 'top1' }, {}, byId, 10, 10, () => undefined)).toBeNull()
  })
})
