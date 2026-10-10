import { describe, expect, it } from 'vitest'
import { CANVAS_H, CANVAS_W, CATEGORIES, LAYER_Z, type Category } from './layers'
import {
  MAX_TWEAK_MOVE,
  MAX_TWEAK_SCALE,
  MIN_TWEAK_SCALE,
  canShiftLayer,
  cssTransform,
  moveTweak,
  rotateTweak,
  pickLayer,
  pivotOf,
  pruneTweaks,
  resetTweak,
  sanitizeTweaks,
  scaleTweak,
  setScaleTweak,
  shiftLayer,
  stripZ,
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
    const out = pruneTweaks(CATEGORIES, { top: 'a', outer: 'b', shoes: 's' }, { top: 'a2', outer: 'b' }, tw)
    expect(Object.keys(out)).toEqual(['outer'])
  })
  it('저장 데이터 검증', () => {
    expect(sanitizeTweaks({ top: { dx: 'x', dy: 5, scale: 9 }, bag: { dx: 1, dy: 1, scale: 1.2 }, outer: 3 }, CATEGORIES, { top: 'a', outer: 'b' })).toEqual({
      top: { dx: 0, dy: 5, scale: MAX_TWEAK_SCALE },
    })
    expect(sanitizeTweaks(null, CATEGORIES, { top: 'a' })).toEqual({})
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

describe('기울기', () => {
  it('기울기를 더하고 0 으로 돌아오면 항목을 지운다', () => {
    const a = rotateTweak({}, 'top', 20)
    expect(a.top?.rot).toBe(20)
    expect(rotateTweak(a, 'top', -20)).toEqual({})
  })
  it('-180~180 도로 맞춘다', () => {
    expect(rotateTweak({}, 'top', 190).top?.rot).toBe(-170)
  })
  it('CSS 에 rotate 가 들어가고, 화면 ↔ 이미지 좌표는 기울여도 역변환이다', () => {
    const t = { dx: 10, dy: -5, scale: 1.2, rot: 30 }
    expect(cssTransform(top, t).transform).toContain('rotate(30deg)')
    const q = { x: 180, y: 260 }
    const p = pivotOf(top)
    const a = (30 * Math.PI) / 180
    const ux = (q.x - p.x) * t.scale
    const uy = (q.y - p.y) * t.scale
    const shown = { x: p.x + ux * Math.cos(a) - uy * Math.sin(a) + t.dx, y: p.y + ux * Math.sin(a) + uy * Math.cos(a) + t.dy }
    const back = toItemSpace(top, t, shown.x, shown.y)
    expect(back.x).toBeCloseTo(q.x); expect(back.y).toBeCloseTo(q.y)
  })
})

describe('pickLayer', () => {
  const solid: Mask = { w: 4, h: 4, data: new Uint8Array(16).fill(255) }
  const none: Mask = { w: 4, h: 4, data: new Uint8Array(16).fill(0) }
  const mkLayer = (it: Item) => ({ key: it.category, id: it.id, z: it.zIndex, box: it.box })
  const both = [mkLayer(top), mkLayer(outer)]
  it('위에 있는 겹을 고른다 (아우터 > 상의)', () => {
    expect(pickLayer(both, {}, 300, 350, () => solid)).toBe('outer')
  })
  it('투명한 부분은 통과해서 아래 겹을 고른다', () => {
    expect(pickLayer(both, {}, 300, 350, (id: string) => (id === 'outer1' ? none : solid))).toBe('top')
    expect(pickLayer([mkLayer(top)], {}, 300, 350, () => none)).toBeNull()
  })
  it('옮기거나 키운 겹은 조절된 위치로 판정한다', () => {
    const tw = { top: { dx: 300, dy: 0, scale: 1 } }
    expect(pickLayer([mkLayer(top)], tw, 300, 350, () => undefined)).toBeNull() // 원래 자리는 비었다
    expect(pickLayer([mkLayer(top)], tw, 600, 350, () => undefined)).toBe('top')
  })
  it('마스크가 없으면 경계 상자로 판정한다', () => {
    expect(pickLayer([mkLayer(top)], {}, 300, 350, () => undefined)).toBe('top')
    expect(pickLayer([mkLayer(top)], {}, 10, 10, () => undefined)).toBeNull()
  })
  it('조립 탭처럼 다른 키(head/top/bottom)도 쓸 수 있다', () => {
    const layers = [
      { key: 'top' as const, id: 't', z: 20, box: { x: 100, y: 200, w: 400, h: 300 } },
      { key: 'head' as const, id: 'h', z: 30, box: { x: 100, y: 200, w: 400, h: 300 } },
    ]
    expect(pickLayer(layers, {}, 300, 350, () => solid)).toBe('head')
  })
})

describe('겹치는 순서', () => {
  const layers = [
    { key: 'bottom', z: 20 },
    { key: 'top', z: 30 },
    { key: 'outer', z: 50 },
  ] as const
  const orderOf = (tw: Parameters<typeof shiftLayer>[0]) =>
    layers
      .map((l) => ({ key: l.key, z: l.z + (tw[l.key as keyof typeof tw]?.z ?? 0) }))
      .sort((a, b) => a.z - b.z)
      .map((l) => l.key)

  it('앞으로 보내면 이웃한 위의 것과 자리를 바꾼다', () => {
    const tw = shiftLayer({}, [...layers], 'top', 1)
    expect(orderOf(tw)).toEqual(['bottom', 'outer', 'top'])
  })
  it('뒤로 보내면 아래 것과 바꾸고, 다시 앞으로 보내면 처음 순서로 돌아와 조절값이 사라진다', () => {
    let tw = shiftLayer({}, [...layers], 'top', -1)
    expect(orderOf(tw)).toEqual(['top', 'bottom', 'outer'])
    const now = layers.map((l) => ({ key: l.key, z: l.z + (tw[l.key as keyof typeof tw]?.z ?? 0) }))
    tw = shiftLayer(tw, now, 'top', 1)
    expect(orderOf(tw)).toEqual(['bottom', 'top', 'outer'])
    expect(Object.keys(tw)).toEqual([])
  })
  it('맨 위·맨 아래는 더 못 가고 그대로다', () => {
    expect(canShiftLayer([...layers], 'outer', 1)).toBe(false)
    expect(canShiftLayer([...layers], 'bottom', -1)).toBe(false)
    expect(canShiftLayer([...layers], 'top', 1)).toBe(true)
    expect(shiftLayer({}, [...layers], 'outer', 1)).toEqual({})
  })
  it('위치·크기 조절은 그대로 두고 순서만 바꾼다. stripZ 는 순서만 지운다', () => {
    const tw = shiftLayer({ top: { dx: 5, dy: 0, scale: 1.2 } }, [...layers], 'top', 1)
    expect(tw.top?.dx).toBe(5)
    expect(tw.top?.scale).toBe(1.2)
    expect(tw.top?.z).toBe(20)
    const stripped = stripZ(tw)
    expect(stripped.top).toEqual({ dx: 5, dy: 0, scale: 1.2 })
    expect(stripped.outer).toBeUndefined()
  })
  it('저장된 순서 조절값을 읽는다', () => {
    const raw = { top: { dx: 0, dy: 0, scale: 1, z: 20 } }
    expect(sanitizeTweaks(raw, ['top'] as const, { top: 'x' }).top?.z).toBe(20)
  })
})

