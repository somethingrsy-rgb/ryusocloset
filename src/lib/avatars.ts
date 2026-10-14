import { isRestoring } from './restoreGuard'

export interface Hairstyle {
  id: string
  name: { ko: string; en: string }
  /** dir 안의 머리 레이어 파일 (옷 위에 얹는다) */
  file: string
}

export interface Avatar {
  id: string
  name: { ko: string; en: string }
  /** public/assets 아래 베이스 레이어(body·body_barefoot·머리 레이어) 폴더 */
  dir: string
  /** 헤어숍에서 고를 수 있는 머리. 첫 번째가 기본 */
  hairstyles: Hairstyle[]
}

/** 고를 수 있는 아바타. 몸·발 위치는 모두 같아서 같은 옷이 맞는다 */
export const AVATARS: Avatar[] = [
  {
    id: 'ryuso', name: { ko: '류소', en: 'Ryuso' }, dir: 'assets/base',
    hairstyles: [{ id: 'bob', name: { ko: '단발', en: 'Bob' }, file: 'hair_front.webp' }],
  },
  {
    id: 'soyoung', name: { ko: '소영', en: 'Soyoung' }, dir: 'assets/base/soyoung',
    hairstyles: [{ id: 'bob', name: { ko: '단발', en: 'Bob' }, file: 'hair_front.webp' }],
  },
  {
    id: 'yuha', name: { ko: '유하', en: 'Yuha' }, dir: 'assets/base/yuha',
    hairstyles: [
      { id: 'braid', name: { ko: '땋은 올림머리', en: 'Braided updo' }, file: 'hair_braid.webp' },
      { id: 'twin', name: { ko: '양갈래', en: 'Pigtails' }, file: 'hair_twin.webp' },
    ],
  },
]

const KEY = 'ryuso.avatar.v1'
const byId = (id: unknown) => AVATARS.find((a) => a.id === id)

function read(): string {
  try {
    return byId(localStorage.getItem(KEY))?.id ?? AVATARS[0].id
  } catch {
    return AVATARS[0].id
  }
}

let current = read()
let version = 0
const listeners = new Set<() => void>()

export const subscribeAvatar = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn))
export const avatarVersion = () => version
export const getAvatar = (): Avatar => byId(current) ?? AVATARS[0]

export function setAvatar(id: string) {
  if (!byId(id) || id === current) return
  current = id
  version++
  if (!isRestoring()) {
    try {
      localStorage.setItem(KEY, id)
    } catch {
      /* 저장 공간이 없으면 이번 접속에서만 유지된다 */
    }
  }
  listeners.forEach((fn) => fn())
}

const HAIR_KEY = 'ryuso.hair.v1'
function readHair(): Record<string, string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(HAIR_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([k, v]) => typeof v === 'string' && !!byId(k)?.hairstyles.some((h) => h.id === v))) as Record<string, string>
  } catch {
    return {}
  }
}
let hair = readHair()

/** 이 아바타가 지금 하고 있는 머리 (안 골랐거나 없어진 머리면 기본) */
export const getHairstyle = (a: Avatar): Hairstyle => a.hairstyles.find((h) => h.id === hair[a.id]) ?? a.hairstyles[0]

export function setHairstyle(a: Avatar, styleId: string) {
  if (!a.hairstyles.some((h) => h.id === styleId) || getHairstyle(a).id === styleId) return
  hair = { ...hair, [a.id]: styleId }
  version++
  if (!isRestoring()) {
    try {
      localStorage.setItem(HAIR_KEY, JSON.stringify(hair))
    } catch {
      /* 저장 공간이 없으면 이번 접속에서만 유지된다 */
    }
  }
  listeners.forEach((fn) => fn())
}

/** 아바타의 베이스 레이어 파일 경로(assetUrl 을 거치기 전). 머리는 지금 고른 머리 */
export const baseFiles = (a: Avatar, style: Hairstyle = getHairstyle(a)) => ({
  body: `${a.dir}/body.webp`,
  bodyBarefoot: `${a.dir}/body_barefoot.webp`,
  hairFront: `${a.dir}/${style.file}`,
})
