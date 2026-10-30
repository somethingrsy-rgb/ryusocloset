import { describe, expect, it } from 'vitest'
import { CALL_ANIMALS } from './animalCalls'
import { AVATAR_GUEST, PERSONAL, arrive, avatarGuest, guestAvatar, guestName, isAvatarGuest, byeLine, eatLine, helloLine, leaveAll, orderLine, partyLine, partyWish, sanitizeParty, stepGuests } from './party'
import { menuById } from './recipes'

const floor = { minX: 10, maxX: 90, minY: 70, maxY: 95 }
const seeded = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

describe('집 파티', () => {
  it('인사: 유하야·유엘아 안녕? 초대해 줘서 고마워!', () => {
    expect(helloLine('유하')).toBe('유하야, 안녕? 초대해 줘서 고마워!')
    expect(helloLine('유엘')).toBe('유엘아, 안녕? 초대해 줘서 고마워!')
    expect(byeLine('유엘')).toContain('유엘아')
  })
  it('문 밖에서 들어와 한 번 인사하고, 그 뒤로는 바닥 안에서만 돌아다닌다', () => {
    const rnd = seeded(3)
    let gs = [arrive(0, floor, rnd), arrive(5, floor, rnd)]
    expect(gs[0].x).toBeLessThan(0)
    const hellos: number[] = []
    for (let t = 0; t < 60 * 60; t++) {
      const r = stepGuests(gs, 1 / 60, floor, rnd)
      gs = r.guests
      hellos.push(...r.arrivedNow)
      if (t > 60 * 15) for (const g of gs) {
        expect(g.x).toBeGreaterThanOrEqual(floor.minX - 0.01); expect(g.x).toBeLessThanOrEqual(floor.maxX + 0.01)
        expect(g.y).toBeGreaterThanOrEqual(floor.minY - 0.01); expect(g.y).toBeLessThanOrEqual(floor.maxY + 0.01)
      }
    }
    expect(hellos.sort()).toEqual([0, 5])
    expect(new Set(gs.map((g) => Math.round(g.x))).size).toBeGreaterThan(1)
  })
  it('여러 친구가 돌아다녀도 서로(아바타와도) 파고들지 않는다', () => {
    const rnd = seeded(11)
    const me = { x: 50, y: 85 }
    let gs = [0, 1, 2, 3, 4, 5].map((a) => arrive(a, floor, rnd))
    gs = gs.map((g, k) => ({ ...g, x: 15 + k * 14, y: 72 + (k % 2) * 18, entering: false }))
    const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.6)
    let tooClose = 0, frames = 0
    for (let t = 0; t < 60 * 90; t++) {
      gs = stepGuests(gs, 1 / 60, floor, rnd, [me]).guests
      if (t < 60 * 5) continue
      frames++
      for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) if (gap(gs[i], gs[j]) < PERSONAL * 0.7) tooClose++
    }
    expect(tooClose / frames).toBeLessThan(0.02)
  })
  it('파티를 끝내면 모두 문으로 나간다', () => {
    let gs = leaveAll([arrive(1, floor), arrive(2, floor)])
    const gone: number[] = []
    for (let t = 0; t < 60 * 30 && gs.length; t++) { const r = stepGuests(gs, 1 / 60, floor); gs = r.guests; gone.push(...r.gone) }
    expect(gs).toHaveLength(0)
    expect(gone.sort()).toEqual([1, 2])
  })
  it('파티 이야기에는 빈칸이 남지 않고, 친구 이름도 부른다', () => {
    const rnd = seeded(9)
    const lines = new Set<string>()
    for (let i = 0; i < 400; i++) for (let a = 0; a < CALL_ANIMALS.length; a++) lines.add(partyLine(a, [0, 1, 2].filter((x) => x !== a), '유하', rnd))
    for (const l of lines) expect(l).not.toMatch(/[{}]/)
    expect([...lines].some((l) => l.startsWith('곰이야,') || l.startsWith('몽실아,'))).toBe(true)
    expect([...lines].some((l) => l.includes('유하야'))).toBe(true)
  })
})

describe('파티 음식', () => {
  it('파티 상태는 장소와 친구 번호만 남기고(겹치거나 없는 친구는 빼고), 친구가 없으면 파티가 없다', () => {
    expect(sanitizeParty({ place: 'home', guests: [1, 1, 3, 99, -1, 2.5] })).toEqual({ place: 'home', guests: [1, 3] })
    expect(sanitizeParty({ place: 'home', guests: [] })).toEqual({ place: null, guests: [] })
    expect(sanitizeParty('x')).toEqual({ place: null, guests: [] })
  })
  it('아바타 친구도 손님 번호(AVATAR_GUEST + 아바타 순서)로 초대할 수 있고, 이름·말이 아바타에 맞다', () => {
    const yuha = avatarGuest('yuha')
    expect(isAvatarGuest(yuha)).toBe(true)
    expect(guestAvatar(yuha)?.id).toBe('yuha')
    expect(guestName(yuha)).toBe('유하')
    expect(sanitizeParty({ place: 'home', guests: [yuha, 2, AVATAR_GUEST + 99] })).toEqual({ place: 'home', guests: [yuha, 2] })
    const rnd = seeded(5)
    for (let i = 0; i < 40; i++) {
      const line = partyLine(yuha, [1], '유엘', rnd)
      expect(line).not.toMatch(/[{}]|undefined/)
    }
    for (let i = 0; i < 40; i++) expect(partyLine(1, [yuha], '유엘', rnd)).not.toContain('undefined')
  })
  it('친구는 카페 메뉴 중 하나를 주문하고, 주문·먹을 때 말을 한다', () => {
    const rnd = seeded(3)
    for (let i = 0; i < 30; i++) expect(menuById(partyWish(rnd))).toBeTruthy()
    expect(orderLine('카페라테')).toBe('나는 카페라테 먹고 싶어!')
    for (let i = 0; i < 20; i++) expect(eatLine('유하', rnd)).not.toContain('{call}')
  })
})
