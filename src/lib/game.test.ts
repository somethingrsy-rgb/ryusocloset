import { describe, expect, it } from 'vitest'
import { ROOM_ITEMS } from './room'
import { ITEMS } from './items'
import { NPCS, rpsResult } from './npcs'
import { WALK_BOUNDS, clampToBounds, depthScale, stepToward } from './walk'
import { DOOR_Y, GROUND, cameraX, chunksNeeded, clampWalk, decorFor, gateAt, gateX, metersOf, placeOfChunk, startPos, stepWorld, worldWidth } from './world'
import { CYCLE_MS, clockAt, skipOffset, skipToNext, tintOf, toggleDayNight } from './daynight'
import { PLACES, assignPlaces, currentAssignment, inPool, isLocked, inRoomPool, isRoomLocked, travelPool, getGame, findItem, pickReward, spotFor } from './game'

describe('여행 게임', () => {
  const ids = Array.from({ length: 53 }, (_, i) => `item_${i}`)
  it('모든 아이템이 정확히 한 장소에 숨는다', () => {
    const a = assignPlaces(ids)
    const all = Object.values(a).flat()
    expect(all.sort()).toEqual([...ids].sort())
    expect(Object.keys(a)).toHaveLength(PLACES.length)
  })
  it('장소마다 고르게 나뉜다 (차이 1 이하)', () => {
    const sizes = Object.values(assignPlaces(ids)).map((l) => l.length)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  })
  it('목록 순서가 달라도 같은 결과다', () => {
    expect(assignPlaces([...ids].reverse())).toEqual(assignPlaces(ids))
  })
  it('숨은 자리는 화면 안이고 같은 장소 안에서 겹치지 않는다', () => {
    const list = assignPlaces(ids)[PLACES[0].id]
    const spots = list.map((id, i) => spotFor(id, i))
    for (const s of spots) {
      expect(s.x).toBeGreaterThan(0); expect(s.x).toBeLessThan(100)
      expect(s.y).toBeGreaterThan(0); expect(s.y).toBeLessThan(100)
    }
    expect(new Set(spots.map((s) => `${Math.round(s.x / 8)},${Math.round(s.y / 8)}`)).size).toBe(spots.length)
  })
  it('원피스는 기본으로 열리고 다른 아이템의 숨은 장소를 유지한다', () => {
    const dresses = ITEMS.filter(i => i.category === 'dress')
    expect(dresses.length).toBeGreaterThan(0)
    for (const dress of dresses) { expect(inPool(dress)).toBe(false); expect(isLocked(dress)).toBe(false) }
    const oldPool = ITEMS.filter(i => !!i.native && !i.id.startsWith('custom_') && ['costume', 'accessory', 'shoes', 'bag', 'outer', 'dress'].includes(i.category))
    const oldAssignment = assignPlaces(oldPool.map(i => i.id))
    const current = currentAssignment()
    const eligible = new Set(ITEMS.filter(inPool).map(i => i.id))
    for (const place of PLACES) expect(current[place.id].filter(id => eligible.has(id))).toEqual(oldAssignment[place.id].filter(id => eligible.has(id)))
    expect(Object.values(current).flat().some(id => dresses.some(d => d.id === id))).toBe(false)
  })
  it('아우터와 가방은 기본 제공하고 여행 배정에서 제외한다', () => {
    const basic = ITEMS.filter(item => item.category === 'outer' || item.category === 'bag')
    expect(basic.length).toBeGreaterThan(0)
    const assigned = new Set(Object.values(currentAssignment()).flat())
    for (const item of basic) {
      expect(inPool(item)).toBe(false)
      expect(isLocked(item)).toBe(false)
      expect(assigned.has(item.id)).toBe(false)
    }
  })
  it('기본 상의·하의, 내가 추가한 옷은 게임 대상이 아니다', () => {
    expect(inPool({ id: 'top_a', category: 'top', native: true })).toBe(false)
    expect(inPool({ id: 'custom_1', category: 'costume', native: true })).toBe(false)
    expect(inPool({ id: 'costume_a', category: 'costume', native: true })).toBe(true)
  })
})

describe('이벤트 보상', () => {
  const assign = { a: ['a1', 'a2'], b: ['b1'] }
  it('이 장소에 남은 것 중에서 고른다', () => {
    expect(pickReward(assign, ['a1'], 'a', 'here', () => 0)).toBe('a2')
  })
  it('이 장소가 다 찼으면 다른 곳에서 고른다', () => {
    expect(pickReward(assign, ['a1', 'a2'], 'a', 'here', () => 0)).toBe('b1')
  })
  it('전부 찾았으면 null', () => {
    expect(pickReward(assign, ['a1', 'a2', 'b1'], 'a', 'any')).toBeNull()
  })
})

describe('NPC', () => {
  it('모든 장소에 NPC 가 있고 퀴즈 NPC 는 정답이 보기 안에 있다', () => {
    for (const p of PLACES) {
      const n = NPCS[p.id]
      expect(n, p.id).toBeTruthy()
      expect(n.lines.length).toBeGreaterThan(0)
      if (n.event === 'quiz') expect(n.quiz!.answer).toBeLessThan(n.quiz!.choices.length)
    }
  })
  it('가위바위보 판정', () => {
    expect(rpsResult('rock', 'scissors')).toBe('win')
    expect(rpsResult('rock', 'paper')).toBe('lose')
    expect(rpsResult('paper', 'paper')).toBe('draw')
  })
})

describe('걷기', () => {
  it('목표에 닿으면 도착', () => {
    const r = stepToward({ x: 10, y: 80 }, { x: 11, y: 80 }, 1)
    expect(r.arrived).toBe(true)
    expect(r.pos).toEqual({ x: 11, y: 80 })
  })
  it('조금씩 다가간다', () => {
    const r = stepToward({ x: 10, y: 80 }, { x: 90, y: 80 }, 0.1)
    expect(r.arrived).toBe(false)
    expect(r.pos.x).toBeGreaterThan(10)
    expect(r.pos.x).toBeLessThan(90)
    expect(r.pos.y).toBe(80)
  })
  it('범위 밖은 안으로 맞춘다', () => {
    expect(clampToBounds({ x: -5, y: 10 })).toEqual({ x: WALK_BOUNDS.minX, y: WALK_BOUNDS.minY })
  })
  it('아래쪽일수록 크다', () => {
    expect(depthScale(90)).toBeGreaterThan(depthScale(55))
  })
})

describe('끝없는 맵', () => {
  it('문은 구간마다 오른쪽으로 하나씩, 한 바퀴 돌면 테마가 반복된다', () => {
    for (let c = 1; c < 25; c++) expect(gateX(c)).toBeGreaterThan(gateX(c - 1))
    expect(placeOfChunk(0).id).toBe(PLACES[0].id)
    expect(placeOfChunk(PLACES.length).id).toBe(PLACES[0].id)
    expect(placeOfChunk(PLACES.length + 2).id).toBe(PLACES[2].id)
  })
  it('끝에 가까워지면 구간이 늘어나고 줄어들지는 않는다', () => {
    expect(chunksNeeded(100, 3)).toBe(3)
    expect(chunksNeeded(worldWidth(3) - 200, 3)).toBeGreaterThan(3)
    expect(chunksNeeded(100, 8)).toBe(8)
  })
  it('카메라는 맵 밖을 보여주지 않는다', () => {
    expect(cameraX(0, 800, 3)).toBe(0)
    expect(cameraX(worldWidth(3), 800, 3)).toBe(worldWidth(3) - 800)
    expect(cameraX(2000, 800, 5)).toBe(1600)
  })
  it('문 앞에 서면 그 구간, 시작 위치는 문 앞이지만 닿지는 않는다', () => {
    expect(gateAt({ x: gateX(14), y: DOOR_Y + 40 })).toBe(14)
    expect(gateAt(startPos(14))).toBe(-1)
    expect(gateAt({ x: 0, y: DOOR_Y + 40 })).toBe(-1)
  })
  it('걷기: 다가가고, 땅 밖은 맞춘다', () => {
    const r = stepWorld({ x: 100, y: 700 }, { x: 2000, y: 700 }, 0.1)
    expect(r.arrived).toBe(false)
    expect(r.pos.x).toBeGreaterThan(100)
    expect(clampWalk(-50, 10, 3)).toEqual({ x: 60, y: GROUND.minY })
    expect(clampWalk(99999, 700, 3).x).toBe(worldWidth(3) - 60)
  })
  it('꾸밈은 구간마다 같은 모양이고 문 앞을 비운다', () => {
    expect(decorFor(7)).toEqual(decorFor(7))
    for (const d of decorFor(7, 40)) expect(Math.abs(d.x - gateX(7))).toBeGreaterThanOrEqual(170)
    expect(metersOf(1234)).toBe(24)
  })
})

describe('낮과 밤', () => {
  it('한낮은 밝고 한밤은 어둡다', () => {
    const t0 = -skipOffset()
    expect(clockAt(t0 + CYCLE_MS * 0.25).dark).toBe(0)
    expect(clockAt(t0 + CYCLE_MS * 0.75).dark).toBe(1)
    expect(clockAt(t0 + CYCLE_MS * 0.75).phase).toBe('night')
  })
  it('저녁과 새벽은 중간 어둠이다', () => {
    const t0 = -skipOffset()
    let dusk = false
    let dawn = false
    for (let i = 0; i < 480; i++) {
      const c = clockAt(t0 + i * 1000)
      if (c.phase === 'dusk') dusk = c.dark > 0 && c.dark < 1
      if (c.phase === 'dawn') dawn = c.dark > 0 && c.dark < 1
    }
    expect(dusk).toBe(true)
    expect(dawn).toBe(true)
  })
  it('건너뛰기는 다음 시간대로 간다', () => {
    const now = -skipOffset() + CYCLE_MS * 0.25
    expect(clockAt(now).phase).toBe('day')
    skipToNext(now)
    expect(clockAt(now).phase).toBe('dusk')
  })
  it('낮에는 색을 덮지 않는다', () => {
    expect(tintOf({ f: 0.25, dark: 0, phase: 'day' })).toBeNull()
  })
})

describe('테마 소품 수집과 낮밤 전환', () => {
  it('요청한 옷과 테마 소품을 여행 도감에 포함한다', () => {
    const pool = travelPool()
    expect(pool.length).toBeGreaterThan(0)
    expect(new Set(pool.map(i => i.id)).size).toBe(pool.length)
    expect(pool.every(i => ['costume', 'accessory', 'shoes', 'room'].includes(i.category))).toBe(true)
    const props = ROOM_ITEMS.filter(inRoomPool)
    expect(props.length).toBeGreaterThan(0)
    const assign = currentAssignment()
    for (const prop of props) expect(assign[prop.theme!]).toContain(prop.id)
    expect(Object.values(assign).flat().sort()).toEqual(pool.map(i => i.id).sort())
    expect(inRoomPool({ id: 'customroom_1', theme: 'spring' })).toBe(false)
  })
  it('찾은 소품을 기존 수집 기록과 함께 해제한다', () => {
    const prop = ROOM_ITEMS.find(inRoomPool)!
    const previous = [...getGame().found]
    findItem(prop.id)
    expect(isRoomLocked(prop)).toBe(false)
    for (const id of previous) expect(getGame().found).toContain(id)
    expect(findItem(prop.id)).toBe(false)
  })
  it('어느 시간대에서도 버튼으로 낮과 밤을 직접 전환한다', () => {
    for (let i = 0; i < 8; i++) {
      const now = i * 67000
      const wasDark = clockAt(now).dark > 0
      toggleDayNight(now)
      expect(clockAt(now).phase).toBe(wasDark ? 'day' : 'night')
      toggleDayNight(now)
      expect(clockAt(now).phase).toBe(wasDark ? 'night' : 'day')
    }
  })
})
