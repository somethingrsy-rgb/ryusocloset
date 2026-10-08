import { describe, expect, it } from 'vitest'
import {
  ROOM_ITEMS,
  addItem,
  defaultRoom,
  drawables,
  moveTo,
  removeItem,
  sanitizeRoom,
  scaleBy,
  setScale,
  toggleFlip,
} from './room'
import { hitTest, type Mask } from './roomHit'
import { MAX_PLACED, MAX_SCALE, MIN_SCALE, ROOM_H, ROOM_W, type RoomState } from './roomTypes'

const def = (group: string) => ROOM_ITEMS.find((d) => d.group === group)!
const empty = (): RoomState => ({ avatar: { x: 500, y: 1300, scale: 1, flip: false }, items: [] })

describe('room state', () => {
  it('기본 방은 유효한 아이템만 담는다', () => {
    const r = defaultRoom()
    expect(r.items.length).toBeGreaterThan(0)
    for (const p of r.items) expect(ROOM_ITEMS.some((d) => d.id === p.itemId)).toBe(true)
  })
  it('물건을 추가하고, 같은 물건은 겹치지 않게 비껴 놓는다', () => {
    const f = def('furniture')
    const a = addItem(empty(), f, 'a')!
    const b = addItem(a, f, 'b')!
    expect(b.items).toHaveLength(2)
    expect(b.items[1].x).not.toBe(b.items[0].x)
  })
  it(`최대 ${MAX_PLACED}개까지만 놓을 수 있다`, () => {
    let s: RoomState | null = empty()
    for (let i = 0; i < MAX_PLACED; i++) s = addItem(s!, def('wall'), `u${i}`)
    expect(s!.items).toHaveLength(MAX_PLACED)
    expect(addItem(s!, def('wall'), 'over')).toBeNull()
  })
  it('이동은 방 안으로 제한된다', () => {
    const s = addItem(empty(), def('furniture'), 'a')!
    const m = moveTo(s, { kind: 'item', uid: 'a' }, -50, 99999)
    expect(m.items[0].x).toBe(0)
    expect(m.items[0].y).toBeLessThanOrEqual(ROOM_H + 30)
    expect(moveTo(s, { kind: 'avatar' }, 9999, 10).avatar.x).toBe(ROOM_W)
  })
  it('크기는 범위로 제한된다', () => {
    const s = empty()
    expect(setScale(s, { kind: 'avatar' }, 99).avatar.scale).toBe(MAX_SCALE)
    expect(scaleBy(s, { kind: 'avatar' }, 0.0001).avatar.scale).toBe(MIN_SCALE)
  })
  it('좌우 반전과 삭제', () => {
    const s = addItem(empty(), def('furniture'), 'a')!
    expect(toggleFlip(s, { kind: 'item', uid: 'a' }).items[0].flip).toBe(true)
    expect(removeItem(s, 'a').items).toHaveLength(0)
  })
  it('원본 상태를 변경하지 않는다', () => {
    const s = addItem(empty(), def('furniture'), 'a')!
    const before = JSON.stringify(s)
    moveTo(s, { kind: 'item', uid: 'a' }, 1, 1)
    scaleBy(s, { kind: 'avatar' }, 2)
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('sanitizeRoom', () => {
  it('이상한 입력은 기본 방으로', () => {
    expect(sanitizeRoom(null).items.length).toBeGreaterThan(0)
    expect(sanitizeRoom('x').avatar.scale).toBe(1)
  })
  it('모르는 아이템은 버리고 값 범위를 보정하고 uid 중복을 푼다', () => {
    const id = def('furniture').id
    const r = sanitizeRoom({
      avatar: { x: -5, y: 'a', scale: 100 },
      items: [
        { uid: 'a', itemId: id, x: 5000, y: 10, scale: 0 },
        { uid: 'a', itemId: id },
        { uid: 'z', itemId: 'nope' },
      ],
    })
    expect(r.items).toHaveLength(2)
    expect(new Set(r.items.map((p) => p.uid)).size).toBe(2)
    expect(r.items[0].x).toBe(ROOM_W)
    expect(r.items[0].scale).toBe(MIN_SCALE)
    expect(r.avatar.x).toBe(0)
    expect(r.avatar.scale).toBe(MAX_SCALE)
  })
  it('빈 배열이면 빈 방을 존중한다', () => {
    expect(sanitizeRoom({ avatar: {}, items: [] }).items).toEqual([])
  })
})

describe('drawables 순서', () => {
  it('러그 < 벽 장식 < 가구·아바타(y 순) < 조명', () => {
    let s = empty()
    s = addItem(s, def('light'), 'l')!
    s = addItem(s, def('furniture'), 'f')!
    s = addItem(s, def('wall'), 'w')!
    s = addItem(s, def('rug'), 'r')!
    s = moveTo(s, { kind: 'item', uid: 'f' }, 400, 1200)
    const order = drawables(s).map((d) => d.group)
    expect(order).toEqual(['rug', 'wall', 'furniture', 'avatar', 'light'])
  })
  it('아바타가 가구보다 아래(y 큼)에 있으면 앞에 그려진다', () => {
    let s = addItem(empty(), def('furniture'), 'f')!
    s = moveTo(s, { kind: 'item', uid: 'f' }, 500, 1100)
    expect(drawables(s).map((d) => d.group).slice(-2)).toEqual(['furniture', 'avatar'])
    s = moveTo(s, { kind: 'item', uid: 'f' }, 500, 1390)
    expect(drawables(s).map((d) => d.group).slice(-2)).toEqual(['avatar', 'furniture'])
  })
})

describe('hitTest', () => {
  const solid: Mask = { w: 4, h: 4, data: new Uint8Array(16).fill(255) }
  const hollow: Mask = { w: 4, h: 4, data: new Uint8Array(16).fill(0) }
  it('가장 위의 물건을 고른다', () => {
    let s = addItem(empty(), def('furniture'), 'f')!
    s = moveTo(s, { kind: 'item', uid: 'f' }, 500, 1300)
    const sel = hitTest(s, 500, 1250, () => solid)
    expect(sel).toEqual({ kind: 'avatar' }) // 아바타가 같은 y 에서 더 앞
  })
  it('투명한 부분은 통과해서 뒤의 물건을 고른다', () => {
    let s = addItem(empty(), def('wall'), 'w')!
    s = moveTo(s, { kind: 'item', uid: 'w' }, 500, 700)
    const masks = (k: string) => (k === 'avatar' ? hollow : solid)
    expect(hitTest(s, 500, 600, masks)).toEqual({ kind: 'item', uid: 'w' })
    expect(hitTest(s, 5, 5, masks)).toBeNull()
  })
  it('조명 효과는 다른 물건이 없을 때만 선택된다', () => {
    let s = addItem(empty(), def('light'), 'l')!
    s = addItem(s, def('wall'), 'w')!
    s = moveTo(s, { kind: 'item', uid: 'l' }, 500, 800)
    s = moveTo(s, { kind: 'item', uid: 'w' }, 500, 800)
    expect(hitTest(s, 500, 700, () => solid)).toEqual({ kind: 'item', uid: 'w' })
  })
  it('좌우 반전 시 좌표를 뒤집어 판정한다', () => {
    const left: Mask = { w: 10, h: 1, data: new Uint8Array([255, 255, 255, 255, 255, 0, 0, 0, 0, 0]) } // 왼쪽 절반만 불투명
    let s = addItem(empty(), def('furniture'), 'f')!
    s = moveTo(s, { kind: 'item', uid: 'f' }, 500, 700)
    s = { ...s, avatar: { ...s.avatar, y: 100, x: 100 } }
    const d = drawables(s).find((x) => x.group === 'furniture')!
    const at = (u: number) => hitTest(s, d.left + d.w * u, d.top + d.h / 2, (k) => (k === d.key ? left : undefined))
    expect(at(0.05)).not.toBeNull()
    const flipped = toggleFlip(s, { kind: 'item', uid: 'f' })
    const d2 = drawables(flipped).find((x) => x.group === 'furniture')!
    const at2 = (u: number) => hitTest(flipped, d2.left + d2.w * u, d2.top + d2.h / 2, (k) => (k === d2.key ? left : undefined))
    expect(at2(0.05)).toBeNull()
    expect(at2(0.95)).not.toBeNull()
  })
})
