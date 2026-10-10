import { PLACE_BY_ID } from './game'
import { defaultRoom, sanitizeRoom } from './room'
import type { RoomState } from './roomTypes'
import { isRestoring } from './restoreGuard'

export interface TravelRoom { scene: 'room' | 'camp'; room: RoomState }
const KEY = 'ryuso.travelRooms.v1'
const validPlace = (id: string) => Object.hasOwn(PLACE_BY_ID, id)
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
// Keep item references until custom furniture has been registered on startup.
function read(): Record<string, TravelRoom> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return Object.fromEntries(Object.entries(raw).filter(([id, value]) => {
      const v = value as TravelRoom | null
      return validPlace(id) && v && (v.scene === 'room' || v.scene === 'camp') && v.room && typeof v.room === 'object' && Array.isArray(v.room.items)
    })) as Record<string, TravelRoom>
  } catch { return {} }
}
let rooms = read()
let version = 0
const listeners = new Set<() => void>()
export const subscribeTravelRooms = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const travelRoomsVersion = () => version
export function getTravelRoom(id: string): TravelRoom | null {
  const saved = validPlace(id) ? rooms[id] : undefined
  return saved ? { scene: saved.scene, room: sanitizeRoom(clone(saved.room), { ...defaultRoom(), items: [] }) } : null
}
function persist(next: Record<string, TravelRoom>): boolean {
  if (isRestoring()) return false
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { return false }
  rooms = next
  version++
  listeners.forEach(fn => fn())
  return true
}
export function saveTravelRoom(id: string, scene: TravelRoom['scene'], room: RoomState): boolean {
  if (!validPlace(id) || (scene !== 'room' && scene !== 'camp')) return false
  return persist({ ...rooms, [id]: { scene, room: clone(sanitizeRoom(room, { ...defaultRoom(), items: [] })) } })
}
export function removeTravelRoom(id: string): boolean {
  if (!validPlace(id)) return false
  const next = { ...rooms }
  delete next[id]
  return persist(next)
}
