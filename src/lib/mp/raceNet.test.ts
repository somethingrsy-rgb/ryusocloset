import { describe, expect, it } from 'vitest'
import { RACE_MAX, STALE_MS, pickRoom, pickRooms, saneMeta, sanePlayer, slotOf, type RoomSnap } from './raceNet'
import { applyNetReport, newNetRace, rankNow, stepRace } from '../race'

const pl = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`u${i}`, { name: `n${i}`, car: 'heart', d: 0, x: 0, speed: 0, fin: null, t: 1 }]))
const room = (n: number, startAt = 0, t = 1000): RoomSnap => ({ meta: { host: 'u0', seed: 5, startAt, t }, players: pl(n) })

describe('같이 달리기 방 고르기', () => {
  it('대기 중이고 자리가 있는 방에 들어가고, 없으면 빈 방을 만든다', () => {
    expect(pickRoom({}, 5000)).toEqual({ room: 'r1', create: true })
    expect(pickRoom({ r1: room(2) }, 5000)).toEqual({ room: 'r1', create: false })
    expect(pickRoom({ r1: room(RACE_MAX) }, 5000)).toEqual({ room: 'r2', create: true })
    expect(pickRoom({ r1: room(2, 9999) }, 5000)).toEqual({ room: 'r2', create: true })
    // 소식이 끊긴 방에는 들어가지 않고(규칙상 10분이 지나야 덮어쓸 수 있어서) 다른 빈 방을 쓴다
    expect(pickRoom({ r1: room(1, 0, 1000) }, 1000 + STALE_MS * 4 + 1)).toEqual({ room: 'r2', create: true })
    // 10분 넘게 끊긴 방도 쓸 수 있지만, 빈 방이 있으면 빈 방을 먼저 쓴다
    expect(pickRoom({ r1: room(1, 0, 1000) }, 1000 + 600001)).toEqual({ room: 'r2', create: true })
    expect(pickRooms({ r1: room(1, 0, 1000) }, 1000 + 600001).some((c) => c.room === 'r1' && c.create)).toBe(true)
    const full = Object.fromEntries(['r1', 'r2', 'r3', 'r4', 'r5', 'r6'].map((r) => [r, room(RACE_MAX, 9999, 4900)]))
    expect(pickRoom(full, 5000)).toBeNull()
  })
  it('서버에서 온 값은 걸러서 쓴다', () => {
    expect(sanePlayer({ name: '아주아주아주아주긴이름입니다', car: 'star', d: 99999, x: 9, speed: -4, fin: null, t: 1 })).toMatchObject({ name: '아주아주아주아주긴이름입', d: 5000, x: 3, speed: 0, fin: null })
    expect(sanePlayer(null)).toBeNull(); expect(sanePlayer({ name: 1 })).toBeNull()
    expect(saneMeta({ host: 'a', seed: 12.7, startAt: 0, t: 1 })?.seed).toBe(12)
    expect(saneMeta({ seed: 1 })).toBeNull()
  })
  it('출발 자리는 모두의 화면에서 같다', () => {
    const uids = ['zed', 'amy', 'kim']
    expect(slotOf(uids, 'amy')).toBe(0); expect(slotOf(uids, 'kim')).toBe(1); expect(slotOf(uids, 'zed')).toBe(2)
  })
})

describe('방 후보 순서', () => {
  it('남은 찌꺼기 방은 뒤로 미루고, 빈 방을 먼저 만든다', () => {
    const junk: RoomSnap = { meta: null, players: pl(1) }
    const list = pickRooms({ r1: junk, r2: room(2, 0, 1000) }, 1000 + 5000)
    expect(list[0]).toEqual({ room: 'r2', create: false })
    expect(list[1]).toEqual({ room: 'r3', create: true })
    expect(list[list.length - 1]).toEqual({ room: 'r1', create: true })
    expect(pickRooms({ r1: room(1, 0, 1000) }, 1000 + 700000)[0]).toEqual({ room: 'r2', create: true })
    const all = Object.fromEntries(['r1','r2','r3','r4','r5','r6'].map((r) => [r, room(RACE_MAX, 9999, 4900)]))
    expect(pickRooms(all, 5000)).toEqual([])
  })
})

describe('같이 달리기 판', () => {
  it('같은 씨앗·5칸 길, 친구 차는 받은 소식대로 움직인다', () => {
    let r = newNetRace(7, 0, [{ id: 0, name: 'a', car: 'cloud', slot: 1 }, { id: 1, name: 'b', car: 'star', slot: 2 }])
    expect(r.lanes).toBe(5); expect(r.seed).toBe(7); expect(r.lane).toBe(-2); expect(r.rivals.map((v) => v.lane)).toEqual([-1, 1])
    r = { ...r, phase: 'run', count: 0 }
    r = applyNetReport(r, 0, { d: 100, x: 1.5, speed: 30, fin: null }, 1)
    for (let i = 0; i < 40; i++) r = stepRace(r, 0.05)
    const a = r.rivals[0]
    expect(a.net?.car).toBe('cloud'); expect(a.d).toBeGreaterThan(100); expect(Math.abs(a.x - 1.5)).toBeLessThan(0.05)
    // 컴퓨터처럼 혼자 달리지 않는다: 소식이 없는 친구는 제자리
    expect(r.rivals[1].d).toBe(0)
    expect(rankNow(r)).toBeGreaterThanOrEqual(1)
  })
  it('결승선을 지난 친구가 있으면 내 순위가 밀린다', () => {
    let r = newNetRace(7, 0, [{ id: 0, name: 'a', car: 'cloud', slot: 1 }])
    r = applyNetReport({ ...r, phase: 'run', count: 0, d: 50 }, 0, { d: 1600, x: 0, speed: 30, fin: 40 }, 1)
    expect(rankNow(r)).toBe(2)
    expect(applyNetReport(r, 9, { d: 1, x: 0, speed: 0, fin: null }, 1)).toBe(r)
  })
})