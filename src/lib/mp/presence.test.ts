import { describe, expect, it } from 'vitest'
import { sanePlayer } from './core'
import { AWAY_MS, SILENT_MS, retained, visiblePlayers } from './presence'

const player = sanePlayer({ name: '친구', room: 'cafe', x: 3, z: 2, t: 1000, moving: true })!
describe('자리 보관', () => {
  it('끊겼거나 화면이 숨겨져도 열 분 동안 같은 위치에 남는다', () => {
    expect(visiblePlayers({ friend: player }, 1000 + SILENT_MS).friend).toMatchObject({ away: true, moving: false, x: 3, room: 'cafe' })
    expect(visiblePlayers({ friend: { ...player, away: true } }, 1001).friend.away).toBe(true)
    expect(retained(player, 1000 + AWAY_MS - 1)).toBe(true)
    expect(visiblePlayers({ friend: player }, 1000 + AWAY_MS)).toEqual({})
  })
  it('새 생존 신호를 받으면 자리 비움이 풀린다', () => {
    expect(visiblePlayers({ friend: { ...player, away: false, t: 50000 } }, 50001).friend.away).toBe(false)
  })
})
