import { BODY_OVER_HAIR_Z, HAIR_BEHIND_Z, HAIR_FRONT_Z, HAIR_UNDER_BODY_Z } from './layers'
import { isRestoring } from './restoreGuard'

export interface Hairstyle {
  id: string
  name: { ko: string; en: string }
  /** dir 안의 머리 레이어 파일 (옷 위에 얹는다) */
  file: string
  /** 이 머리일 때 쓰는 몸 파일 이름(dir 안, 확장자·_barefoot 뺀 것). 없으면 body. 기본 머리가 몸에 그려져 있는 아바타가 다른 머리를 쓸 때 */
  body?: string
  /** true 면 머리를 옷 뒤(몸 바로 위)에 그린다. 옷 위로 내려오는 긴 머리용 */
  behind?: boolean
  /** true 면 머리 전체를 몸 '뒤'에 그린다(몸이 머리 위). 이때 body 파일은 머리 쪽을 얼굴·귀·목만 남긴 것 */
  under?: boolean
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
    hairstyles: [
      { id: 'bob', name: { ko: '단발', en: 'Bob' }, file: 'hair_front.webp' },
      { id: 'wig', name: { ko: '레이어드 긴 머리', en: 'Layered long hair' }, file: 'hair_wig.webp', body: 'body_bald', behind: true },
      { id: 'tails', name: { ko: '웨이브 양갈래', en: 'Wavy pigtails' }, file: 'hair_tails.webp', body: 'body_bald', behind: true },
      { id: 'braidwave', name: { ko: '땋은 왕관 웨이브', en: 'Crown braid waves' }, file: 'hair_braid.webp', body: 'body_braid', behind: true, under: true },
    ],
  },
  {
    id: 'soyoung', name: { ko: '소영', en: 'Soyoung' }, dir: 'assets/base/soyoung',
    hairstyles: [{ id: 'bob', name: { ko: '단발', en: 'Bob' }, file: 'hair_front.webp' }],
  },
  {
    id: 'yuha', name: { ko: '유하', en: 'Yuha' }, dir: 'assets/base/yuha',
    hairstyles: [
      { id: 'twin', name: { ko: '양갈래', en: 'Pigtails' }, file: 'hair_twin.webp' },
      { id: 'braid', name: { ko: '땋은 올림머리', en: 'Braided updo' }, file: 'hair_braid.webp' },
      { id: 'crownbraid', name: { ko: '왕관 땋은머리', en: 'Crown braid' }, file: 'hair_crownbraid.webp' },
      { id: 'crownbuns', name: { ko: '왕관 땋은머리 + 양쪽 번', en: 'Crown braid with buns' }, file: 'hair_crownbuns.webp' },
    ],
  },
  {
    id: 'yuel', name: { ko: '유엘', en: 'Yuel' }, dir: 'assets/base/yuel',
    hairstyles: [{ id: 'short', name: { ko: '짧은 머리', en: 'Short hair' }, file: 'hair_front.webp' }],
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

/** 지금 머리가 그려지는 높이: 옷 뒤로 가는 머리면 몸 바로 위, 아니면 앞머리 높이 */
export const hairZ = (a: Avatar = getAvatar()) => { const h = getHairstyle(a); return h.under ? HAIR_UNDER_BODY_Z : h.behind ? HAIR_BEHIND_Z : HAIR_FRONT_Z }
/** 몸이 그려지는 높이: 머리 전체가 몸 뒤로 가면 머리 위(2), 아니면 맨 아래(0) */
export const bodyZ = (a: Avatar = getAvatar()) => (getHairstyle(a).under ? BODY_OVER_HAIR_Z : 0)

/** 아바타의 베이스 레이어 파일 경로(assetUrl 을 거치기 전). 머리는 지금 고른 머리 */
export const baseFiles = (a: Avatar, style: Hairstyle = getHairstyle(a)) => ({
  body: `${a.dir}/${style.body ?? 'body'}.webp`,
  bodyBarefoot: `${a.dir}/${style.body ?? 'body'}_barefoot.webp`,
  hairFront: `${a.dir}/${style.file}`,
})
