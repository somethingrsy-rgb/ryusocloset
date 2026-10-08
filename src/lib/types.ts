import type { Category } from './layers'

export interface Item {
  id: string
  category: Category
  name: { ko: string; en: string }
  color: string | null
  colorName: { ko: string; en: string } | null
  colorHex: string | null
  /** 알파가 있는 영역의 경계 상자(캔버스 px) — 크기 조절의 기준점(중심)으로 쓴다 */
  box: { x: number; y: number; w: number; h: number }
  /** public/ 기준 상대 경로 */
  image: string
  thumb: string
  zIndex: number
}

/** 카테고리 → 착용 중인 아이템 id */
export type Outfit = Partial<Record<Category, string>>

/** 옷 하나의 위치·크기 조절값 (캔버스 px 단위 이동, 배율). 기준점은 옷 영역의 중심. */
export interface Tweak {
  dx: number
  dy: number
  scale: number
}
/** 카테고리 → 조절값 (없으면 원래 위치·크기) */
export type Tweaks = Partial<Record<Category, Tweak>>

export interface SavedOutfit {
  id: string
  createdAt: number
  outfit: Outfit
  tweaks?: Tweaks
  bgId: string
  /** 작은 미리보기 (data URL) */
  thumb: string
}
