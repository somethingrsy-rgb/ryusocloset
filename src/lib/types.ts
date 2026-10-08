import type { Category } from './layers'

export interface Item {
  id: string
  category: Category
  name: { ko: string; en: string }
  color: string | null
  colorName: { ko: string; en: string } | null
  colorHex: string | null
  /** public/ 기준 상대 경로 */
  image: string
  thumb: string
  zIndex: number
}

/** 카테고리 → 착용 중인 아이템 id */
export type Outfit = Partial<Record<Category, string>>

export interface SavedOutfit {
  id: string
  createdAt: number
  outfit: Outfit
  bgId: string
  /** 작은 미리보기 (data URL) */
  thumb: string
}
