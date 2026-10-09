import { ID_ALIASES, ITEM_BY_ID } from './items'
import { CATEGORIES } from './layers'
import { sanitizeOutfit } from './outfit'
import { defaultCamp, sanitizeRoom } from './room'
import { sanitizeTweaks } from './tweaks'
import type { RoomState } from './roomTypes'
import type { Outfit, SavedOutfit, Tweaks } from './types'

export const MAX_SAVED = 30

const K_SAVED = 'ryuso.saved.v1'
const K_SETTINGS = 'ryuso.settings.v1'
const K_CURRENT = 'ryuso.current.v1'
const K_ROOM = 'ryuso.room.v1'
const K_CAMP = 'ryuso.camp.v1'
const K_TWEAKS = 'ryuso.tweaks.v1'

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** 용량 초과·사생활 보호 모드 등으로 실패하면 false */
function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadSaved(): SavedOutfit[] {
  const list = read<SavedOutfit[]>(K_SAVED)
  if (!Array.isArray(list)) return []
  return list
    .filter((s) => s && typeof s.id === 'string' && typeof s.thumb === 'string')
    .map((s) => {
      const outfit = sanitizeOutfit(s.outfit, ITEM_BY_ID, ID_ALIASES)
      return { ...s, outfit, tweaks: sanitizeTweaks(s.tweaks, CATEGORIES, outfit) }
    })
}
export const persistSaved = (list: SavedOutfit[]) => write(K_SAVED, list)

export interface Settings {
  lang: 'ko' | 'en'
  sound: boolean
  bgId: string | null
}
export const loadSettings = (): Partial<Settings> => read<Partial<Settings>>(K_SETTINGS) ?? {}
export const persistSettings = (s: Settings) => write(K_SETTINGS, s)

export const loadCurrent = (): Outfit => sanitizeOutfit(read<Outfit>(K_CURRENT), ITEM_BY_ID, ID_ALIASES)
export const persistCurrent = (o: Outfit) => write(K_CURRENT, o)

export const loadRoom = (): RoomState => sanitizeRoom(read<unknown>(K_ROOM))
export const persistRoom = (r: RoomState) => write(K_ROOM, r)

export const loadCamp = (): RoomState => sanitizeRoom(read<unknown>(K_CAMP), defaultCamp())
export const persistCamp = (r: RoomState) => write(K_CAMP, r)

export const loadTweaks = (outfit: Outfit): Tweaks => sanitizeTweaks(read<unknown>(K_TWEAKS), CATEGORIES, outfit)
export const persistTweaks = (t: Tweaks) => write(K_TWEAKS, t)
