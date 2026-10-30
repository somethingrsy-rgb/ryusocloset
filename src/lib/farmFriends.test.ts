import { afterEach, describe, expect, it, vi } from 'vitest'
import { sanitizeFriends } from './farmFriends'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('농장 친구', () => {
  it('친구 번호는 겹치거나 없는 친구를 빼고 2명까지', () => {
    expect(sanitizeFriends([3, 3, 9, -1, 1.5, 0, 5])).toEqual([3, 0])
    expect(sanitizeFriends('x')).toEqual([])
    // 아바타 친구(AVATAR_GUEST + 아바타 순서)도 고를 수 있다
    expect(sanitizeFriends([22, 2, 99])).toEqual([22, 2])
  })
  it('친구가 있으면 물이 필요한 밭에 저절로 가서 물을 준다(화면이 없어도: 다른 탭에 가 있어도 끝까지)', async () => {
    vi.useFakeTimers()
    const values = new Map<string, string>()
    values.set('ryuso.meet.v1', JSON.stringify({ met: [0, 1, 2, 3, 4, 5, 6, 7], last: 0, solved: 0 })) // 친구를 다 모은 상태(모은 친구만 같이 한다)
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
  it('수확은 수확 버튼을 눌렀을 때만, 친구마다 자기 길을 따라 엇박자로 한다', async () => {
    vi.useFakeTimers()
    const values = new Map<string, string>()
    values.set('ryuso.meet.v1', JSON.stringify({ met: [0, 1, 2, 3, 4, 5, 6, 7], last: 0, solved: 0 }))
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } })
    vi.stubGlobal('window', globalThis)
    vi.resetModules()
    const farm = await import('./farm')
    const ff = await import('./farmFriends')
    ff.setFarmCols(4)
    expect(ff.harvestAll()).toBe(false) // 다 자란 밭이 없으면 아무 일도 안 한다
    ff.setFarmFriends([2, 6])
    for (const i of [0, 1, 2, 3]) farm.actFarm({ type: 'plant', plot: i, crop: 'carrot' })
    vi.advanceTimersByTime(8000) // 친구들이 물을 다 준다
    vi.advanceTimersByTime(40000) // 당근이 다 자란다(30초)
    expect(farm.getFarm().plots.slice(0, 4).every((p) => p !== null)).toBe(true) // 버튼을 누르기 전에는 수확하지 않는다
    expect(ff.harvestAll()).toBe(true)
    // 1번 친구는 바로, 2번 친구는 반 박자 늦게 출발한다(같이 움직이지 않게)
    expect(Object.keys(ff.getFriendJobs())).toEqual(['2'])
    vi.advanceTimersByTime(600)
    expect(Object.keys(ff.getFriendJobs()).sort()).toEqual(['2', '6'])
    vi.advanceTimersByTime(15000)
    expect(farm.getFarm().plots.slice(0, 4)).toEqual([null, null, null, null])
    expect(farm.getFarm().inventory.carrot).toBe(4)
    expect(ff.getFriendJobs()).toEqual({})
  })
  it('수확 길: 1번은 왼쪽 바깥 길로 아래→위, 가운데 길로 위→아래 / 2번은 가운데 길로 위→아래, 줄 사이 길로 아래→위', async () => {
    const { harvestPath } = await import('./farmFriends')
    // 세로 그림: 한 줄 4칸, 5줄(0~19번 밭)
    expect(harvestPath(0, 4, 5, 2)).toEqual([
      ...[16, 12, 8, 4, 0].map((plot) => ({ plot, side: 'left' })),
      ...[1, 5, 9, 13, 17].map((plot) => ({ plot, side: 'right' })),
    ])
    expect(harvestPath(1, 4, 5, 2)).toEqual([
      ...[2, 6, 10, 14, 18].map((plot) => ({ plot, side: 'left' })),
      ...[19, 15, 11, 7, 3].map((plot) => ({ plot, side: 'left' })),
    ])
  })
  it('다른 줄로 갈 때는 지금 줄을 따라 옆으로 먼저 가고(작물 위를 가로지르지 않게), 걷는 시간은 거리만큼', async () => {
    vi.useFakeTimers()
    const values = new Map<string, string>()
    values.set('ryuso.meet.v1', JSON.stringify({ met: [0, 1, 2, 3, 4, 5, 6, 7], last: 0, solved: 0 })) // 친구를 다 모은 상태(모은 친구만 같이 한다)
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
  it('수학으로 모으지 않은 친구는 골라 두어도 같이 하지 않는다', async () => {
    vi.useFakeTimers()
    const values = new Map<string, string>()
    values.set('ryuso.meet.v1', JSON.stringify({ met: [4], last: 0, solved: 0 }))
    vi.stubGlobal('localStorage', { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v) } })
    vi.stubGlobal('window', globalThis)
    vi.resetModules()
    const ff = await import('./farmFriends')
    ff.setFarmFriends([1, 4])
    expect(ff.getFarmFriends()).toEqual([4])
  })
})
