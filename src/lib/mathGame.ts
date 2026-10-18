import { currentAssignment, findItem, getGame, travelItem } from './game'
import { isRestoring } from './restoreGuard'
import { EIGHT_TOPICS, SIX_TOPICS } from './mathQuestions'

const KEY = 'ryuso.math.v3'

export type Age = 6 | 8
export const AGES: readonly Age[] = [6, 8]

export type Shape = 'circle' | 'tri' | 'square'
/** 보기·그림 한 장: 이모지(여러 개 가능), 도형, 막대(길이 0~1), 컵(물 높이 0~1) */
export type Pic = { emoji: string; n?: number; scale?: number } | { shape: Shape } | { bar: number } | { cup: number }
export type Visual =
  | { kind: 'groups'; groups: { emoji: string; n: number; cross?: number }[]; op?: '+' }
  | { kind: 'shapes'; list: Shape[] }
  | { kind: 'seq'; items: string[] }
  | { kind: 'tens'; tens: number; ones: number; emoji: string }
  | { kind: 'clock'; h: number; m: 0 | 30 }
  | { kind: 'balance'; left: string; right: string; heavier: 'left' | 'right' }
export interface Choice { label?: string; pic?: Pic }

interface Base {
  /** 아이에게 보여 주고 읽어 주는 문제 */
  text: string
  visual?: Visual
  /** 맞힌 뒤에 보여 주는 쉬운 풀이 한 문장 */
  why: string
}
export type Question =
  | (Base & { kind: 'choice'; choices: Choice[]; answer: number })
  | (Base & { kind: 'input'; answer: number })
  | (Base & { kind: 'order'; cards: number[] })

export interface MathLevel {
  id: number
  age: Age
  icon: string
  title: { ko: string; en: string }
  hint: { ko: string; en: string }
  questions: Question[]
}

/** 비슷한 문제끼리 묶은 한 주제 (한 단계) */
export interface MathTopic {
  icon: string
  title: { ko: string; en: string }
  hint: { ko: string; en: string }
  questions: Question[]
}
/** 6세 8단계(1~8), 8세 9단계(9~17). 한 단계는 한 주제의 문제 8~10개 */
export const LEVELS: MathLevel[] = [
  ...SIX_TOPICS.map((t, i): MathLevel => ({ id: i + 1, age: 6, ...t })),
  ...EIGHT_TOPICS.map((t, i): MathLevel => ({ id: SIX_TOPICS.length + i + 1, age: 8, ...t })),
]

export const levelsFor = (age: Age) => LEVELS.filter((l) => l.age === age)
export const totalOf = (level: number) => LEVELS.find((l) => l.id === level)?.questions.length ?? 0

/** 아이 한 명의 기록 */
export interface Profile {
  id: string
  name: string
  age: Age
  /** 단계별로 끝낸 문제 수 */
  correct: Record<number, number>
  /** 단계 목표를 채워서 받은 선물 아이템 */
  gifts: Record<number, string>
}

export interface MathState {
  profiles: Profile[]
}

export const EMPTY: MathState = { profiles: [] }
export const MAX_PROFILES = 4

export function sanitizeState(raw: unknown): MathState {
  if (!raw || typeof raw !== 'object') return EMPTY
  const list = (raw as { profiles?: unknown }).profiles
  if (!Array.isArray(list)) return EMPTY
  const profiles: Profile[] = []
  for (const p of list.slice(0, MAX_PROFILES)) {
    if (!p || typeof p !== 'object') continue
    const r = p as Record<string, unknown>
    const age = r.age === 6 || r.age === 8 ? r.age : null
    if (!age || typeof r.id !== 'string' || typeof r.name !== 'string') continue
    const correct: Record<number, number> = {}
    const gifts: Record<number, string> = {}
    for (const l of LEVELS) {
      const c = (r.correct as Record<string, unknown> | undefined)?.[l.id]
      if (typeof c === 'number' && Number.isFinite(c)) correct[l.id] = Math.min(l.questions.length, Math.max(0, Math.floor(c)))
      const g = (r.gifts as Record<string, unknown> | undefined)?.[l.id]
      if (typeof g === 'string' && g.length <= 80) gifts[l.id] = g
    }
    profiles.push({ id: r.id.slice(0, 40), name: r.name.slice(0, 12), age, correct, gifts })
  }
  return { profiles }
}

export function readMath(): MathState {
  try {
    return sanitizeState(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return EMPTY
  }
}

export function writeMath(s: MathState) {
  if (isRestoring()) return
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* 저장 공간이 없으면 이번 접속에서만 유지된다 */
  }
}

export function addProfile(s: MathState, name: string, age: Age): { next: MathState; id: string | null } {
  const clean = name.trim().slice(0, 12)
  if (!clean || s.profiles.length >= MAX_PROFILES) return { next: s, id: null }
  const id = `p${Date.now().toString(36)}${s.profiles.length}`
  return { next: { profiles: [...s.profiles, { id, name: clean, age, correct: {}, gifts: {} }] }, id }
}
export const removeProfile = (s: MathState, id: string): MathState => ({ profiles: s.profiles.filter((p) => p.id !== id) })

export const countOf = (p: Profile, level: number) => p.correct[level] ?? 0
export const isCleared = (p: Profile, level: number) => countOf(p, level) >= totalOf(level)
/** 같은 나이 단계에서 앞 단계를 깨야 다음 단계가 열린다 */
export function isUnlocked(p: Profile, level: number): boolean {
  const list = levelsFor(p.age)
  const i = list.findIndex((l) => l.id === level)
  if (i < 0) return false
  return i === 0 || isCleared(p, list[i - 1].id)
}

/** 한 단계에서 `done` 문제까지 끝냈다고 기록한다(줄어들지 않는다). 이번에 전부 끝냈으면 justCleared */
export function addCorrect(p: Profile, level: number, done: number): { next: Profile; justCleared: boolean } {
  const total = totalOf(level)
  const before = countOf(p, level)
  const now = Math.min(total, Math.max(before, done))
  if (now === before) return { next: p, justCleared: false }
  return { next: { ...p, correct: { ...p.correct, [level]: now } }, justCleared: before < total && now >= total }
}

export const updateProfile = (s: MathState, p: Profile): MathState => ({ profiles: s.profiles.map((x) => (x.id === p.id ? p : x)) })

/**
 * 선물로 줄 아이템: 아직 못 찾은 옷·신발·헤어핀·마법봉 중에서 무작위 (방 소품은 제외).
 * 다 찾았으면 null.
 */
export function pickGift(found: readonly string[], rnd: () => number = Math.random): string | null {
  const ids = Object.values(currentAssignment())
    .flat()
    .filter((id) => !found.includes(id) && travelItem(id)?.kind !== 'room')
  return ids.length ? ids[Math.floor(rnd() * ids.length)] : null
}

/** 목표를 채운 단계의 선물을 정해서 찾은 아이템에 넣는다. 줄 게 없으면 null */
export function claimGift(p: Profile, level: number): { next: Profile; gift: string | null } {
  if (p.gifts[level]) return { next: p, gift: p.gifts[level] }
  const gift = pickGift(getGame().found)
  if (!gift) return { next: p, gift: null }
  findItem(gift)
  return { next: { ...p, gifts: { ...p.gifts, [level]: gift } }, gift }
}
