import raw from '../data/items.json'
import { CATEGORIES, type Category } from './layers'
import type { Item } from './types'

export const ITEMS = raw as Item[]
export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]))
export const ITEMS_BY_CATEGORY: Record<Category, Item[]> = Object.fromEntries(
  CATEGORIES.map((c) => [c, ITEMS.filter((i) => i.category === c)]),
) as Record<Category, Item[]>

/** 정적 에셋 URL (vite base 를 따라감) */
export const assetUrl = (p: string) => `${import.meta.env.BASE_URL}${p}`

export const BASE_LAYERS = {
  body: assetUrl('assets/base/body.webp'),
  bodyBarefoot: assetUrl('assets/base/body_barefoot.webp'),
  hairFront: assetUrl('assets/base/hair_front.webp'),
}
