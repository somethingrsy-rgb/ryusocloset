import { TILE_W } from './world'

/** 달려라 아바타: 자동으로 달리고 터치하면 점프해서 장애물을 피하며 코인을 모으는 놀이. 논리 좌표는 높이 400 기준 */
export const RUN_H = 400
export const GROUND_Y = 335 // 발이 닿는 바닥 높이
export const PLAYER_W = 84
export const PLAYER_H = 126
/** 화면에서 아바타가 서 있는 가로 위치(월드 x 에서 카메라 앞쪽으로 얼마나 떨어졌는지) */
export const PLAYER_SCREEN_X = 110
/** 시작 하트: 단계마다 정한 개수 */
export const startHearts = (level: LevelId) => LEVELS[level].hearts
const GRAVITY = 1300
const JUMP_V = 554
/** 단계(난이도) 1~10: 속도, 빨라지는 정도(1초마다), 장애물 사이 간격, 장애물이 나오는 칸 비율, 달리는 시간,
 *  부딪힌 뒤 무적 시간(초), 시작 하트. 1~3단계는 예전 초급·중급·고급 그대로(저장된 단계·기록이 이어지게 이름도 그대로) */
export type LevelId = 'easy' | 'normal' | 'hard' | 'l4' | 'l5' | 'l6' | 'l7' | 'l8' | 'l9' | 'l10'
export const LEVEL_IDS: readonly LevelId[] = ['easy', 'normal', 'hard', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10']
export const LEVELS: Record<LevelId, { speed: number; up: number; slot: number; chance: number; duration: number; invuln: number; hearts: number }> = {
  easy: { speed: 165, up: 1, slot: 600, chance: 0.6, duration: 40, invuln: 1.2, hearts: 5 },
  normal: { speed: 235, up: 3, slot: 560, chance: 0.74, duration: 45, invuln: 1.2, hearts: 3 },
  hard: { speed: 300, up: 4, slot: 640, chance: 0.86, duration: 50, invuln: 1.2, hearts: 3 },
  l4: { speed: 320, up: 4, slot: 660, chance: 0.9, duration: 50, invuln: 1.1, hearts: 3 },
  l5: { speed: 340, up: 4.5, slot: 700, chance: 0.92, duration: 55, invuln: 1, hearts: 3 },
  l6: { speed: 360, up: 4.5, slot: 700, chance: 0.93, duration: 55, invuln: 1, hearts: 3 },
  l7: { speed: 380, up: 5, slot: 760, chance: 0.94, duration: 60, invuln: 0.9, hearts: 3 },
  l8: { speed: 400, up: 5, slot: 760, chance: 0.95, duration: 60, invuln: 0.8, hearts: 3 },
  l9: { speed: 420, up: 5, slot: 770, chance: 0.97, duration: 60, invuln: 0.7, hearts: 2 },
  l10: { speed: 440, up: 5, slot: 780, chance: 0.98, duration: 60, invuln: 0.6, hearts: 2 },
}
/** 화면에 보이는 단계 이름 */
export const levelName = (l: LevelId) => `${LEVEL_IDS.indexOf(l) + 1}단계`
export const DEFAULT_LEVEL: LevelId = 'normal'
export const runDuration = (l: LevelId) => LEVELS[l].duration
const FIRST_SLOT = 760
const BOOST_TIME = 0.18
const BOOST_V = 380 // 두 번째 점프로 더해지는 속도(부드럽게 BOOST_TIME 동안)
const JUMP2_CAP = 420 // 두 번째 점프 뒤 올라가는 속도의 한도: 일찍 눌러도 너무 높이 솟지 않는다

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
const OBSTACLE_H = 56
/** 달린 거리 x 지점의 배경 구간 */
export const zoneAt = (x: number) => {
  const u = (((BG_START + x * BG_PER_RUN) % TILE_W) + TILE_W) % TILE_W
  return (ZONES.find((z) => u < z.to * 1.3) ?? ZONES[ZONES.length - 1]).id
}
/** w, h 는 부딪히는 크기, dw 는 그림을 그리는 너비(높이는 h) */
export interface Obstacle { id: number; x: number; w: number; h: number; dw: number; img: string }
export interface Coin { id: number; x: number; y: number }
/** 높은 곳에 뜬 선물 상자: 한 번 뛰어서는 못 닿고, 공중에서 한 번 더 뛰어야 닿는다 */
export interface Gift { id: number; x: number; y: number }
export const GIFT_Y = 240
/** 두 번 점프로 올라갈 수 있는 가장 높은 곳(테스트로 확인): 아바타 그림을 얼마나 키울 수 있는지 정할 때 쓴다 */
export const MAX_RISE = 217
export interface RunState {
  elapsed: number
  x: number // 달린 거리
  y: number // 바닥에서 위로 뜬 높이(0 이면 땅)
  vy: number
  hearts: number
  coins: number
  /** 모은 선물 상자 수 */
  gifts: number
  /** 화면이 넓을수록 빨리 달린다(화면을 가로지르는 데 걸리는 시간이 폰과 비슷하도록). 장애물 간격도 같은 비율로 넓힌다. 1 이면 폰 세로 화면 */
  k: number
  /** 두 번째 점프로 솟는 힘이 남은 시간(초): 한 번에 튀지 않고 부드럽게 솟는다 */
  boost: number
  /** 두 번째 점프로 올라가야 할 목표 속도 */
  boostTo: number
  /** 지금 점프에서 뛴 횟수(땅에 닿으면 0, 최대 2) */
  jumps: number
  invuln: number
  /** 이미 먹은 코인 id */
  taken: number[]
  seed: number
  level: LevelId
  over: false | 'done' | 'hurt'
  /** 막 일어난 일(소리·효과용): 한 번 읽으면 지움 */
  events: ('coin' | 'hit' | 'jump' | 'gift')[]
}

export const newRun = (seed = Math.floor(Math.random() * 1e9), level: LevelId = DEFAULT_LEVEL, k = 1): RunState => ({ elapsed: 0, x: 0, y: 0, vy: 0, hearts: startHearts(level), coins: 0, gifts: 0, k, boost: 0, boostTo: 0, jumps: 0, invuln: 0, taken: [], seed, level, over: false, events: [] })

const rng = (seed: number, i: number) => {
  let h = Math.imul(seed ^ Math.imul(i + 1, 2654435761), 2246822519)
  h = Math.imul(h ^ (h >>> 13), 3266489917)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** 월드를 칸(슬롯)으로 나눠, 같은 씨앗이면 늘 같은 장애물·코인이 나온다. 장애물 사이는 항상 점프할 만큼 떨어져 있다 */
export function slotContent(seed: number, slot: number, level: LevelId = DEFAULT_LEVEL, k = 1): { obstacle?: Obstacle; coins: Coin[]; gift?: Gift } {
  const x = FIRST_SLOT * k + slot * LEVELS[level].slot * k
  const r = rng(seed, slot)
  const coins: Coin[] = []
  if (r < LEVELS[level].chance) {
    const pick = Math.min(2, Math.floor(rng(seed, slot + 5000) * 3))
    const img = `${zoneAt(x)}_${pick}`
    const aspect = ASPECT[img]
    const o: Obstacle = { id: slot * 10, x, w: Math.min(84, Math.round(OBSTACLE_H * aspect * 0.6)), h: OBSTACLE_H, dw: Math.round(OBSTACLE_H * aspect), img }
    // 장애물 위 공중에 코인 호(점프하면 먹는다)
    ;[-1, 0, 1].forEach((k, j) => coins.push({ id: slot * 10 + 1 + j, x: x + k * 70, y: 110 + (k === 0 ? 40 : 0) }))
    return { obstacle: o, coins }
  }
  // 장애물 없는 칸: 바닥 코인 줄. 가끔 높이 뜬 선물 상자(첫 칸들은 제외)
  for (let j = 0; j < 4; j++) coins.push({ id: slot * 10 + 1 + j, x: x - 90 + j * 60, y: 38 })
  if (slot >= 3 && rng(seed, slot + 9000) < 0.4) return { coins, gift: { id: slot * 10 + 9, x, y: GIFT_Y } }
  return { coins }
}

export function visible(seed: number, fromX: number, toX: number, level: LevelId = DEFAULT_LEVEL, k = 1) {
  const SLOT = LEVELS[level].slot * k
  const a = Math.max(0, Math.floor((fromX - FIRST_SLOT * k - 160) / SLOT))
  const b = Math.max(a, Math.ceil((toX - FIRST_SLOT * k + 160) / SLOT))
  const obstacles: Obstacle[] = []
  const coins: Coin[] = []
  const gifts: Gift[] = []
  for (let s = a; s <= b; s++) {
    const c = slotContent(seed, s, level, k)
    if (c.obstacle) obstacles.push(c.obstacle)
    coins.push(...c.coins)
    if (c.gift) gifts.push(c.gift)
  }
  return { obstacles, coins, gifts }
}

export const speedAt = (elapsed: number, level: LevelId = DEFAULT_LEVEL) => LEVELS[level].speed + LEVELS[level].up * elapsed

export function jump(s: RunState): RunState {
  if (s.over) return s
  const air = s.y > 0.5
  if (air && s.jumps >= 2) return s // 공중에서는 한 번만 더(두 번 점프)
  // 두 번째 점프는 속도를 한 번에 바꾸지 않고, 올라가던(또는 내려가던) 속도에서 짧은 시간 동안 부드럽게 밀어 올린다
  if (air) return { ...s, jumps: 2, boost: BOOST_TIME, boostTo: Math.min(s.vy + BOOST_V, JUMP2_CAP), events: [...s.events, 'jump'] }
  return { ...s, vy: JUMP_V, jumps: 1, events: [...s.events, 'jump'] }
}

/** 한 프레임 진행. 장애물에 닿으면 하트 -1 (잠깐 안 닿게 깜빡이며 계속 달린다), 하트가 0 이면 끝 */
export function stepRun(s: RunState, dt: number): RunState {
  if (s.over) return s
  const elapsed = s.elapsed + dt
  const x = s.x + speedAt(s.elapsed, s.level) * s.k * dt
  let vy = s.vy - GRAVITY * dt
  if (s.boost > 0 && vy < s.boostTo) vy += (s.boostTo - vy) * Math.min(1, dt / Math.max(dt, s.boost))
  let y = s.y + vy * dt
  let jumps = s.jumps
  if (y <= 0) { y = 0; vy = 0; jumps = 0 }
  let { hearts, coins, gifts, taken } = s
  const events: RunState['events'] = [...s.events]
  const invuln = Math.max(0, s.invuln - dt)
  const px = x + PLAYER_SCREEN_X // 아바타의 월드 위치
  const { obstacles, coins: cs, gifts: gs } = visible(s.seed, px - 200 * s.k, px + 200 * s.k, s.level, s.k)
  let hurt = false
  if (invuln === 0) {
    for (const o of obstacles) {
      const overlapX = px + PLAYER_W * 0.18 > o.x - o.w / 2 && px - PLAYER_W * 0.18 < o.x + o.w / 2
      if (overlapX && y < o.h - 12) { hurt = true; break }
    }
  }
  if (hurt) { hearts -= 1; events.push('hit') }
  for (const c of cs) {
    if (taken.includes(c.id)) continue
    if (Math.abs(c.x - px) < 46 * s.k && Math.abs(c.y - (y + PLAYER_H * 0.45)) < 56) { coins += 1; taken = [...taken, c.id]; events.push('coin') }
  }
  for (const g of gs) {
    if (taken.includes(g.id)) continue
    if (Math.abs(g.x - px) < 54 * s.k && Math.abs(g.y - (y + PLAYER_H * 0.45)) < 40) { gifts += 1; taken = [...taken, g.id]; events.push('gift') }
  }
  let over: RunState['over'] = false
  if (hearts <= 0) over = 'hurt'
  else if (elapsed >= LEVELS[s.level].duration) over = 'done'
  return { ...s, elapsed, x, y, vy, jumps, boost: Math.max(0, s.boost - dt), hearts, coins, gifts, taken, invuln: hurt ? LEVELS[s.level].invuln : invuln, over, events }
}

/** 별 보상: 먹은 별 1개당 별 1개. 끝까지 달려도 보너스는 없고, 하트를 다 써서 끝나도 먹은 별은 받는다 */
export const rewardStars = (s: Pick<RunState, 'coins' | 'over'>) => s.coins

const KEY = 'ryuso.runner.v1'
const LEVEL_KEY = 'ryuso.runner.level.v1'
export interface RunRecord { best: Record<LevelId, number>; rounds: number }
const num0 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0)
export function readRunRecord(): RunRecord {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v && typeof v === 'object') {
      // 예전 기록(best 숫자 하나)은 중급 기록으로 이어받는다
      const b = typeof v.best === 'object' && v.best ? v.best : { normal: v.best }
      return { best: Object.fromEntries(LEVEL_IDS.map((l) => [l, num0(b[l])])) as Record<LevelId, number>, rounds: num0(v.rounds) }
    }
  } catch { /* 읽지 못하면 새로 */ }
  return { best: Object.fromEntries(LEVEL_IDS.map((l) => [l, 0])) as Record<LevelId, number>, rounds: 0 }
}
export function writeRunRecord(stars: number, level: LevelId): RunRecord {
  const old = readRunRecord()
  const next = { best: { ...old.best, [level]: Math.max(old.best[level], stars) }, rounds: old.rounds + 1 }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* 저장 실패는 무시 */ }
  return next
}
export function readRunLevel(): LevelId {
  try { const v = localStorage.getItem(LEVEL_KEY); return LEVEL_IDS.find((l) => l === v) ?? DEFAULT_LEVEL } catch { return DEFAULT_LEVEL }
}
export function writeRunLevel(l: LevelId) {
  try { localStorage.setItem(LEVEL_KEY, l) } catch { /* 저장 실패는 무시 */ }
}
