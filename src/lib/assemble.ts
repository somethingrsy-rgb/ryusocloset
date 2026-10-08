import raw from '../data/assemble-items.json'
import { sanitizeTweaks, type TweakMap } from './tweaks'

/** 조립 탭의 부품: 머리(목 위), 상의(팔·손 포함), 하의(허리·다리·발 포함), 신발. 모두 1024×1536 캔버스 전체 이미지. */
export interface AssemblePart {
  id: string
  kind: 'head' | 'top' | 'bottom' | 'shoes'
  name: { ko: string; en: string }
  colorHex: string | null
  /** 알파가 있는 영역의 경계 상자(캔버스 px) — 크기 조절의 기준점(중심) */
  box: { x: number; y: number; w: number; h: number }
  /** public/ 기준 상대 경로 */
  image: string
  thumb: string
}

export type Slot = AssemblePart['kind']
export const SLOTS: readonly Slot[] = ['head', 'top', 'bottom', 'shoes']
/** 쌓이는 순서(클수록 위): 하의 < 신발 < 상의 < 머리 */
export const SLOT_Z: Record<Slot, number> = { bottom: 10, shoes: 15, top: 20, head: 30 }

export const ASSEMBLE_PARTS = raw as AssemblePart[]
export const PART_BY_ID: Record<string, AssemblePart> = Object.fromEntries(ASSEMBLE_PARTS.map((p) => [p.id, p]))
export const partsOf = (kind: Slot) => ASSEMBLE_PARTS.filter((p) => p.kind === kind)
export const HEADS = partsOf('head')
export const TOPS = partsOf('top')
export const BOTTOMS = partsOf('bottom')
export const SHOES = partsOf('shoes')

export type AssembleTweaks = TweakMap<Slot>

export interface Assembly {
  head: string
  top?: string
  bottom?: string
  shoes?: string
  tweaks?: AssembleTweaks
}

export const defaultAssembly = (): Assembly => ({ head: HEADS[0]?.id ?? '', top: TOPS[0]?.id })

/** 저장 데이터 검증: 모르는 id 는 버리고, 머리는 항상 하나 있게 한다 */
export function sanitizeAssembly(raw: unknown): Assembly {
  const base = defaultAssembly()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const pick = (v: unknown, kind: Slot) => (typeof v === 'string' && PART_BY_ID[v]?.kind === kind ? v : undefined)
  const out: Assembly = { head: pick(r.head, 'head') ?? base.head }
  const top = pick(r.top, 'top')
  const bottom = pick(r.bottom, 'bottom')
  const shoes = pick(r.shoes, 'shoes')
  if (top) out.top = top
  if (bottom) out.bottom = bottom
  if (shoes) out.shoes = shoes
  const tweaks = sanitizeTweaks(r.tweaks, SLOTS, out)
  if (Object.keys(tweaks).length) out.tweaks = tweaks
  return out
}

/** 같은 부품을 다시 고르면 벗는다(머리는 교체만). 바뀐 칸의 위치·크기 조절은 초기화된다. */
export function togglePart(a: Assembly, slot: Slot, id: string): Assembly {
  const next: Assembly = { ...a }
  if (slot === 'head') next.head = id
  else if (next[slot] === id) delete next[slot]
  else next[slot] = id
  if (next[slot] !== a[slot] && next.tweaks?.[slot]) {
    const t = { ...next.tweaks }
    delete t[slot]
    if (Object.keys(t).length) next.tweaks = t
    else delete next.tweaks
  }
  return next
}

/** 한 칸을 벗는다 (머리는 벗지 않는다) */
export function takeOffPart(a: Assembly, slot: Slot): Assembly {
  if (slot === 'head' || !a[slot]) return a
  return togglePart(a, slot, a[slot]!)
}

export const randomAssembly = (rng: () => number = Math.random): Assembly => {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)]
  const out: Assembly = { head: pick(HEADS)?.id ?? '' }
  if (TOPS.length) out.top = pick(TOPS).id
  if (BOTTOMS.length) out.bottom = pick(BOTTOMS).id
  if (SHOES.length) out.shoes = pick(SHOES).id
  return out
}
