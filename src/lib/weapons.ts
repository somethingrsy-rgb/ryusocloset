/**
 * 마법봉·마법 검(산책·농장·카페 3D 가 같이 쓴다): 목록, 산 것, 지금 고른 것(이 기기에 저장).
 */
import { ITEMS } from './items'

/** 마법 풀기에 쓰는 것: 옷장의 마법봉 + 마법 검 다섯(손잡이를 아바타 손에 쥔다).
 *  처음엔 마법봉 하나·검 하나만 무료, 나머지는 「마법 상점」에서 코인으로 산다.
 *  종류마다 힘(한 번에 채우는 💖 수)과 마법 효과(날아가는 그림)가 다르다 */
export type Weapon = { id: string; name: string; img: string; sword: boolean; aspect: number; power: number; fx: string; skill: string; price: number }
const WAND_FX: [string, string][] = [['⭐', '별빛 마법'], ['💖', '하트 마법'], ['🌸', '꽃잎 마법'], ['❄️', '눈꽃 마법'], ['🌈', '무지개 마법'], ['🫧', '비눗방울 마법'], ['🍬', '사탕 마법'], ['🌙', '달빛 마법'], ['🦋', '나비 마법'], ['🎀', '리본 마법'], ['🍓', '딸기 마법'], ['💎', '보석 마법'], ['🌟', '반짝 마법']]
const SWORD_FX: Record<string, [string, string]> = { blue: ['✨', '반짝 베기'], green: ['🍃', '바람 베기'], red: ['🔥', '불꽃 베기'], aqua: ['💧', '물방울 베기'], violet: ['⚡', '번개 베기'] }
const SWORDS: Weapon[] = ([['blue', '파랑 별 검', 1081 / 1275], ['green', '초록 별 검', 1093 / 1270], ['red', '빨강 별 검', 1086 / 1277], ['aqua', '하늘빛 별 검', 1084 / 1276], ['violet', '보라 별 검', 1080 / 1272]] as const)
  .map(([c, name, aspect], k) => ({ id: `sword_${c}`, name, img: `travel/sword/${c}.webp`, sword: true, aspect, power: k ? 3 : 1, fx: SWORD_FX[c][0], skill: SWORD_FX[c][1], price: k ? 60 : 0 }))
export const WANDS: Weapon[] = [
  ...ITEMS.filter((i) => i.category === 'wand').map((i, k) => ({ id: i.id, name: i.name.ko, img: i.thumb, sword: false, aspect: 1, power: k ? 2 : 1, fx: k ? WAND_FX[(k - 1) % WAND_FX.length][0] : '✨', skill: k ? WAND_FX[(k - 1) % WAND_FX.length][1] : '반짝 마법', price: k ? 30 : 0 })),
  ...SWORDS,
]
export const WEAPON_BY_ID = Object.fromEntries(WANDS.map((x) => [x.id, x]))
const OWN_KEY = 'ryuso.walk.weapons'
export const loadOwned = (): string[] => { try { const v = JSON.parse(localStorage.getItem(OWN_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && WEAPON_BY_ID[x]) : [] } catch { return [] } }
export const ownedOf = (list: string[]) => new Set([...WANDS.filter((x) => x.price === 0).map((x) => x.id), ...list])

const subs = new Set<() => void>()
const tell = () => subs.forEach((f) => f())
export const subscribeWeapons = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
/** 산 것 하나 더(코인은 부르는 쪽에서 낸다) */
export function addOwned(id: string) {
  const next = [...loadOwned().filter((x) => x !== id), id]
  try { localStorage.setItem(OWN_KEY, JSON.stringify(next)) } catch { /* 이번만 */ }
  ownedCache = null
  tell()
}
let ownedCache: Set<string> | null = null
/** 가진 것(무료 + 산 것) */
export const getOwned = () => (ownedCache ??= ownedOf(loadOwned()))
const WAND_KEY = 'ryuso.walk.wand'
/** 지금 고른 마법봉·검(가진 것만). 처음엔 옷장에서 입은 마법봉, 없으면 첫 번째 */
let chosen: string | null = null
export function getWeapon(fallback?: string): string {
  if (chosen && getOwned().has(chosen)) return chosen
  let saved: string | null = null
  try { saved = localStorage.getItem(WAND_KEY) } catch { /* 없음 */ }
  chosen = saved && getOwned().has(saved) ? saved : fallback && getOwned().has(fallback) ? fallback : WANDS[0]?.id ?? ''
  return chosen
}
export function setWeapon(id: string) {
  if (!getOwned().has(id)) return
  chosen = id
  try { localStorage.setItem(WAND_KEY, id) } catch { /* 이번만 */ }
  tell()
}
/** 손에 든 마법봉·검 크기(예전 크기에 곱한다) */
export const WEAPON_SCALE = 0.6
