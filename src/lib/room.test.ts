import { describe, expect, it } from 'vitest'
import {
  ROOM_ITEMS,
  ROOM_THEMES,
  addItem,
  defaultCamp,
  defaultRoom,
  drawables,
  moveTo,
  registerCustomRoomItem,
  removeItem,
  sanitizeRoom,
  scaleBy,
  setScale,
  shiftLayer,
  canShiftLayer,
  toggleFlip,
} from './room'
import { hitTest, type Mask } from './roomHit'
import { AVATAR_FEET_RATIO, MAX_PLACED, MAX_SCALE, MIN_SCALE, ROOM_EXTRA, ROOM_H, ROOM_W, type RoomState } from './roomTypes'

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
  it('이동은 방 양옆 배경까지만 제한된다', () => {
    const s = addItem(empty(), def('furniture'), 'a')!
    expect(moveTo(s, { kind: 'item', uid: 'a' }, -50, 500).items[0].x).toBe(-50) // 방 왼쪽 밖(배경 위)도 가능
    const m = moveTo(s, { kind: 'item', uid: 'a' }, -99999, 99999)
    expect(m.items[0].x).toBe(-ROOM_EXTRA)
    expect(m.items[0].y).toBeLessThanOrEqual(ROOM_H + 30)
    expect(moveTo(s, { kind: 'avatar' }, 99999, 10).avatar.x).toBe(ROOM_W + ROOM_EXTRA)
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
    expect(r.items[0].x).toBe(ROOM_W + ROOM_EXTRA)
    expect(r.items[0].scale).toBe(MIN_SCALE)
    expect(r.avatar.x).toBe(-5)
    expect(r.avatar.scale).toBe(MAX_SCALE)
  })
  it('빈 배열이면 빈 방을 존중한다', () => {
    expect(sanitizeRoom({ avatar: {}, items: [] }).items).toEqual([])
  })
})

describe('drawables 순서', () => {
  it('러그 < 벽 장식 < 가구·아바타(y 순) < 조명', () => {
    // 지금 기본 물건에는 러그가 없어서, 러그 순서를 확인하려고 가짜 러그를 등록한다
    const rug = { ...def('furniture'), id: 'customroom_testrug', group: 'rug' as const }
    registerCustomRoomItem(rug, true)
    let s = empty()
    s = addItem(s, def('light'), 'l')!
    s = addItem(s, def('furniture'), 'f')!
    s = addItem(s, def('wall'), 'w')!
    s = addItem(s, rug, 'r')!
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

describe('아바타 기준점', () => {
  it('아바타의 y 는 발바닥 위치다 (캔버스 아래 여백만큼 위로 올려 그린다)', () => {
    const d = drawables(empty()).find((x) => x.group === 'avatar')!
    expect(d.top + d.h * AVATAR_FEET_RATIO).toBeCloseTo(d.y)
    expect(d.top + d.h).toBeGreaterThan(d.y)
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

describe('camping', () => {
  it('캠핑 용품이 목록에 있고 기본 캠핑장은 유효한 것만 담는다', () => {
    expect(ROOM_ITEMS.filter((d) => d.group === 'camp').length).toBeGreaterThanOrEqual(7)
    const camp = defaultCamp()
    expect(camp.items.length).toBeGreaterThan(0)
    expect(camp.items.every((p) => ROOM_ITEMS.some((d) => d.id === p.itemId && d.group === 'camp'))).toBe(true)
  })
  it('저장된 캠핑장의 밤 설정을 지킨다 (없으면 낮)', () => {
    const night = sanitizeRoom({ ...defaultCamp(), night: true }, defaultCamp())
    expect(night.night).toBe(true)
    expect(sanitizeRoom({ ...defaultCamp() }, defaultCamp()).night).toBeUndefined()
    expect(sanitizeRoom(null, defaultCamp()).items.length).toBe(defaultCamp().items.length)
  })
})

describe('테마', () => {
  it('테마와 테마 소품이 있고, 소품은 모두 존재하는 테마에 속한다', () => {
    expect(ROOM_THEMES.length).toBeGreaterThanOrEqual(7)
    const themed = ROOM_ITEMS.filter((d) => d.theme)
    expect(themed.length).toBeGreaterThan(20)
    expect(themed.every((d) => ROOM_THEMES.some((t) => t.id === d.theme))).toBe(true)
    // 바닥은 방 높이 안에서 벽지 아래부터 깔린다
    expect(ROOM_THEMES.every((t) => t.floorH > 300 && t.floorH <= ROOM_H)).toBe(true)
  })
  it('벽과 바닥은 따로 저장되고, 있는 것만 지킨다', () => {
    const [a, b] = [ROOM_THEMES[0].id, ROOM_THEMES[1].id]
    const r = sanitizeRoom({ ...defaultRoom(), wallId: a, floorId: b })
    expect([r.wallId, r.floorId]).toEqual([a, b])
    const only = sanitizeRoom({ ...defaultRoom(), wallId: a })
    expect(only.wallId).toBe(a)
    expect(only.floorId).toBeUndefined()
    const bad = sanitizeRoom({ ...defaultRoom(), wallId: 'nope', floorId: 'nope' })
    expect([bad.wallId, bad.floorId]).toEqual([undefined, undefined])
  })
  it('예전에 테마 하나로 저장한 방은 벽과 바닥을 같은 테마로 옮긴다', () => {
    const id = ROOM_THEMES[0].id
    const r = sanitizeRoom({ ...defaultRoom(), themeId: id })
    expect([r.wallId, r.floorId]).toEqual([id, id])
  })
})

describe('겹치는 순서 (방)', () => {
  const two = () => {
    let s = empty()
    s = addItem(s, def('furniture'), 'a')!
    s = addItem(s, ROOM_ITEMS.filter((d) => d.group === 'furniture')[1], 'b')!
    s = moveTo(s, { kind: 'item', uid: 'a' }, 400, 1200)
    s = moveTo(s, { kind: 'item', uid: 'b' }, 420, 1300) // b 가 a 보다 아래(y 큼) → 앞에 그려진다
    return s
  }
  const order = (s: RoomState) => drawables(s).map((d) => (d.sel.kind === 'item' ? d.sel.uid : 'avatar'))

  it('앞으로/뒤로 보내면 이웃한 것과 순서가 바뀐다', () => {
    const s = two()
    const before = order(s)
    const i = before.indexOf('a')
    const moved = shiftLayer(s, { kind: 'item', uid: 'a' }, 1)
    const after = order(moved)
    expect(after.indexOf('a')).toBe(i + 1)
    expect(order(shiftLayer(moved, { kind: 'item', uid: 'a' }, -1))).toEqual(before)
  })
  it('맨 앞/맨 뒤에서는 더 못 간다', () => {
    const s = two()
    const list = drawables(s)
    expect(canShiftLayer(s, list[list.length - 1].sel, 1)).toBe(false)
    expect(canShiftLayer(s, list[0].sel, -1)).toBe(false)
    expect(shiftLayer(s, list[0].sel, -1)).toBe(s)
  })
  it('아바타도 순서를 바꿀 수 있고, 저장된 순서 조절값을 읽는다', () => {
    const s = two()
    const moved = shiftLayer(s, { kind: 'avatar' }, -1)
    expect(moved.avatar.zb).toBeDefined()
    const back = sanitizeRoom(JSON.parse(JSON.stringify(moved)))
    expect(order(back)).toEqual(order(moved))
    expect(sanitizeRoom({ ...s, avatar: { ...s.avatar, zb: 'x' } }).avatar.zb).toBeUndefined()
  })
})

