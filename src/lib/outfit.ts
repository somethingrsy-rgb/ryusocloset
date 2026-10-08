import { CATEGORIES, HAIR_FRONT_Z, type Category } from './layers'
import type { Item, Outfit } from './types'

/** 같은 옷을 다시 누르면 벗기고, 아니면 카테고리당 1개로 교체한다. 원피스 ↔ 상의/하의는 서로 해제. */
export function toggleItem(outfit: Outfit, item: Item): Outfit {
  const next: Outfit = { ...outfit }
  if (next[item.category] === item.id) {
    delete next[item.category]
    return next
  }
  next[item.category] = item.id
  if (item.category === 'dress') {
    delete next.top
    delete next.bottom
  } else if (item.category === 'top' || item.category === 'bottom') {
    delete next.dress
  }
  return next
}

/** 저장 데이터에서 모르는 id 제거, 원피스/상하의 충돌 정리 */
export function sanitizeOutfit(raw: unknown, byId: Record<string, Item>): Outfit {
  const out: Outfit = {}
  if (!raw || typeof raw !== 'object') return out
  for (const c of CATEGORIES) {
    const id = (raw as Record<string, unknown>)[c]
    if (typeof id === 'string' && byId[id]?.category === c) out[c] = id
  }
  if (out.dress) {
    delete out.top
    delete out.bottom
  }
  return out
}

/** 레이어 렌더링 순서(아래→위)로 정렬된 착용 아이템 */
export function wornItems(outfit: Outfit, byId: Record<string, Item>): Item[] {
  return CATEGORIES.map((c) => (outfit[c] ? byId[outfit[c]!] : undefined))
    .filter((i): i is Item => !!i)
    .sort((a, b) => a.zIndex - b.zIndex)
}

export const HAIR_FRONT_LAYER_Z = HAIR_FRONT_Z

function pick<T>(arr: T[], rng: () => number): T | undefined {
  return arr.length ? arr[Math.floor(rng() * arr.length)] : undefined
}

/** 어색하지 않은 랜덤 코디: (원피스 | 상의+하의) + 선택적 아우터/신발/액세서리/가방 */
export function randomOutfit(byCategory: Record<Category, Item[]>, rng: () => number = Math.random): Outfit {
  const out: Outfit = {}
  const set = (c: Category) => {
    const it = pick(byCategory[c], rng)
    if (it) out[c] = it.id
  }
  const canDress = byCategory.dress.length > 0
  const canSeparates = byCategory.top.length > 0 && byCategory.bottom.length > 0
  if (canDress && (!canSeparates || rng() < 0.4)) {
    set('dress')
  } else if (canSeparates) {
    set('top')
    set('bottom')
  }
  if (rng() < 0.5) set('outer')
  if (rng() < 0.9) set('shoes')
  if (rng() < 0.3) set('accessory')
  if (rng() < 0.4) set('bag')
  return out
}

export function sameOutfit(a: Outfit, b: Outfit): boolean {
  return CATEGORIES.every((c) => a[c] === b[c])
}
