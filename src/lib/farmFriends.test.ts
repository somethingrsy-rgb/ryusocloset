import { afterEach, describe, expect, it, vi } from 'vitest'
import { sanitizeFriends } from './farmFriends'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('농장 친구', () => {
  it('친구 번호는 겹치거나 없는 친구를 빼고 2명까지', () => {
    expect(sanitizeFriends([3, 3, 9, -1, 1.5, 0, 5])).toEqual([3, 0])
    expect(sanitizeFriends('x')).toEqual([])
  })
  it('친구가 있으면 물이 필요한 밭에 저절로 가서 물을 준다(화면이 없어도: 다른 탭에 가 있어도 끝까지)', async () => {
    vi.useFakeTimers()
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } })
    vi.stubGlobal('window', globalThis)
    vi.resetModules()
    const farm = await import('./farm')
    const ff = await import('./farmFriends')
    for (const i of [0, 1, 2]) farm.actFarm({ type: 'plant', plot: i, crop: 'carrot' })
    vi.advanceTimersByTime(3000)
    // 친구가 없으면 아무도 물을 주지 않는다
    expect(farm.getFarm().plots.slice(0, 3).every((p) => p?.wateredAt === null)).toBe(true)
    ff.setFarmFriends([1, 4])
    vi.advanceTimersByTime(600)
    // 두 친구가 두 밭을 맡아 걸어간다
    expect(Object.keys(ff.getFriendJobs())).toHaveLength(2)
    expect(ff.claimed(0) && ff.claimed(1)).toBe(true)
    vi.advanceTimersByTime(8000)
    expect(farm.getFarm().plots.slice(0, 3).every((p) => p?.wateredAt !== null)).toBe(true)
    expect(ff.getFriendJobs()).toEqual({})
  })
})
