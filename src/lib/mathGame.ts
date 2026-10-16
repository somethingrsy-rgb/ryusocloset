import { currentAssignment, findItem, getGame, travelItem } from './game'
import { isRestoring } from './restoreGuard'

/** 한 단계를 깨는 데 필요한 정답 수 (한 번에 맞힌 문제만 센다) */
export const GOAL = 8
const KEY = 'ryuso.math.v2'

export type Age = 6 | 8
export const AGES: readonly Age[] = [6, 8]

/** 그림(이모지)으로 보여 주는 문제: 세기, 더하기, 빼기 */
export interface Visual {
  emoji: string
  a: number
  /** 더하기면 더하는 수, 빼기면 빼는 수 */
  b?: number
  op?: '+' | '−'
}

export interface Question {
  /** 문제 글자 (그림이 있으면 그림 아래에 작게) */
  text: string
  /** 아이에게 읽어 주는 짧은 안내 */
  prompt: { ko: string; en: string }
  visual?: Visual
  answer: number
  choices: number[]
}

export interface MathLevel {
  id: number
  age: Age
  icon: string
  title: { ko: string; en: string }
  hint: { ko: string; en: string }
  make: (rnd: () => number) => Question
}

const int = (rnd: () => number, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))
const pick = <T,>(rnd: () => number, list: readonly T[]) => list[Math.floor(rnd() * list.length)]
const FRUITS = ['🍎', '🍓', '🍊', '🍇', '🍪', '🐥', '🌸', '⭐'] as const

const shuffle = <T,>(list: T[], rnd: () => number) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/** 정답 + 비슷한 오답으로 보기 만들기 (기본 4개, min 보다 작은 보기는 안 만든다) */
export function makeChoices(answer: number, rnd: () => number, count = 4, min = 0, spread = 4): number[] {
  const set = new Set<number>([answer])
  let guard = 0
  while (set.size < count && guard++ < 300) {
    const wrong = answer + int(rnd, -spread, spread)
    if (wrong >= min && wrong !== answer) set.add(wrong)
  }
  for (let n = Math.max(min, answer + 1); set.size < count; n++) set.add(n)
  return shuffle([...set], rnd)
}

const PROMPT = {
  count: { ko: '몇 개일까요?', en: 'How many?' },
  add: { ko: '모두 몇 개일까요?', en: 'How many in all?' },
  sub: { ko: '몇 개가 남았을까요?', en: 'How many are left?' },
  calc: { ko: '답을 골라 보세요', en: 'Pick the answer' },
  bigger: { ko: '더 큰 수는 어느 쪽일까요?', en: 'Which number is bigger?' },
}

const count = (rnd: () => number, lo: number, hi: number): Question => {
  const n = int(rnd, lo, hi)
  const emoji = pick(rnd, FRUITS)
  return { text: `${n}`, prompt: PROMPT.count, visual: { emoji, a: n }, answer: n, choices: makeChoices(n, rnd, 4, 1, 3) }
}
const bigger = (rnd: () => number): Question => {
  const a = int(rnd, 1, 10)
  let b = int(rnd, 1, 10)
  if (b === a) b = a === 10 ? 9 : a + 1
  const ans = Math.max(a, b)
  return { text: `${a}  ⚖️  ${b}`, prompt: PROMPT.bigger, answer: ans, choices: [a, b] }
}
const addPic = (rnd: () => number, maxSum: number): Question => {
  const a = int(rnd, 1, maxSum - 1)
  const b = int(rnd, 1, maxSum - a)
  return { text: `${a} + ${b}`, prompt: PROMPT.add, visual: { emoji: pick(rnd, FRUITS), a, b, op: '+' }, answer: a + b, choices: makeChoices(a + b, rnd, 4, 1, 3) }
}
const subPic = (rnd: () => number, maxTotal: number): Question => {
  const a = int(rnd, 2, maxTotal)
  const b = int(rnd, 1, a - 1)
  return { text: `${a} − ${b}`, prompt: PROMPT.sub, visual: { emoji: pick(rnd, FRUITS), a, b, op: '−' }, answer: a - b, choices: makeChoices(a - b, rnd, 4, 0, 3) }
}
const calc = (text: string, answer: number, rnd: () => number): Question => ({ text: `${text} = ?`, prompt: PROMPT.calc, answer, choices: makeChoices(answer, rnd, 4, 0, 5) })
const add = (rnd: () => number, lo: number, hi: number, maxSum: number) => {
  const a = int(rnd, lo, hi)
  const b = int(rnd, lo, Math.min(hi, maxSum - a))
  return calc(`${a} + ${b}`, a + b, rnd)
}
const sub = (rnd: () => number, aLo: number, aHi: number, bLo: number) => {
  const a = int(rnd, aLo, aHi)
  const b = int(rnd, bLo, a - 1)
  return calc(`${a} − ${b}`, a - b, rnd)
}
const mul = (rnd: () => number, lo: number, hi: number) => {
  const a = int(rnd, lo, hi)
  const b = int(rnd, 1, 9)
  return calc(`${a} × ${b}`, a * b, rnd)
}

export const LEVELS: MathLevel[] = [
  { id: 1, age: 6, icon: '🍎', title: { ko: '세어 봐요 (1~5)', en: 'Count (1–5)' }, hint: { ko: '그림이 몇 개인지 세어요', en: 'Count the pictures' }, make: (r) => count(r, 1, 5) },
  { id: 2, age: 6, icon: '🍓', title: { ko: '세어 봐요 (6~10)', en: 'Count (6–10)' }, hint: { ko: '조금 더 많이 세어요', en: 'Count a few more' }, make: (r) => count(r, 6, 10) },
  { id: 3, age: 6, icon: '⚖️', title: { ko: '어느 쪽이 더 클까요', en: 'Which is bigger' }, hint: { ko: '더 큰 수를 골라요', en: 'Pick the bigger number' }, make: bigger },
  { id: 4, age: 6, icon: '🐥', title: { ko: '그림으로 더하기 (5까지)', en: 'Add with pictures (to 5)' }, hint: { ko: '그림을 모아서 세어요', en: 'Put them together' }, make: (r) => addPic(r, 5) },
  { id: 5, age: 6, icon: '🌸', title: { ko: '그림으로 더하기 (10까지)', en: 'Add with pictures (to 10)' }, hint: { ko: '합이 10 이하', en: 'Sums up to 10' }, make: (r) => addPic(r, 10) },
  { id: 6, age: 6, icon: '⭐', title: { ko: '그림으로 빼기 (10까지)', en: 'Subtract with pictures' }, hint: { ko: '흐린 그림은 빼요', en: 'Faded ones go away' }, make: (r) => subPic(r, 10) },
  { id: 7, age: 8, icon: '🍊', title: { ko: '더하기 20까지', en: 'Add up to 20' }, hint: { ko: '합이 20 이하', en: 'Sums up to 20' }, make: (r) => add(r, 3, 17, 20) },
  { id: 8, age: 8, icon: '🍇', title: { ko: '빼기 20까지', en: 'Subtract within 20' }, hint: { ko: '20 이하에서 빼기', en: 'Take away within 20' }, make: (r) => sub(r, 6, 20, 2) },
  { id: 9, age: 8, icon: '🍪', title: { ko: '두 자리 수 더하고 빼기', en: 'Two-digit add & subtract' }, hint: { ko: '99 이하', en: 'Up to 99' }, make: (r) => (r() < 0.5 ? add(r, 10, 80, 99) : sub(r, 20, 99, 10)) },
  { id: 10, age: 8, icon: '🎈', title: { ko: '곱셈 2~5단', en: 'Times tables 2–5' }, hint: { ko: '2단부터 5단까지', en: '2× to 5×' }, make: (r) => mul(r, 2, 5) },
  {
    id: 11, age: 8, icon: '🎂', title: { ko: '구구단과 나눗셈', en: 'Times tables & division' }, hint: { ko: '2~9단, 나누기', en: '2×–9× and ÷' },
    make: (r) => {
      if (r() < 0.5) return mul(r, 2, 9)
      const a = int(r, 2, 9)
      const q = int(r, 1, 9)
      return calc(`${a * q} ÷ ${a}`, q, r)
    },
  },
]

export const levelsFor = (age: Age) => LEVELS.filter((l) => l.age === age)

/** 아이 한 명의 기록 */
export interface Profile {
  id: string
  name: string
  age: Age
  /** 단계별로 모은 정답 수 (GOAL 에서 멈춘다) */
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
      if (typeof c === 'number' && Number.isFinite(c)) correct[l.id] = Math.min(GOAL, Math.max(0, Math.floor(c)))
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
export const isCleared = (p: Profile, level: number) => countOf(p, level) >= GOAL
/** 같은 나이 단계에서 앞 단계를 깨야 다음 단계가 열린다 */
export function isUnlocked(p: Profile, level: number): boolean {
  const list = levelsFor(p.age)
  const i = list.findIndex((l) => l.id === level)
  if (i < 0) return false
  return i === 0 || isCleared(p, list[i - 1].id)
}

/** 정답 하나를 더한다. 이번에 목표를 채웠으면 justCleared */
export function addCorrect(p: Profile, level: number): { next: Profile; justCleared: boolean } {
  const before = countOf(p, level)
  if (before >= GOAL) return { next: p, justCleared: false }
  const now = before + 1
  return { next: { ...p, correct: { ...p.correct, [level]: now } }, justCleared: now >= GOAL }
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
