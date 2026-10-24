import { TILE_W } from './world'

/** 달려라 아바타: 자동으로 달리고 터치하면 점프해서 장애물을 피하며 코인을 모으는 놀이. 논리 좌표는 높이 400 기준 */
export const RUN_H = 400
export const GROUND_Y = 335 // 발이 닿는 바닥 높이
export const PLAYER_W = 70
export const PLAYER_H = 105
/** 화면에서 아바타가 서 있는 가로 위치(월드 x 에서 카메라 앞쪽으로 얼마나 떨어졌는지) */
export const PLAYER_SCREEN_X = 110
export const RUN_DURATION = 45
export const START_HEARTS = 3
export const FINISH_BONUS = 10
const SPEED0 = 210
const SPEED_UP = 2 // 1초마다 빨라지는 양
const GRAVITY = 2000
const JUMP_V = 900
const SLOT = 560
const FIRST_SLOT = 760
const INVULN = 1.2

/** 배경 그림은 달린 거리 1 당 이만큼(그림 단위) 흐른다. 시작 위치는 첫 집 앞쪽 */
export const BG_PER_RUN = 1.2
export const BG_START = 1200

/** 배경 길 그림(한 바퀴 = TILE_W)의 구간별 장애물 그림 묶음. 경계는 원본 그림 가로 px(×1.3 이 그림 단위) */
export const ZONES = [
  { id: 'spring', to: 4800 },
  { id: 'alice', to: 9600 },
  { id: 'palace', to: 11600 },
  { id: 'halloween', to: 13800 },
  { id: 'autumn', to: 17200 },
  { id: 'christmas', to: 19200 },
] as const
/** 그림 가로/세로 비율(public/assets/runner/<구간>_<번호>.webp) */
const ASPECT: Record<string, number> = { spring_0: 1.211, spring_1: 1, spring_2: 1.316, alice_0: 1.164, alice_1: 0.941, alice_2: 0.988, christmas_0: 1.078, christmas_1: 0.871, christmas_2: 0.703, autumn_0: 1.215, autumn_1: 0.93, autumn_2: 1.145, halloween_0: 1.062, halloween_1: 1.035, halloween_2: 0.895, palace_0: 1.066, palace_1: 0.914, palace_2: 1.074 }
const OBSTACLE_H = 68
/** 달린 거리 x 지점의 배경 구간 */
export const zoneAt = (x: number) => {
  const u = (((BG_START + x * BG_PER_RUN) % TILE_W) + TILE_W) % TILE_W
  return (ZONES.find((z) => u < z.to * 1.3) ?? ZONES[ZONES.length - 1]).id
}
/** w, h 는 부딪히는 크기, dw 는 그림을 그리는 너비(높이는 h) */
export interface Obstacle { id: number; x: number; w: number; h: number; dw: number; img: string }
export interface Coin { id: number; x: number; y: number }
export interface RunState {
  elapsed: number
  x: number // 달린 거리
  y: number // 바닥에서 위로 뜬 높이(0 이면 땅)
  vy: number
  hearts: number
  coins: number
  invuln: number
  /** 이미 먹은 코인 id */
  taken: number[]
  seed: number
  over: false | 'done' | 'hurt'
  /** 막 일어난 일(소리·효과용): 한 번 읽으면 지움 */
  events: ('coin' | 'hit' | 'jump')[]
}

export const newRun = (seed = Math.floor(Math.random() * 1e9)): RunState => ({ elapsed: 0, x: 0, y: 0, vy: 0, hearts: START_HEARTS, coins: 0, invuln: 0, taken: [], seed, over: false, events: [] })

const rng = (seed: number, i: number) => {
  let h = Math.imul(seed ^ Math.imul(i + 1, 2654435761), 2246822519)
  h = Math.imul(h ^ (h >>> 13), 3266489917)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** 월드를 칸(슬롯)으로 나눠, 같은 씨앗이면 늘 같은 장애물·코인이 나온다. 장애물 사이는 항상 점프할 만큼 떨어져 있다 */
export function slotContent(seed: number, slot: number): { obstacle?: Obstacle; coins: Coin[] } {
  const x = FIRST_SLOT + slot * SLOT
  const r = rng(seed, slot)
  const coins: Coin[] = []
  if (r < 0.62) {
    const pick = Math.min(2, Math.floor(rng(seed, slot + 5000) * 3))
    const img = `${zoneAt(x)}_${pick}`
    const aspect = ASPECT[img]
    const o: Obstacle = { id: slot * 10, x, w: Math.min(56, Math.round(OBSTACLE_H * aspect * 0.7)), h: OBSTACLE_H, dw: Math.round(OBSTACLE_H * aspect), img }
    // 장애물 위 공중에 코인 호(점프하면 먹는다)
    ;[-1, 0, 1].forEach((k, j) => coins.push({ id: slot * 10 + 1 + j, x: x + k * 56, y: 110 + (k === 0 ? 40 : 0) }))
    return { obstacle: o, coins }
  }
  // 장애물 없는 칸: 바닥 코인 줄
  for (let j = 0; j < 4; j++) coins.push({ id: slot * 10 + 1 + j, x: x - 90 + j * 60, y: 38 })
  return { coins }
}

export function visible(seed: number, fromX: number, toX: number) {
  const a = Math.max(0, Math.floor((fromX - FIRST_SLOT - 160) / SLOT))
  const b = Math.max(a, Math.ceil((toX - FIRST_SLOT + 160) / SLOT))
  const obstacles: Obstacle[] = []
  const coins: Coin[] = []
  for (let s = a; s <= b; s++) {
    const c = slotContent(seed, s)
    if (c.obstacle) obstacles.push(c.obstacle)
    coins.push(...c.coins)
  }
  return { obstacles, coins }
}

export const speedAt = (elapsed: number) => SPEED0 + SPEED_UP * elapsed

export function jump(s: RunState): RunState {
  if (s.over || s.y > 0.5) return s
  return { ...s, vy: JUMP_V, events: [...s.events, 'jump'] }
}

/** 한 프레임 진행. 장애물에 닿으면 하트 -1 (잠깐 안 닿게 깜빡이며 계속 달린다), 하트가 0 이면 끝 */
export function stepRun(s: RunState, dt: number): RunState {
  if (s.over) return s
  const elapsed = s.elapsed + dt
  const x = s.x + speedAt(s.elapsed) * dt
  let vy = s.vy - GRAVITY * dt
  let y = s.y + vy * dt
  if (y <= 0) { y = 0; vy = 0 }
  let { hearts, coins, taken } = s
  const events: RunState['events'] = [...s.events]
  const invuln = Math.max(0, s.invuln - dt)
  const px = x + PLAYER_SCREEN_X // 아바타의 월드 위치
  const { obstacles, coins: cs } = visible(s.seed, px - 200, px + 200)
  let hurt = false
  if (invuln === 0) {
    for (const o of obstacles) {
      const overlapX = px + PLAYER_W * 0.22 > o.x - o.w / 2 && px - PLAYER_W * 0.22 < o.x + o.w / 2
      if (overlapX && y < o.h - 8) { hurt = true; break }
    }
  }
  if (hurt) { hearts -= 1; events.push('hit') }
  for (const c of cs) {
    if (taken.includes(c.id)) continue
    if (Math.abs(c.x - px) < 38 && Math.abs(c.y - (y + PLAYER_H * 0.45)) < 52) { coins += 1; taken = [...taken, c.id]; events.push('coin') }
  }
  let over: RunState['over'] = false
  if (hearts <= 0) over = 'hurt'
  else if (elapsed >= RUN_DURATION) over = 'done'
  return { ...s, elapsed, x, y, vy, hearts, coins, taken, invuln: hurt ? INVULN : invuln, over, events }
}

/** 별 보상: 모은 코인 1개당 별 1개, 끝까지 달리면 보너스. 하트를 다 써서 끝나도 모은 코인은 받는다 */
export const rewardStars = (s: Pick<RunState, 'coins' | 'over'>) => s.coins + (s.over === 'done' ? FINISH_BONUS : 0)

const KEY = 'ryuso.runner.v1'
export interface RunRecord { best: number; rounds: number }
export function readRunRecord(): RunRecord {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && Number.isFinite(v.best) && Number.isFinite(v.rounds)) return { best: Math.max(0, v.best), rounds: Math.max(0, v.rounds) }
  } catch { /* 읽지 못하면 새로 */ }
  return { best: 0, rounds: 0 }
}
export function writeRunRecord(stars: number): RunRecord {
  const old = readRunRecord()
  const next = { best: Math.max(old.best, stars), rounds: old.rounds + 1 }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* 저장 실패는 무시 */ }
  return next
}
