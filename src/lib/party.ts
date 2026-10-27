import { CALL_ANIMALS, kidWords } from './animalCalls'
import { MENU } from './recipes'

/**
 * 집 파티: 초대한 카페 동물 친구들이 집에 들어와 인사하고, 돌아다니며 이야기한다.
 * 위치는 집 무대의 % 좌표(x 0~100, y 는 발 높이). 움직임은 순수 함수라 테스트할 수 있다.
 */
export interface Guest {
  animal: number
  x: number
  y: number
  tx: number
  ty: number
  /** 다음 걸음을 시작할 때까지 남은 시간(초) */
  wait: number
  /** 걷는 방향(그림을 뒤집는다) */
  dir: 1 | -1
  /** 들어오는 중(첫 도착 때 인사한다) */
  entering: boolean
  /** 집을 나가는 중 */
  leaving: boolean
}
export interface Floor { minX: number; maxX: number; minY: number; maxY: number }

const SPEED = 9 // %/초
/** 친구끼리(그리고 아바타와) 이만큼(y 는 1.6배로 잼)보다 가까이 걸어 들어가지 않는다 */
export const PERSONAL = 10
const gap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.6)
const rand = (a: number, b: number, rnd: () => number) => a + (b - a) * rnd()

/** 바닥에서 다른 친구들(과 아바타)과 가장 멀리 떨어진 곳: 후보 6곳 중 고른다(한데 뭉치지 않게) */
export function roomySpot(floor: Floor, others: { x: number; y: number }[], rnd: () => number = Math.random) {
  let best = { x: rand(floor.minX, floor.maxX, rnd), y: rand(floor.minY, floor.maxY, rnd) }, bestD = -1
  for (let k = 0; k < 6; k++) {
    const c = { x: rand(floor.minX, floor.maxX, rnd), y: rand(floor.minY, floor.maxY, rnd) }
    const d = others.length ? Math.min(...others.map((o) => Math.hypot(o.x - c.x, (o.y - c.y) * 1.6))) : 0
    if (d > bestD) { best = c; bestD = d }
  }
  return best
}

/** 문(왼쪽 바깥)으로 들어와서 바닥의 빈 곳으로 걸어간다. others 는 이미 있는 친구들·아바타 자리 */
export function arrive(animal: number, floor: Floor, rnd: () => number = Math.random, others: { x: number; y: number }[] = []): Guest {
  const t = roomySpot(floor, others, rnd)
  return { animal, x: -8, y: t.y, tx: t.x, ty: t.y, wait: 0, dir: 1, entering: true, leaving: false }
}

/** 한 프레임 움직임. 도착하면 잠깐 쉬었다가 바닥의 다른 곳으로 걸어간다. arrivedNow 는 이번 프레임에 처음 도착한 손님 */
export function stepGuests(gs: Guest[], dt: number, floor: Floor, rnd: () => number = Math.random, avoid: { x: number; y: number }[] = []): { guests: Guest[]; arrivedNow: number[]; gone: number[] } {
  const arrivedNow: number[] = []
  const gone: number[] = []
  const guests: Guest[] = []
  for (const g0 of gs) {
    const g = { ...g0 }
    // 지금 자리(이미 움직인 친구는 새 자리)를 기준으로 서로 부딪히지 않게 본다
    const others = [...guests, ...gs.slice(guests.length + gone.length + 1)].filter((o) => o.animal !== g.animal && !o.leaving)
    if (g.wait > 0) { g.wait = Math.max(0, g.wait - dt); guests.push(g); continue }
    const dx = g.tx - g.x, dy = (g.ty - g.y) * 1.6
    const d = Math.hypot(dx, dy)
    const step = SPEED * (g.leaving ? 1.8 : 1) * dt
    if (d <= step) {
      g.x = g.tx; g.y = g.ty
      if (g.leaving) { gone.push(g.animal); continue }
      if (g.entering) { g.entering = false; arrivedNow.push(g.animal); g.wait = rand(3.5, 5, rnd) } else g.wait = rand(1.5, 4.5, rnd)
      const t = roomySpot(floor, [...avoid, ...gs.filter((o) => o.animal !== g.animal).flatMap((o) => [o, { x: o.tx, y: o.ty }])], rnd)
      g.tx = t.x; g.ty = t.y
    } else {
      const nx = g.x + (dx / d) * step, ny = g.y + (dy / d / 1.6) * step
      // 다음 걸음이 다른 친구(아바타)의 자리로 더 파고들면 멈춰 서서, 비어 있는 다른 곳으로 길을 바꾼다(나갈 때는 문으로 곧장)
      const blocker = g.leaving ? undefined : [...others, ...avoid].find((o) => gap({ x: nx, y: ny }, o) < PERSONAL && gap({ x: nx, y: ny }, o) < gap(g, o))
      if (blocker) {
        const t = roomySpot(floor, [...avoid, ...others.flatMap((o) => [o, { x: o.tx, y: o.ty }])], rnd)
        g.tx = t.x; g.ty = t.y; g.wait = 0.3
      } else {
        g.x = nx; g.y = ny
        if (Math.abs(dx) > 0.5) g.dir = dx > 0 ? 1 : -1
      }
    }
    guests.push(g)
  }
  return { guests, arrivedNow, gone }
}

/** 파티를 끝내면 모두 문 쪽(왼쪽 바깥)으로 걸어 나간다 */
export const leaveAll = (gs: Guest[]): Guest[] => gs.map((g) => ({ ...g, tx: -10, ty: g.y, wait: 0, leaving: true, entering: false }))

/** 들어와서 하는 인사: 유하야, 안녕? 초대해 줘서 고마워! */
export const helloLine = (kidName?: string) => `${kidWords(kidName).call}, 안녕? 초대해 줘서 고마워!`
export const byeLine = (kidName?: string) => `${kidWords(kidName).call}, 오늘 정말 즐거웠어! 안녕~`

/** 파티에서 하는 이야기: 혼자 하는 말, 다른 친구에게 하는 말 */
const SOLO = [
  '와, 집이 정말 예쁘다!',
  '랄랄라~ 파티 최고!',
  '우리 같이 춤추자!',
  '케이크 냄새가 나는 것 같아!',
  '여기 너무 포근하다~',
  '{call}, 오늘 초대해 줘서 정말 기뻐!',
  '{call}, 우리 사진 찍자! 찰칵!',
  '빙글빙글~ 신난다!',
  '{call}, 다음엔 우리 집에도 놀러 와!',
]
const TO_FRIEND = ['{friend}, 같이 놀자!', '{friend}, 너도 왔구나! 반가워!', '{friend}, 우리 숨바꼭질 할래?', '{friend}, 노래 불러 줄래?']
/** 동물마다 좋아하는 것 */
const OWN = ['꿀 케이크 먹고 싶다~', '깡충깡충! 여기서 뛰어도 돼?', '이 쿠션 위에서 식빵 구워도 돼?', '공 있어? 공놀이 하자!', '삐약삐약~ 노래 들려줄게!', '꽥꽥! 여기 연못은 없어?', '도토리 숨길 곳이 많네!', '데굴데굴~ 바닥이 푹신해!']

/** 친구 이름 부르기: 받침이 있으면 아, 없으면 야 (곰이야, 몽실아) */
const callFriend = (animal: number) => kidWords(CALL_ANIMALS[animal].name).call

export function partyLine(animal: number, others: number[], kidName?: string, rnd: () => number = Math.random): string {
  const r = rnd()
  if (others.length && r < 0.3) {
    const f = others[Math.floor(rnd() * others.length)]
    return TO_FRIEND[Math.floor(rnd() * TO_FRIEND.length)].replace('{friend}', callFriend(f))
  }
  if (r < 0.55) return OWN[animal]
  return SOLO[Math.floor(rnd() * SOLO.length)].replace('{call}', kidWords(kidName).call)
}

/* ---------- 파티 상태: 어느 장소에 누가 와 있는지. 다른 탭(주방)에 다녀와도 친구들이 그대로 기다린다 ---------- */
export interface PartyState { place: string | null; guests: number[] }
const KEY = 'ryuso.party.v1'
export function sanitizeParty(v: unknown): PartyState {
  const r = (v && typeof v === 'object' ? v : {}) as Partial<PartyState>
  const guests = Array.isArray(r.guests) ? [...new Set(r.guests.filter((a) => Number.isInteger(a) && a >= 0 && a < CALL_ANIMALS.length))] : []
  return typeof r.place === 'string' && guests.length ? { place: r.place, guests } : { place: null, guests: [] }
}
let party: PartyState = (() => { try { return sanitizeParty(JSON.parse(localStorage.getItem(KEY) ?? 'null')) } catch { return sanitizeParty(null) } })()
const listeners = new Set<() => void>()
export const getParty = () => party
export const subscribeParty = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export function setPartyState(next: PartyState) {
  party = sanitizeParty(next)
  try { localStorage.setItem(KEY, JSON.stringify(party)) } catch { /* 저장 못 해도 지금 화면에서는 이어 간다 */ }
  listeners.forEach((fn) => fn())
}

/** 파티 친구가 고르는 메뉴(카페 메뉴 중 하나) */
export const partyWish = (rnd: () => number = Math.random) => MENU[Math.floor(rnd() * MENU.length)].id
/** 주문할 때 하는 말 */
export const orderLine = (menuKo: string) => `나는 ${menuKo} 먹고 싶어!`
/** 같이 먹을 때 하는 말 */
const EAT = ['냠냠! 정말 맛있어!', '{call}, 요리 최고야!', '음~ 행복해!', '{call}, 고마워! 또 해 줘!', '같이 먹으니까 더 맛있다!']
export const eatLine = (kidName?: string, rnd: () => number = Math.random) => EAT[Math.floor(rnd() * EAT.length)].replace('{call}', kidWords(kidName).call)
