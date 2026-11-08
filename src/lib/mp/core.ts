/**
 * 멀티플레이어 공통 규칙(Firebase·three 와 상관없는 순수 함수). 테스트하기 쉽게 따로 둔다.
 * 같은 3D 공간(방)에 최대 10명, 위치는 짧게 끊어서(최대 초당 8번, 움직였을 때만) 보내고 받는 쪽은 부드럽게 따라간다.
 */
export const ROOMS = ['cafe', 'farm', 'walk'] as const
export type Room = (typeof ROOMS)[number]
export const MAX_PLAYERS = 10
export const MAX_NAME = 12
export const MAX_CHAT = 80
/** 위치를 보내는 가장 짧은 간격(ms) */
export const SEND_MS = 125
/** 멈춰 있어도 이 간격마다 한 번(살아 있다는 표시) */
export const KEEPALIVE_MS = 5000
/** 이 시간 동안 소식이 없는 플레이어는 화면에서 뺀다(접속이 끊겼는데 정리가 늦을 때) */
export const STALE_MS = 15000

export interface Look { avatar: string; outfit: Record<string, string> }
export interface PlayerState { name: string; x: number; z: number; dir: 1 | -1; moving: boolean; look: Look; t: number }
export interface ChatMsg { id: string; uid: string; name: string; text: string; t: number }

export const cleanName = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) : '')
export const cleanChat = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT) : '')

/** 받은 플레이어 데이터가 쓸 만한지(이상한 값은 버린다) */
export function sanePlayer(v: unknown): PlayerState | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
  if (!num(r.x) || !num(r.z) || !num(r.t)) return null
  const look = (r.look ?? {}) as Record<string, unknown>
  const outfit: Record<string, string> = {}
  if (look.outfit && typeof look.outfit === 'object') for (const [k, id] of Object.entries(look.outfit as Record<string, unknown>)) if (typeof id === 'string' && k.length < 24 && id.length < 80) outfit[k] = id
  return {
    name: cleanName(r.name) || '친구',
    x: Math.max(-200, Math.min(200, r.x as number)), z: Math.max(-200, Math.min(200, r.z as number)),
    dir: r.dir === -1 ? -1 : 1, moving: r.moving === true,
    look: { avatar: typeof look.avatar === 'string' ? look.avatar.slice(0, 40) : '', outfit },
    t: r.t as number,
  }
}

/** 지금 위치를 보내야 하는지: 너무 자주는 안 보내고, 움직였거나 방향·멈춤이 바뀌었을 때(또는 오래되면 한 번) */
export function shouldSend(last: { x: number; z: number; dir: number; moving: boolean; at: number } | null, now: { x: number; z: number; dir: number; moving: boolean }, at: number) {
  if (!last) return true
  if (at - last.at < SEND_MS) return false
  if (at - last.at >= KEEPALIVE_MS) return true
  return Math.hypot(now.x - last.x, now.z - last.z) > 0.05 || now.dir !== last.dir || now.moving !== last.moving
}

/** 부드럽게 따라가기: 한 프레임(dt 초)에 목표 쪽으로 다가가는 비율(프레임 빠르기와 상관없이 같은 느낌) */
export const follow = (dt: number, rate = 10) => 1 - Math.exp(-rate * dt)
