import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => vi.unstubAllGlobals())
async function setup(saved = '{}') {
  const values = new Map([['ryuso.travelRooms.v1', saved]])
  const setItem = vi.fn((key: string, value: string) => { values.set(key, value) })
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem })
  vi.resetModules()
  return { rooms: await import('./travelRooms'), room: (await import('./room')).defaultRoom(), values, setItem }
}
it('copies layouts independently, persists across reloads and restores only one place', async () => {
  const { rooms, room } = await setup()
  room.avatar.flip = true
  room.items[0].zb = 100
  expect(rooms.saveTravelRoom('spring', 'room', room)).toBe(true)
  expect(rooms.saveTravelRoom('camp', 'camp', room)).toBe(true)
  room.items.length = 0
  expect(rooms.getTravelRoom('spring')?.room.items.length).toBeGreaterThan(0)
  expect(rooms.getTravelRoom('spring')?.room.avatar.flip).toBe(true)
  expect(rooms.getTravelRoom('spring')?.room.items[0].zb).toBe(100)
  vi.resetModules()
  const reload = await import('./travelRooms')
  expect(reload.getTravelRoom('spring')?.room.items.length).toBeGreaterThan(0)
  expect(reload.removeTravelRoom('spring')).toBe(true)
  expect(reload.getTravelRoom('spring')).toBeNull()
  expect(reload.getTravelRoom('camp')?.scene).toBe('camp')
})
it('rejects invalid places, malformed saves and failed writes without changing saved rooms', async () => {
  const { rooms, room, setItem } = await setup('{"spring":null,"camp":{"scene":"invalid"},"toString":{}}')
  expect(rooms.getTravelRoom('spring')).toBeNull()
  expect(rooms.saveTravelRoom('toString', 'room', room)).toBe(false)
  rooms.saveTravelRoom('spring', 'room', room)
  setItem.mockImplementation(() => { throw new Error('quota') })
  expect(rooms.removeTravelRoom('spring')).toBe(false)
  expect(rooms.getTravelRoom('spring')).not.toBeNull()
})
it('blocks changes during backup restore', async () => {
  const { rooms, room } = await setup()
  const guard = await import('./restoreGuard')
  guard.beginRestore()
  expect(rooms.saveTravelRoom('spring', 'room', room)).toBe(false)
  guard.endRestore()
  expect(rooms.saveTravelRoom('spring', 'room', room)).toBe(true)
})
