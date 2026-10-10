import { describe, expect, it } from 'vitest'
import { NPCS, rpsResult } from './npcs'
import { WALK_BOUNDS, clampToBounds, depthScale, stepToward } from './walk'
import { DOOR_Y, GROUND, cameraX, chunksNeeded, clampWalk, decorFor, gateAt, gateX, metersOf, placeOfChunk, startPos, stepWorld, worldWidth } from './world'
import { CYCLE_MS, clockAt, skipOffset, skipToNext, tintOf } from './daynight'
import { BUILTIN_QUESTIONS, parseQuestions, pickQuestion } from './questions'
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

describe('영어 문제', () => {
  it('내장 문제는 모두 형식이 맞고 정답이 보기 안에 있다', () => {
    expect(BUILTIN_QUESTIONS.length).toBeGreaterThanOrEqual(60)
    const ids = new Set<string>()
    for (const q of BUILTIN_QUESTIONS) {
      expect(ids.has(q.id)).toBe(false)
      ids.add(q.id)
      expect(q.choices.length).toBeGreaterThanOrEqual(3)
      expect(new Set(q.choices).size).toBe(q.choices.length)
      expect(q.answer).toBeGreaterThanOrEqual(0)
      expect(q.answer).toBeLessThan(q.choices.length)
      expect(q.q.length).toBeGreaterThan(8)
      expect(q.explain.length).toBeGreaterThan(2)
      expect(PLACES.some((p) => p.id === q.place)).toBe(true)
    }
  })
  it('장소마다 단어와 문법 문제가 있다', () => {
    for (const p of PLACES) {
      const qs = BUILTIN_QUESTIONS.filter((q) => q.place === p.id)
      expect(qs.some((q) => q.type === 'vocab')).toBe(true)
      expect(qs.some((q) => q.type === 'grammar')).toBe(true)
    }
  })
  it('최근에 푼 문제는 피해서 고른다', () => {
    const all = BUILTIN_QUESTIONS.filter((q) => q.place === 'spring')
    const recent = all.slice(1).map((q) => q.id)
    expect(pickQuestion('spring', recent, () => 0, all)?.id).toBe(all[0].id)
    expect(pickQuestion('spring', all.map((q) => q.id), () => 0, all)).toBeTruthy()
    expect(pickQuestion('nowhere', [], () => 0, [])).toBeNull()
  })
  it('붙여넣은 문제를 읽는다', () => {
    const text = [
      '# 주석',
      '단어 | He is ___ at math. | good / well / nice | 1 | be good at ~: ~을 잘하다 | 봄소풍',
      'grammar | She ___ here since 2020. | lives / has lived | 2 | 현재완료',
      '문법 | 보기 하나 | a | 1',
      '단어 | q | a / b | 3',
      '시험 | q | a / b | 1',
    ].join('\n')
    const { ok, errors } = parseQuestions(text, PLACES, 1)
    expect(ok).toHaveLength(2)
    expect(ok[0]).toMatchObject({ type: 'vocab', answer: 0, place: 'spring', choices: ['good', 'well', 'nice'] })
    expect(ok[1]).toMatchObject({ type: 'grammar', answer: 1 })
    expect(ok[1].place).toBeUndefined()
    expect(errors).toHaveLength(3)
  })
})
