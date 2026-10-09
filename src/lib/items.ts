import raw from '../data/items.json'
import { CATEGORIES, type Category } from './layers'
import type { Item } from './types'

export const ITEMS: Item[] = [...(raw as Item[])]
export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((i) => [i.id, i]))
export const ITEMS_BY_CATEGORY: Record<Category, Item[]> = Object.fromEntries(
  CATEGORIES.map((c) => [c, ITEMS.filter((i) => i.category === c)]),
) as Record<Category, Item[]>

/** 정적 에셋 URL (vite base 를 따라감) */
export const assetUrl = (p: string) => (/^(data|blob):/.test(p) ? p : `${import.meta.env.BASE_URL}${p}`)

export const BASE_LAYERS = {
  body: assetUrl('assets/base/body.webp'),
  bodyBarefoot: assetUrl('assets/base/body_barefoot.webp'),
  hairFront: assetUrl('assets/base/hair_front.webp'),
}

/** 옷 파일명이 바뀌기 전의 id → 현재 id (예전에 저장한 코디가 깨지지 않게) */
export const ID_ALIASES: Record<string, string> = {
  "bottom_belt_skirt_black": "bottom_skirt_black",
  "bottom_skirt_brown": "bottom_shezmig_skirt_brown",
  "bottom_pants_ivory": "bottom_thick_pants_ivory",
  "dress_tweed_black": "dress_deco_tweed_black",
  "outer_denim_jacket": "outer_cropped_denim",
  "outer_tweed_skyblue": "outer_cropped_tweed_blue",
  "outer_tweed_roem_black": "outer_roem_tweed_black",
  "shoes_flat_ivory": "shoes_flats_ivory",
  "shoes_sneaker_navy": "shoes_sneakers_navy",
  "top_vest_ivory": "top_knit_vest_ivory",
  "acc_lace_collar": "acc_lace_collar_white"
}

/* ---- 내가 추가한 옷 (customItems.ts 가 불러오고 저장한다) ---- */
export const CUSTOM_PREFIX = 'custom_'
export const isCustomItem = (i: Pick<Item, 'id'>) => i.id.startsWith(CUSTOM_PREFIX)

const listeners = new Set<() => void>()
let customVersion = 0
export const subscribeItems = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn))
export const itemsVersion = () => customVersion
export const notifyItemsChanged = () => {
  customVersion++
  listeners.forEach((fn) => fn())
}

/** 내 옷을 목록 맨 앞에 넣는다 (id 가 같으면 교체) */
export function registerCustomItem(item: Item, silent = false) {
  unregisterCustomItem(item.id, true)
  ITEMS.unshift(item)
  ITEM_BY_ID[item.id] = item
  ITEMS_BY_CATEGORY[item.category].unshift(item)
  if (!silent) notifyItemsChanged()
}

export function unregisterCustomItem(id: string, silent = false) {
  const it = ITEM_BY_ID[id]
  if (!it) return
  ITEMS.splice(ITEMS.indexOf(it), 1)
  const list = ITEMS_BY_CATEGORY[it.category]
  list.splice(list.indexOf(it), 1)
  delete ITEM_BY_ID[id]
  if (!silent) notifyItemsChanged()
}
