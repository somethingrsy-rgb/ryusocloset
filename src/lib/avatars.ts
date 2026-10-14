import { isRestoring } from './restoreGuard'

export interface Avatar {
  id: string
  name: { ko: string; en: string }
  /** public/assets 아래 베이스 레이어(body·body_barefoot·hair_front·thumb) 폴더 */
  dir: string
}

/** 고를 수 있는 아바타. 몸·발 위치는 모두 같아서 같은 옷이 맞는다 */
export const AVATARS: Avatar[] = [
  { id: 'ryuso', name: { ko: '류소', en: 'Ryuso' }, dir: 'assets/base' },
  { id: 'yuha', name: { ko: '유하', en: 'Yuha' }, dir: 'assets/base/yuha' },
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

/** 아바타의 베이스 레이어 파일 경로(assetUrl 을 거치기 전) */
export const baseFiles = (a: Avatar) => ({
  body: `${a.dir}/body.webp`,
  bodyBarefoot: `${a.dir}/body_barefoot.webp`,
  hairFront: `${a.dir}/hair_front.webp`,
  thumb: `${a.dir}/thumb.webp`,
})
