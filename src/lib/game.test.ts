import { describe, expect, it } from 'vitest'
import { NPCS, rpsResult } from './npcs'
import { WALK_BOUNDS, clampToBounds, depthScale, stepToward } from './walk'
import { DOOR_Y, GROUND, WORLD_W, cameraX, clampWalk, gateAt, gateX, startPos, stepWorld } from './world'
import { CYCLE_MS, clockAt, skipOffset, skipToNext, tintOf } from './daynight'
import { PLACES, assignPlaces, inPool, pickReward, spotFor } from './game'

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

describe('넓은 맵', () => {
  it('문은 왼쪽에서 오른쪽으로 순서대로, 맵 안에 있다', () => {
    const xs = PLACES.map((_, i) => gateX(i))
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
    expect(xs[0]).toBeGreaterThan(0)
    expect(xs[xs.length - 1]).toBeLessThan(WORLD_W)
  })
  it('카메라는 맵 밖을 보여주지 않는다', () => {
    expect(cameraX(0, 800)).toBe(0)
    expect(cameraX(WORLD_W, 800)).toBe(WORLD_W - 800)
    expect(cameraX(2000, 800)).toBe(1600)
  })
  it('문 앞에 서면 그 장소, 시작 위치는 문 앞이지만 닿지는 않는다', () => {
    expect(gateAt({ x: gateX(3), y: DOOR_Y + 40 })).toBe(3)
    expect(gateAt(startPos(3))).toBe(-1)
  })
  it('걷기: 다가가고, 땅 밖은 맞춘다', () => {
    const r = stepWorld({ x: 100, y: 700 }, { x: 2000, y: 700 }, 0.1)
    expect(r.arrived).toBe(false)
    expect(r.pos.x).toBeGreaterThan(100)
    expect(clampWalk(-50, 10)).toEqual({ x: 60, y: GROUND.minY })
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
