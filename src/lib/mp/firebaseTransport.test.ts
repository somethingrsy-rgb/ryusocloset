import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  data: {} as Record<string, any>, listeners: {} as Record<string, (snapshot: any) => void>,
  disconnect: { update: vi.fn(async () => {}), cancel: vi.fn(async () => {}) },
  writes: [] as { path: string; value: any }[],
}))
vi.mock('./firebase', () => ({ connect: async () => ({ user: { uid: 'me' }, db: {} }) }))
vi.mock('firebase/database', () => {
  const snapshot = (value: any) => ({ val: () => value, forEach: (cb: (s: any) => void) => Object.entries(value ?? {}).forEach(([key, v]) => cb({ key, val: () => v })) })
  const read = (path: string): any => path === 'lobby/players' ? Object.fromEntries(Object.entries(db.data).filter(([k]) => k.startsWith('lobby/players/')).map(([k, v]) => [k.split('/').at(-1)!, v])) : db.data[path]
  return {
    ref: (_d: unknown, path: string) => ({ path, key: path.split('/').at(-1) }),
    child: (r: any, key: string) => ({ path: r.path + '/' + key, key }),
    // 실제 Firebase 처럼 .info 경로는 get() 으로 읽을 수 없다
    get: async (r: any) => { if (r.path.startsWith('.info')) throw new Error('Invalid token in path'); return snapshot(read(r.path)) },
    set: async (r: any, value: any) => { db.data[r.path] = value; db.writes.push({ path: r.path, value }) },
    update: async (r: any, part: any) => { db.data[r.path] = { ...db.data[r.path], ...part }; db.writes.push({ path: r.path, value: part }) },
    remove: async (r: any) => { delete db.data[r.path] },
    onDisconnect: () => db.disconnect,
    onValue: (r: any, cb: (s: any) => void) => { db.listeners[r.path] = cb; if (r.path === '.info/serverTimeOffset') cb(snapshot(0)); return () => { delete db.listeners[r.path] } },
    serverTimestamp: () => Date.now(), limitToLast: () => ({}), query: (r: any) => r, push: vi.fn(async () => {}),
    // 실제 Firebase 처럼: 가진 값이 없으면 처음엔 null 로 부르고, 그 답이 서버 값과 안 맞으면 서버 값으로 다시 부른다
    runTransaction: async (r: any, fn: (v: any) => any) => {
      const actual = read(r.path)
      let value = fn(null)
      if (value !== undefined && actual != null) value = fn(actual)
      if (value !== undefined) { if (value === null) delete db.data[r.path]; else db.data[r.path] = value }
      return { committed: value !== undefined, snapshot: { ...snapshot(value), exists: () => value != null } }
    },
  }
})
import { firebaseTransport } from './firebaseTransport'

const player = { name: '친구', room: 'cafe' as const, x: 1, z: 2, dir: 1 as const, moving: true, look: { avatar: 'a', outfit: {} } }
describe('Firebase 자리 보관', () => {
  beforeEach(() => { db.data = {}; db.listeners = {}; db.writes = []; vi.clearAllMocks() })
  it('disconnect only marks away; hidden updates do not renew the heartbeat or delete a home', async () => {
    const t = firebaseTransport(); await t.join(player)
    expect(db.disconnect.update).toHaveBeenCalledWith({ away: true, moving: false })
    const stamp = db.data['lobby/players/me'].t
    t.setAway(true); t.update({ x: 9 })
    expect(db.data['lobby/players/me']).toMatchObject({ away: true, t: stamp, x: 1 })
    t.openHome({ name: '친구', room: { scene: 'place', place: 'home' } })
    expect(db.data['lobby/homes/me']).toBeTruthy()
  })
  it('reconnect cannot resurrect an expired or removed participant', async () => {
    const t = firebaseTransport(), expired = vi.fn(); t.onExpired(expired); await t.join(player)
    db.data['lobby/players/me'].t = Date.now() - 600000
    t.setAway(false)
    await vi.waitFor(() => expect(expired).toHaveBeenCalledOnce())
    expect(db.data['lobby/players/me'].t).toBeLessThanOrEqual(Date.now() - 600000)
  })
  it('fresh page resume validates both authenticated identity and reservation', async () => {
    const t = firebaseTransport()
    expect(await t.join(player, 'another-user')).toMatchObject({ expired: true })
    expect(db.writes).toEqual([])
    expect(await t.join(player, 'me')).toMatchObject({ expired: true })
  })
  it('직접 나가면 내 참가 기록을 지운다', async () => {
    const t = firebaseTransport(); await t.join(player)
    expect(db.data['lobby/players/me']).toBeTruthy()
    t.leave()
    await vi.waitFor(() => expect(db.data['lobby/players/me']).toBeUndefined())
  })
  it('resumes the stored room and does not let an old tab remove a new session', async () => {
    db.data['lobby/players/me'] = { ...player, room: 'farm', t: Date.now(), session: 'old', away: true }
    const t = firebaseTransport()
    expect(await t.join(player, 'me')).toMatchObject({ player: { room: 'farm' } })
    expect(db.data['lobby/players/me']).toMatchObject({ room: 'farm', away: false })
    db.data['lobby/players/me'].session = 'new-tab'
    t.leave()
    expect(db.data['lobby/players/me'].session).toBe('new-tab')
  })
})
