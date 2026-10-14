import { currentAssignment, findItem, getGame, travelItem } from './game'
import { isRestoring } from './restoreGuard'

/** 한 단계를 깨는 데 필요한 정답 수 (한 번에 맞힌 문제만 센다) */
export const GOAL = 10
const KEY = 'ryuso.math.v1'

export interface Question {
  text: string
  answer: number
  choices: number[]
}

export interface MathLevel {
  id: number
  icon: string
  title: { ko: string; en: string }
  hint: { ko: string; en: string }
  make: (rnd: () => number) => Question
}

const int = (rnd: () => number, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))

/** 정답 + 비슷한 오답 3개를 섞어서 4지선다로 만든다 */
export function withChoices(text: string, answer: number, rnd: () => number): Question {
  const set = new Set<number>([answer])
  let guard = 0
  while (set.size < 4 && guard++ < 200) {
    const wrong = answer + int(rnd, -5, 5)
    if (wrong >= 0 && wrong !== answer) set.add(wrong)
  }
  for (let n = answer + 1; set.size < 4; n++) set.add(n)
  const choices = [...set]
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[choices[i], choices[j]] = [choices[j], choices[i]]
  }
  return { text, answer, choices }
}

const add = (rnd: () => number, lo: number, hi: number, maxSum: number): Question => {
  const a = int(rnd, lo, hi)
  const b = int(rnd, lo, Math.min(hi, maxSum - a))
  return withChoices(`${a} + ${b} = ?`, a + b, rnd)
}
const sub = (rnd: () => number, aLo: number, aHi: number, bLo: number): Question => {
  const a = int(rnd, aLo, aHi)
  const b = int(rnd, bLo, a - 1)
  return withChoices(`${a} − ${b} = ?`, a - b, rnd)
}
const mul = (rnd: () => number, lo: number, hi: number): Question => {
  const a = int(rnd, lo, hi)
  const b = int(rnd, 1, 9)
  return withChoices(`${a} × ${b} = ?`, a * b, rnd)
}

export const LEVELS: MathLevel[] = [
  { id: 1, icon: '🍎', title: { ko: '더하기 10까지', en: 'Add up to 10' }, hint: { ko: '합이 10 이하', en: 'Sums up to 10' }, make: (r) => add(r, 1, 9, 10) },
  { id: 2, icon: '🍓', title: { ko: '빼기 10까지', en: 'Subtract within 10' }, hint: { ko: '10 이하에서 빼기', en: 'Take away within 10' }, make: (r) => sub(r, 2, 10, 1) },
  { id: 3, icon: '🍊', title: { ko: '20까지 더하고 빼기', en: 'Add & subtract to 20' }, hint: { ko: '20 이하', en: 'Up to 20' }, make: (r) => (r() < 0.5 ? add(r, 3, 17, 20) : sub(r, 11, 20, 2)) },
  { id: 4, icon: '🍇', title: { ko: '두 자리 수 더하고 빼기', en: 'Two-digit add & subtract' }, hint: { ko: '99 이하', en: 'Up to 99' }, make: (r) => (r() < 0.5 ? add(r, 10, 80, 99) : sub(r, 20, 99, 10)) },
  { id: 5, icon: '🍪', title: { ko: '곱셈 2~5단', en: 'Times tables 2–5' }, hint: { ko: '2단부터 5단까지', en: '2× to 5×' }, make: (r) => mul(r, 2, 5) },
  {
    id: 6, icon: '🎂', title: { ko: '구구단과 나눗셈', en: 'Times tables & division' }, hint: { ko: '2~9단, 나누기', en: '2×–9× and ÷' },
    make: (r) => {
      if (r() < 0.5) return mul(r, 2, 9)
      const a = int(r, 2, 9)
      const q = int(r, 1, 9)
      return withChoices(`${a * q} ÷ ${a} = ?`, q, r)
    },
  },
]

export interface MathProgress {
  /** 단계별로 모은 정답 수 (GOAL 에서 멈춘다) */
  correct: Record<number, number>
  /** 단계 목표를 채워서 받은 선물 아이템 */
  gifts: Record<number, string>
}

export const EMPTY: MathProgress = { correct: {}, gifts: {} }

export function readMath(): MathProgress {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return EMPTY
    const r = raw as Partial<MathProgress>
    const correct: Record<number, number> = {}
    const gifts: Record<number, string> = {}
    for (const l of LEVELS) {
      const c = (r.correct as Record<string, unknown> | undefined)?.[l.id]
      if (typeof c === 'number' && Number.isFinite(c)) correct[l.id] = Math.min(GOAL, Math.max(0, Math.floor(c)))
      const g = (r.gifts as Record<string, unknown> | undefined)?.[l.id]
      if (typeof g === 'string' && g.length <= 80) gifts[l.id] = g
    }
    return { correct, gifts }
  } catch {
    return EMPTY
  }
}

export function writeMath(p: MathProgress) {
  if (isRestoring()) return
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* 저장 공간이 없으면 이번 접속에서만 유지된다 */
  }
}

export const countOf = (p: MathProgress, level: number) => p.correct[level] ?? 0
export const isCleared = (p: MathProgress, level: number) => countOf(p, level) >= GOAL
/** 앞 단계를 깨야 다음 단계가 열린다 */
export const isUnlocked = (p: MathProgress, level: number) => level <= 1 || isCleared(p, level - 1)

/** 정답 하나를 더한다. 이번에 목표를 채웠으면 justCleared */
export function addCorrect(p: MathProgress, level: number): { next: MathProgress; justCleared: boolean } {
  const before = countOf(p, level)
  if (before >= GOAL) return { next: p, justCleared: false }
  const now = before + 1
  return { next: { ...p, correct: { ...p.correct, [level]: now } }, justCleared: now >= GOAL }
}

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
export function claimGift(p: MathProgress, level: number): { next: MathProgress; gift: string | null } {
  if (p.gifts[level]) return { next: p, gift: p.gifts[level] }
  const gift = pickGift(getGame().found)
  if (!gift) return { next: p, gift: null }
  findItem(gift)
  return { next: { ...p, gifts: { ...p.gifts, [level]: gift } }, gift }
}
