/**
 * 멀티플레이어 공통 규칙(Firebase·three 와 상관없는 순수 함수). 테스트하기 쉽게 따로 둔다.
 * 같은 3D 공간(방)에 최대 10명, 위치는 짧게 끊어서(최대 초당 8번, 움직였을 때만) 보내고 받는 쪽은 부드럽게 따라간다.
 */
export const ROOMS = ['cafe', 'farm', 'walk'] as const
export type Room = (typeof ROOMS)[number]
/** 플레이어가 지금 있는 곳: 3D 카페·농장·산책, 누구네 집(home, host 가 그 집 주인), 그 밖의 화면이면 'none'(채팅만) */
export type Where = Room | 'home' | 'none'
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
export interface PlayerState { away?: boolean; session?: string; name: string; room: Where; /** room 이 home 일 때 그 집 주인 uid */ host?: string; /** 지금 먹고 있는 음식(메뉴 id) */ eat?: string; x: number; z: number; dir: 1 | -1; moving: boolean; look: Look; t: number }
export interface ChatMsg { call?: string; id: string; uid: string; name: string; text: string; t: number; /** 집 초대면 그 집 주인 uid(= 보낸 사람) */ home?: string }

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
    room: r.room === 'home' && typeof r.host === 'string' && r.host ? 'home' : (ROOMS as readonly string[]).includes(r.room as string) ? (r.room as Room) : 'none',
    ...(r.room === 'home' && typeof r.host === 'string' && r.host ? { host: r.host.slice(0, 64) } : {}),
    ...(typeof r.eat === 'string' && r.eat ? { eat: r.eat.slice(0, 40) } : {}),
    x: Math.max(-200, Math.min(200, r.x as number)), z: Math.max(-200, Math.min(200, r.z as number)),
    dir: r.dir === -1 ? -1 : 1, moving: r.moving === true,
    look: { avatar: typeof look.avatar === 'string' ? look.avatar.slice(0, 40) : '', outfit },
    t: r.t as number,
    ...(typeof r.away === 'boolean' ? { away: r.away } : {}),
    ...(typeof r.session === 'string' ? { session: r.session } : {}),
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

/** 같이 사냥하는 대왕 몬스터(산책): 같이 놀기에 들어온 모두가 같은 하나를 본다. hp 가 0 이 되면 마법이 풀린 것 */
export interface Boss { id: string; type: number; x: number; z: number; hp: number; max: number; t: number }
/** 대왕 몬스터 💖 수, 한 번에 깎을 수 있는 가장 큰 힘(검 3) */
export const BOSS_MAX = 40
export const BOSS_POWER = 3
/** 마법이 풀리고 이만큼 지나면 새 대왕 몬스터가 나온다(ms, 규칙은 8초) */
export const BOSS_RESPAWN_MS = 10000

export function saneBoss(v: unknown): Boss | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
  if (typeof r.id !== 'string' || !num(r.type) || !num(r.x) || !num(r.z) || !num(r.hp) || !num(r.max) || !num(r.t)) return null
  const max = Math.max(1, Math.min(60, r.max as number))
  return { id: r.id.slice(0, 24), type: Math.max(0, Math.floor(r.type as number)), x: r.x as number, z: r.z as number, hp: Math.max(0, Math.min(max, r.hp as number)), max, t: r.t as number }
}
/** 마법 한 번(power 만큼 💖 채우기 = hp 깎기). 다른 몬스터거나 이미 풀렸으면 null */
export function bossHit(b: Boss | null, id: string, power: number): Boss | null {
  if (!b || b.id !== id || b.hp <= 0) return null
  return { ...b, hp: Math.max(0, b.hp - Math.max(1, Math.min(BOSS_POWER, Math.floor(power)))) }
}
/** 새 대왕 몬스터를 내도 되는지: 아직 없거나, 풀리고 조금 지났을 때 */
export const bossCanRespawn = (b: Boss | null, now: number) => !b || (b.hp <= 0 && now - b.t > BOSS_RESPAWN_MS)

/** 집 놀이: 바닥에 놓인 음식 하나(x·y 는 방 무대에 대한 %) */
export interface Food { id: string; menu: string; x: number; y: number; by: string; t: number }
/** 한 집에 한꺼번에 놓을 수 있는 음식 수 */
export const MAX_FOOD = 12
export function saneFood(id: string, v: unknown): Food | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n)
  if (typeof r.menu !== 'string' || !num(r.x) || !num(r.y)) return null
  return { id, menu: r.menu.slice(0, 40), x: Math.max(0, Math.min(100, r.x as number)), y: Math.max(0, Math.min(100, r.y as number)), by: typeof r.by === 'string' ? r.by.slice(0, 12) : '친구', t: num(r.t) ? (r.t as number) : 0 }
}
/** 친구에게 보여 주는 집: 주인 이름과 방 꾸밈(RoomState 그대로, 받는 쪽에서 다시 검사한다) */
export interface Home { name: string; room: unknown; t: number }
