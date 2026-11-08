/**
 * 멀티플레이어 세션(한 번에 한 방). 화면(UI)과 3D 장면이 같이 본다:
 * - UI: 같이 놀기 켜기/끄기, 닉네임, 채팅, 인원
 * - 3D: 내 위치 보내기(setPos), 다른 플레이어 그리기(state.players)
 * Firebase 는 들어갈 때 처음 불러온다(동적 import) → 멀티플레이어를 안 쓰면 앱 크기·동작이 그대로다.
 */
import { MAX_PLAYERS, STALE_MS, cleanChat, cleanName, shouldSend, type ChatMsg, type Look, type PlayerState, type Room } from './core'
import { firebaseReady, localTest } from './config'
import type { Transport } from './transport'

export type Status = 'off' | 'connecting' | 'on' | 'full' | 'error'
export interface MpState { status: Status; room: Room | null; uid: string | null; players: Record<string, PlayerState>; chat: ChatMsg[]; error: string | null }

const NAME_KEY = 'ryuso.mp.name'
export const savedName = () => { try { return cleanName(localStorage.getItem(NAME_KEY)) } catch { return '' } }

let state: MpState = { status: 'off', room: null, uid: null, players: {}, chat: [], error: null }
const listeners = new Set<() => void>()
const set = (p: Partial<MpState>) => { state = { ...state, ...p }; listeners.forEach((f) => f()) }
export const getMp = () => state
export const subscribeMp = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn))

let tr: Transport | null = null
let myName = ''
let lastSent: { x: number; z: number; dir: number; moving: boolean; at: number } | null = null
let pos = { x: 0, z: 0, dir: 1 as 1 | -1, moving: false }
let joinId = 0

export async function joinRoom(room: Room, name: string, look: Look) {
  leaveRoom()
  const id = ++joinId
  myName = cleanName(name) || '친구'
  try { localStorage.setItem(NAME_KEY, myName) } catch { /* 이번만 */ }
  set({ status: 'connecting', room, error: null, players: {}, chat: [] })
  try {
    const t: Transport = localTest && !firebaseReady
      ? (await import('./localTransport')).localTransport()
      : (await import('./firebaseTransport')).firebaseTransport()
    if (id !== joinId) return
    t.onPlayers((players) => {
      // 오래 소식 없는 플레이어(끊겼는데 정리가 늦은)는 뺀다
      const now = Date.now() + t.offset()
      set({ players: Object.fromEntries(Object.entries(players).filter(([, p]) => now - p.t < STALE_MS)) })
    })
    t.onChat((chat) => set({ chat }))
    const r = await t.join(room, { name: myName, ...pos, look })
    if (id !== joinId) { t.leave(); return }
    if (r.full) { set({ status: 'full', uid: r.uid }); return }
    tr = t
    lastSent = { ...pos, at: performance.now() }
    set({ status: 'on', uid: r.uid })
  } catch (e) {
    if (id === joinId) set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

export function leaveRoom() {
  joinId++
  tr?.leave()
  tr = null
  lastSent = null
  if (state.status !== 'off') set({ status: 'off', room: null, players: {}, chat: [], uid: null })
}

/** 3D 장면이 매 프레임 부른다: 보낼 때가 된 것만 보낸다 */
export function setPos(x: number, z: number, dir: 1 | -1, moving: boolean) {
  pos = { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, dir, moving }
  if (!tr) return
  const at = performance.now()
  if (!shouldSend(lastSent, pos, at)) return
  lastSent = { ...pos, at }
  tr.update(pos)
}
export function setLook(look: Look) { tr?.update({ look }) }
export function say(text: string) { const t = cleanChat(text); if (t && tr) tr.chat(myName, t) }
export const playerCount = () => Object.keys(state.players).length
export { MAX_PLAYERS }
