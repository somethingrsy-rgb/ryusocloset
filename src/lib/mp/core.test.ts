import { describe, expect, it } from 'vitest'
import { KEEPALIVE_MS, SEND_MS, bossCanRespawn, bossHit, cleanChat, cleanName, follow, saneBoss, sanePlayer, shouldSend } from './core'

describe('멀티플레이어 규칙', () => {
  it('닉네임·채팅을 다듬는다', () => {
    expect(cleanName('  류소   공주님입니다아아아  ')).toBe('류소 공주님입니다아아아'.slice(0, 12))
    expect(cleanChat('x'.repeat(200))).toHaveLength(80)
    expect(cleanName(5)).toBe('')
  })
  it('받은 플레이어 값이 이상하면 버리거나 고친다', () => {
    expect(sanePlayer({ x: 'a', z: 1, t: 1 })).toBeNull()
    const p = sanePlayer({ name: '', x: 999, z: -3, dir: 7, moving: 'y', t: 5, look: { avatar: 'yuha', outfit: { dress: 'd1', bad: 3 } } })!
    expect(p).toEqual({ name: '친구', room: 'none', x: 200, z: -3, dir: 1, moving: false, look: { avatar: 'yuha', outfit: { dress: 'd1' } }, t: 5 })
  })
  it('위치는 너무 자주 보내지 않고, 움직였을 때·오래됐을 때만 보낸다', () => {
    const last = { x: 0, z: 0, dir: 1, moving: false, at: 1000 }
    expect(shouldSend(null, { x: 0, z: 0, dir: 1, moving: false }, 0)).toBe(true)
    expect(shouldSend(last, { x: 5, z: 0, dir: 1, moving: true }, 1000 + SEND_MS - 1)).toBe(false)
    expect(shouldSend(last, { x: 5, z: 0, dir: 1, moving: true }, 1000 + SEND_MS)).toBe(true)
    expect(shouldSend(last, { x: 0.01, z: 0, dir: 1, moving: false }, 1000 + SEND_MS)).toBe(false)
    expect(shouldSend(last, { x: 0, z: 0, dir: -1, moving: false }, 1000 + SEND_MS)).toBe(true)
    expect(shouldSend(last, { x: 0, z: 0, dir: 1, moving: false }, 1000 + KEEPALIVE_MS)).toBe(true)
  })
  it('보간 비율은 프레임 빠르기와 상관없이 같다', () => {
    const a = 1 - (1 - follow(1 / 60)) ** 2, b = follow(1 / 30)
    expect(a).toBeCloseTo(b, 6)
  })
})

describe('대왕 몬스터', () => {
  const b = { id: 'b1', type: 2, x: 1, z: 2, hp: 5, max: 40, t: 100 }
  it('마법 한 번에 힘만큼(최대 3) 깎인다', () => {
    expect(bossHit(b, 'b1', 2)?.hp).toBe(3)
    expect(bossHit(b, 'b1', 9)?.hp).toBe(2)
    expect(bossHit({ ...b, hp: 1 }, 'b1', 3)?.hp).toBe(0)
    expect(bossHit(b, 'other', 1)).toBeNull()
    expect(bossHit({ ...b, hp: 0 }, 'b1', 1)).toBeNull()
  })
  it('없거나 풀리고 10초 지나면 새로 나온다', () => {
    expect(bossCanRespawn(null, 0)).toBe(true)
    expect(bossCanRespawn(b, 1e9)).toBe(false)
    expect(bossCanRespawn({ ...b, hp: 0 }, 5000)).toBe(false)
    expect(bossCanRespawn({ ...b, hp: 0 }, 20000)).toBe(true)
  })
  it('이상한 값은 버린다', () => {
    expect(saneBoss({ ...b, hp: 'x' })).toBeNull()
    expect(saneBoss({ ...b, hp: 99 })?.hp).toBe(40)
  })
})
