import raw from '../data/assemble-items.json'
import { ITEMS, assetUrl } from './items'
import type { Item } from './types'

/** 조립 탭의 머리·상의(팔 포함). 하의는 코디 탭의 `native` 하의를 쓴다. */
export interface AssemblePart {
  id: string
  kind: 'head' | 'top'
  name: { ko: string; en: string }
  colorHex: string | null
  /** public/ 기준 상대 경로 (1024×1536 캔버스 전체) */
  image: string
  thumb: string
}

export const ASSEMBLE_PARTS = raw as AssemblePart[]
export const HEADS = ASSEMBLE_PARTS.filter((p) => p.kind === 'head')
export const TOPS = ASSEMBLE_PARTS.filter((p) => p.kind === 'top')
/** 현재 아바타 기준으로 새로 그려서 몸 아랫부분(다리)에 정확히 맞는 하의만 */
export const BOTTOMS: Item[] = ITEMS.filter((i) => i.category === 'bottom' && i.native)

export const LOWER_IMAGE = assetUrl('assets/assemble/lower.webp')

export interface Assembly {
  head: string
  top?: string
  bottom?: string
}

export const defaultAssembly = (): Assembly => ({ head: HEADS[0]?.id ?? '', top: TOPS[0]?.id })

const partIds = (parts: { id: string }[]) => new Set(parts.map((p) => p.id))

/** 저장 데이터 검증: 모르는 id 는 버리고, 머리는 항상 하나 있게 한다 */
export function sanitizeAssembly(raw: unknown): Assembly {
  const base = defaultAssembly()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const heads = partIds(HEADS)
  const tops = partIds(TOPS)
  const bottoms = partIds(BOTTOMS)
  const pick = (v: unknown, set: Set<string>) => (typeof v === 'string' && set.has(v) ? v : undefined)
  const out: Assembly = { head: pick(r.head, heads) ?? base.head }
  const top = pick(r.top, tops)
  const bottom = pick(r.bottom, bottoms)
  if (top) out.top = top
  if (bottom) out.bottom = bottom
  return out
}

/** 같은 부품을 다시 고르면 벗는다. 머리는 하나가 꼭 있어야 하므로 벗지 않고 교체만 한다. */
export function togglePart(a: Assembly, slot: 'head' | 'top' | 'bottom', id: string): Assembly {
  if (slot === 'head') return { ...a, head: id }
  const next = { ...a }
  if (next[slot] === id) delete next[slot]
  else next[slot] = id
  return next
}

export const randomAssembly = (rng: () => number = Math.random): Assembly => {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)]
  const out: Assembly = { head: pick(HEADS)?.id ?? '' }
  if (TOPS.length) out.top = pick(TOPS).id
  if (BOTTOMS.length) out.bottom = pick(BOTTOMS).id
  return out
}
