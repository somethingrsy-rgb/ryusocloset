import { AVATARS } from './avatars'
import { ID_ALIASES, ITEM_BY_ID } from './items'
import { sanitizeOutfit } from './outfit'
import { isRestoring } from './restoreGuard'
import type { Outfit } from './types'

/**
 * 파티에 초대한 다른 아바타가 입을 옷(아바타 id → 코디). 초대할 때 고르고, 다음에 초대할 때 그대로 다시 고를 수 있게 저장한다.
 */
const KEY = 'ryuso.guestLooks.v1'
export function sanitizeLooks(v: unknown): Record<string, Outfit> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return Object.fromEntries(AVATARS.filter((a) => a.id in (v as object)).map((a) => [a.id, sanitizeOutfit((v as Record<string, unknown>)[a.id], ITEM_BY_ID, ID_ALIASES)]))
}
let looks: Record<string, Outfit> = (() => { try { return sanitizeLooks(JSON.parse(localStorage.getItem(KEY) ?? 'null')) } catch { return {} } })()
let version = 0
const listeners = new Set<() => void>()
export const subscribeLooks = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn))
export const looksVersion = () => version
/** 이 아바타가 파티에서 입는 옷(아직 안 골랐으면 아무것도 안 입은 기본 옷) */
export const guestLook = (avatarId: string): Outfit => looks[avatarId] ?? {}
export function setGuestLooks(next: Record<string, Outfit>) {
  looks = sanitizeLooks({ ...looks, ...next })
  version++
  if (!isRestoring()) {
    try { localStorage.setItem(KEY, JSON.stringify(looks)) } catch { /* 저장 못 해도 이번 접속에서는 입고 있다 */ }
  }
  listeners.forEach((fn) => fn())
}
