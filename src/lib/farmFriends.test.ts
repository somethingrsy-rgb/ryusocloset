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
    // 두 친구가 구역을 나눠(한 줄 4칸: 왼쪽 0·1칸, 오른쪽 2·3칸) 자기 구역의 가까운 밭부터 맡는다
    expect(Object.keys(ff.getFriendJobs())).toHaveLength(2)
    expect(ff.getFriendJobs()[1].target).toBe(0)
    expect(ff.getFriendJobs()[4].target).toBe(2)
    vi.advanceTimersByTime(8000)
    expect(farm.getFarm().plots.slice(0, 3).every((p) => p?.wateredAt !== null)).toBe(true)
    expect(ff.getFriendJobs()).toEqual({})
  })
  it('다 자란 밭은 버튼을 누르지 않아도 친구들이 저절로 수확한다(물 주기와 같은 방식)', async () => {
    vi.useFakeTimers()
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } })
    vi.stubGlobal('window', globalThis)
    vi.resetModules()
    const farm = await import('./farm')
    const ff = await import('./farmFriends')
    expect(ff.harvestAll()).toBe(false) // 다 자란 밭이 없으면 아무 일도 안 한다
    ff.setFarmFriends([2, 6])
    for (const i of [0, 1, 2]) farm.actFarm({ type: 'plant', plot: i, crop: 'carrot' })
    vi.advanceTimersByTime(8000) // 친구들이 물을 다 준다
    expect(farm.getFarm().plots.slice(0, 3).every((p) => p !== null && p.wateredAt !== null)).toBe(true)
    vi.advanceTimersByTime(30000) // 당근이 다 자란다(30초): 아무것도 누르지 않는다
    vi.advanceTimersByTime(8000)
    expect(farm.getFarm().plots.slice(0, 3)).toEqual([null, null, null])
    expect(farm.getFarm().inventory.carrot).toBe(3)
    expect(ff.getFriendJobs()).toEqual({})
  })
  it('다른 줄로 갈 때는 지금 줄을 따라 옆으로 먼저 가고(작물 위를 가로지르지 않게), 걷는 시간은 거리만큼', async () => {
    vi.useFakeTimers()
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } })
    vi.stubGlobal('window', globalThis)
    vi.resetModules()
    const farm = await import('./farm')
    const ff = await import('./farmFriends')
    ff.setFarmCols(4)
    ff.setFarmFriends([5]) // 혼자면 밭 전체를 맡는다
    farm.actFarm({ type: 'plant', plot: 0, crop: 'carrot' })
    vi.advanceTimersByTime(3000) // 0번 밭 물 주기 끝(이제 0번 밭 앞에 서 있다)
    farm.actFarm({ type: 'plant', plot: 7, crop: 'carrot' }) // 1줄 3칸(0번에서 아래로 한 줄, 옆으로 세 칸)
    vi.advanceTimersByTime(600)
    const j1 = ff.getFriendJobs()[5]
    expect(j1.target).toBe(7)
    expect(j1.plot).toBe(3) // 먼저 지금 줄(0줄)의 3칸 앞으로
    expect(j1.walkMs).toBe(3 * ff.CELL_MS)
    vi.advanceTimersByTime(j1.walkMs)
    expect(ff.getFriendJobs()[5].plot).toBe(7) // 그다음 아래 줄로
    vi.advanceTimersByTime(3000)
    expect(farm.getFarm().plots[7]?.wateredAt).not.toBe(null)
  })
})
