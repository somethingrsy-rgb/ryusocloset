import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transport } from './transport'
import type { PlayerState } from './core'

const mock = vi.hoisted(() => ({ transport: null as Transport | null }))
vi.mock('./config', () => ({ firebaseReady: true, localTest: false }))
vi.mock('./firebaseTransport', () => ({ firebaseTransport: () => mock.transport }))

describe('휴대폰 잠금과 자동 복귀', () => {
  let doc: EventTarget & { hidden: boolean }
  let connected: (value: boolean) => void
  let players: (value: Record<string, PlayerState>) => void
  let session: typeof import('./session')
  const look = { avatar: 'a', outfit: {} }
  beforeEach(async () => {
    vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(100000)
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) })
    doc = Object.assign(new EventTarget(), { hidden: false })
    vi.stubGlobal('document', doc)
    vi.stubGlobal('window', Object.assign(new EventTarget(), { setInterval, clearInterval, setTimeout, clearTimeout }))
    mock.transport = {
      join: vi.fn(async () => ({ uid: 'me', full: false })), leave: vi.fn(), update: vi.fn(), setAway: vi.fn(),
      onExpired: vi.fn(), onConnection: cb => { connected = cb }, onPlayers: cb => { players = cb },
      onChat: vi.fn(), onBosses: vi.fn(), chat: vi.fn(), offset: () => 0,
      hitBoss: vi.fn(), spawnBoss: vi.fn(), openHome: vi.fn(), closeHome: vi.fn(),
      watchHome: vi.fn(() => () => {}), addFood: vi.fn(), eatFood: vi.fn(),
    }
    session = await import('./session')
    await session.joinMp('류소', look)
  })
  afterEach(() => { session.leaveMp(); vi.useRealTimers(); vi.unstubAllGlobals() })
  it('잠기면 나가지 않고 heartbeat를 멈추며 같은 세션으로 복귀한다', () => {
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
    expect(mock.transport!.setAway).toHaveBeenLastCalledWith(true)
    vi.advanceTimersByTime(60000)
    expect(mock.transport!.update).not.toHaveBeenCalled()
    expect(mock.transport!.leave).not.toHaveBeenCalled()
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'))
    expect(mock.transport!.setAway).toHaveBeenLastCalledWith(false)
    expect(mock.transport!.join).toHaveBeenCalledTimes(1)
  })
  it('옷장에서도 heartbeat를 보내고 연결이 끊기면 보내지 않는다', () => {
    vi.advanceTimersByTime(5000)
    expect(mock.transport!.update).toHaveBeenCalledWith({})
    vi.mocked(mock.transport!.update).mockClear(); connected(false)
    vi.advanceTimersByTime(20000)
    expect(mock.transport!.update).not.toHaveBeenCalled()
  })
  it('새 데이터가 없어도 친구의 자리 비움·만료를 갱신한다', () => {
    players({ friend: { name: '친구', room: 'farm', x: 0, z: 0, dir: 1, moving: true, look, t: Date.now() } })
    vi.advanceTimersByTime(15000)
    expect(session.getMp().players.friend.away).toBe(true)
    vi.advanceTimersByTime(585000)
    expect(session.getMp().players.friend).toBeUndefined()
  })
  it('열 분 넘게 잠겼으면 재접속 대신 퇴장하고 저장 기록도 지운다', () => {
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(600000)
    expect(session.getMp().status).toBe('expired')
    expect(mock.transport!.leave).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('ryuso.mp.resume')).toBeNull()
  })
  it('직접 나간 뒤에는 화면을 켜도 자동으로 들어가지 않는다', () => {
    session.leaveMp()
    doc.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(600000)
    expect(session.getMp().status).toBe('off')
    expect(mock.transport!.join).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('ryuso.mp.resume')).toBeNull()
  })
})
