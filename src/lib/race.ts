/**
 * 자동차 레이스(혼자 달리기): 규칙만 담은 순수 계산. 그림(Race3D)과 화면(RaceGame)은 이 상태를 읽기만 한다.
 * - 길은 세 칸(왼쪽·가운데·오른쪽). 차는 저절로 달리고, 좌/우를 누르면 옆 칸으로 옮겨 간다.
 * - 별 코인은 모이고, 부스터는 잠깐 빨라지고, 바나나·물웅덩이는 잠깐 느려진다. 부딪혀도 점수를 깎거나 혼내지 않는다.
 * - 아이템 자리는 거리(d)와 씨앗(seed)만으로 정해진다: 같은 씨앗이면 누구에게나 같은 길(같이 놀기에서 그대로 쓴다).
 */
/** 칸 번호: 3칸이면 -1~1, 5칸이면 -2~2 */
export type Lane = number
export type ItemKind = 'star' | 'boost' | 'banana' | 'puddle'
export interface RaceItem { id: number; d: number; lane: Lane; kind: ItemKind }
export type RaceEvent = 'star' | 'boost' | 'slip'

/** 한 바퀴 길이 · 바퀴 수 · 제한 시간(초) */
export const LAP = 800
export const LAPS = 2
export const TIME_LIMIT = 60
/** 한 칸 너비(장면 단위) */
export const LANE_W = 1.7
export const COUNTDOWN = 3
/** 결승선을 지나고 천천히 달리는 시간(초) */
export const COAST_T = 2
const CRUISE = 30
const BOOST_K = 1.6, BOOST_T = 2
const SLOW_K = 0.5, SLOW_T = 1.5
const BRAKE_K = 0.6
const ACCEL = 40
/** 옆으로 미끄러지는 느낌: 용수철처럼 목표 칸으로 다가가며 속도가 부드럽게 붙고 줄어든다(부딪히지 않고 미끄러지듯) */
const SPRING = 70, DAMP = 2 * Math.sqrt(SPRING) * 0.92
export function glide(x: number, vx: number, target: number, dt: number, limit = 1.2): [number, number] {
  const v = vx + (SPRING * (target - x) - DAMP * vx) * dt
  return [Math.max(-limit, Math.min(limit, x + v * dt)), v]
}
/** 컴퓨터 친구 차 */
export const MAX_RIVALS = 3
/** 아이템 줄 간격과 시작 거리 */
const SEG = 36, FIRST = 60
/** 부딪힘: 옆으로 이 거리(칸)보다 가까우면 닿은 것 */
const REACH = 0.6

/** 같이 달리는 컴퓨터 친구 차 */
export interface Rival {
  id: number
  /** 동물 친구 번호(그림용) */
  animal: number
  d: number; x: number; vx: number; lane: Lane
  speed: number; boost: number; slow: number
  /** 달리는 솜씨(0.94~1.04) */
  skill: number
  /** 결승선을 지난 시간(초), 아직이면 null */
  fin: number | null
}

export interface Race {
  seed: number
  /** 길 칸 수: 혼자는 3칸, 친구와 함께는 5칸 */
  lanes: 3 | 5
  phase: 'count' | 'run' | 'done'
  /** 남은 카운트다운(초) */
  count: number
  /** 달린 시간(초) */
  t: number
  /** 달린 거리 */
  d: number
  /** 가려는 칸 / 지금 옆 위치(-1~1, 부드럽게 옮겨 간다) */
  lane: Lane
  x: number
  /** 옆으로 움직이는 속도(칸/초): 차가 기우는 모양에 쓴다 */
  vx: number
  speed: number
  boost: number
  slow: number
  brake: boolean
  /** 별·부스터를 먹은 뒤 반짝이가 보이는 남은 시간 / 미끄러진 뒤 먼지가 보이는 남은 시간(그림용) */
  sparkle: number
  dust: number
  stars: number
  /** 먹은 아이템(그림에서 지우려고) */
  taken: number[]
  /** 이번 프레임에 일어난 일(소리·말풍선용) */
  events: RaceEvent[]
  /** 컴퓨터 친구 차들(없으면 혼자) */
  rivals: Rival[]
  /** 끝났을 때 내 순위(1부터, 친구가 없으면 0) */
  rank: number
  /** 결승선을 지난 뒤 지나간 시간(초): 바로 멈추지 않고 선을 지나 천천히 달리게 한다 */
  after: number
  /** 끝난 이유 */
  finish: null | 'laps' | 'time'
}

/** animals: 같이 달릴 동물 친구 번호들(최대 3). 비우면 혼자 달린다 */
/** 친구 차가 서는 첫 칸(5칸 길 기준) */
const START_LANES = [-2, 2, 1]
export const halfLanes = (r: { lanes: number }) => (r.lanes - 1) / 2
export const newRace = (seed = Math.floor(Math.random() * 1e6), animals: number[] = []): Race => ({
  seed, lanes: animals.length ? 5 : 3, phase: 'count', count: COUNTDOWN, t: 0, d: 0, lane: 0, x: 0, vx: 0, speed: 0, boost: 0, slow: 0, brake: false, sparkle: 0, dust: 0, stars: 0, taken: [], events: [], after: 0, finish: null,
  rivals: animals.slice(0, MAX_RIVALS).map((animal, i) => ({ id: i, animal, d: i === 2 ? 8 : 0, x: START_LANES[i], vx: 0, lane: START_LANES[i], speed: 0, boost: 0, slow: 0, skill: 0.95 + ((seed >>> (i * 3)) % 9) * 0.011, fin: null })),
  rank: 0,
})

/** 같은 (칸 번호, 씨앗, 용도)면 늘 같은 0~1 수 */
function rand(seg: number, seed: number, k: number): number {
  let h = (seg * 374761393 + seed * 668265263 + k * 2246822519) >>> 0
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h / 4294967296
}

/** (from, to] 거리 안의 아이템. 별은 세 개씩 줄지어 나온다 */
export function itemsBetween(from: number, to: number, seed: number, lanes: 3 | 5 = 3): RaceItem[] {
  const out: RaceItem[] = []
  const s0 = Math.max(0, Math.floor((from - FIRST - 14) / SEG)), s1 = Math.floor((to - FIRST) / SEG)
  for (let s = s0; s <= s1; s++) {
    const d0 = FIRST + s * SEG
    const u = rand(s, seed, 0)
    const lane = Math.floor(rand(s, seed, 1) * lanes) - (lanes - 1) / 2
    const add = (k: number, d: number, kind: ItemKind) => { if (d > from && d <= to) out.push({ id: s * 10 + k, d, lane, kind }) }
    if (u < 0.45) { add(0, d0, 'star'); add(1, d0 + 6, 'star'); add(2, d0 + 12, 'star') }
    else if (u < 0.6) add(0, d0, 'boost')
    else if (u < 0.8) add(0, d0, 'banana')
    else if (u < 0.92) add(0, d0, 'puddle')
  }
  return out
}

/** 옆 칸으로(-1 왼쪽, 1 오른쪽). 끝 칸에서는 그대로 */
export function steer(r: Race, dir: -1 | 1): Race {
  if (r.phase === 'done') return r
  const h = halfLanes(r), lane = Math.max(-h, Math.min(h, r.lane + dir))
  return lane === r.lane ? r : { ...r, lane }
}
export const setBrake = (r: Race, on: boolean): Race => (r.brake === on ? r : { ...r, brake: on })

/** 컴퓨터 친구 한 대가 dt 초 달린다(me 는 내 차: 너무 앞서거나 뒤처지면 조금 따라잡고 봐주며 가까이 달리게) */
function stepRival(v: Rival, me: Race, dt: number, running: boolean): Rival {
  // 2초마다 칸을 다시 고른다: 바나나·물웅덩이는 대개 피하고, 부스터가 있으면 가끔 그쪽으로
  const win = Math.floor(me.t / 2)
  let lane = v.lane
  if (running && me.t > 0.5) {
    const h = halfLanes(me), all = Array.from({ length: me.lanes }, (_, i) => i - h)
    const ahead = itemsBetween(v.d, v.d + 45, me.seed, me.lanes)
    const bad = ahead.some((it) => (it.kind === 'banana' || it.kind === 'puddle') && it.lane === lane)
    const pick = Math.floor(rand(win, me.seed, 11 + v.id) * me.lanes) - h
    if (bad && rand(win, me.seed, 21 + v.id) < 0.8) lane = all.find((l) => !ahead.some((it) => (it.kind === 'banana' || it.kind === 'puddle') && it.lane === l)) ?? lane
    else if (rand(win, me.seed, 31 + v.id) < 0.35) lane = pick
    const boost = ahead.find((it) => it.kind === 'boost')
    if (boost && rand(win, me.seed, 41 + v.id) < 0.5) lane = boost.lane
  }
  const [x, vx] = glide(v.x, v.vx, lane, dt, halfLanes(me) + 0.2)
  if (!running) return { ...v, lane, x, vx }
  let { boost, slow } = v
  boost = Math.max(0, boost - dt); slow = Math.max(0, slow - dt)
  const gap = v.d - me.d
  const near = gap < -50 ? 1.1 : gap > 50 ? 0.92 : 1
  const want = CRUISE * v.skill * near * (boost > 0 ? BOOST_K : 1) * (slow > 0 ? SLOW_K : 1) * (v.fin !== null ? 0.3 : 1)
  const speed = v.speed < want ? Math.min(want, v.speed + ACCEL * dt) : Math.max(want, v.speed - ACCEL * 1.5 * dt)
  const prev = v.d, d = v.d + speed * dt
  if (v.fin === null) {
    for (const it of itemsBetween(prev, d, me.seed, me.lanes)) {
      if (Math.abs(it.lane - x) >= REACH) continue
      if (it.kind === 'boost') { boost = BOOST_T; slow = 0 } else if (it.kind !== 'star') { slow = SLOW_T; boost = 0 }
    }
  }
  return { ...v, lane, x, vx, d, speed, boost, slow, fin: v.fin === null && d >= LAP * LAPS ? me.t : v.fin }
}
const stepRivals = (r: Race, dt: number, running: boolean) => r.rivals.map((v) => stepRival(v, r, dt, running))
/** 내 순위: 결승선을 먼저 지났거나 더 앞에 있는 친구 수 + 1 */
export const rankNow = (r: Race) => r.rivals.length ? 1 + r.rivals.filter((v) => v.fin !== null || v.d > r.d).length : 0

/** 시간이 dt 초 흐른다 */
export function stepRace(r: Race, dt: number): Race {
  if (r.phase === 'done') return r
  const events: RaceEvent[] = []
  let { count, t, d, speed, boost, slow, stars, sparkle, dust } = r
  let phase: Race['phase'] = r.phase, finish: Race['finish'] = r.finish
  const taken = [...r.taken]
  // 옆으로 부드럽게
  const [x, vx] = glide(r.x, r.vx, r.lane, dt, halfLanes(r) + 0.2)
  // 결승선을 지났으면: 놀라지 않게 천천히 줄여 가며 선 너머까지 달리고, 아이템은 건드리지 않는다
  if (r.finish === 'laps') {
    const after = r.after + dt
    const speed = Math.max(8, r.speed - 18 * dt)
    return { ...r, x, vx, after, speed, d: r.d + speed * dt, phase: after >= COAST_T ? 'done' : 'run', events: [], sparkle: Math.max(0, r.sparkle - dt), dust: Math.max(0, r.dust - dt), boost: 0, slow: 0, rivals: stepRivals(r, dt, true) }
  }
  if (phase === 'count') {
    count -= dt
    if (count <= 0) { phase = 'run'; count = 0 }
    return { ...r, count, phase, x, vx, events, rivals: stepRivals(r, dt, false) }
  }
  t += dt
  boost = Math.max(0, boost - dt); slow = Math.max(0, slow - dt); sparkle = Math.max(0, sparkle - dt); dust = Math.max(0, dust - dt)
  const want = CRUISE * (r.brake ? BRAKE_K : 1) * (boost > 0 ? BOOST_K : 1) * (slow > 0 ? SLOW_K : 1)
  speed = speed < want ? Math.min(want, speed + ACCEL * dt) : Math.max(want, speed - ACCEL * 1.5 * dt)
  const prev = d
  d += speed * dt
  for (const it of itemsBetween(prev, d, r.seed, r.lanes)) {
    if (Math.abs(it.lane - x) >= REACH) continue
    if (it.kind === 'star') { stars++; sparkle = 0.5; taken.push(it.id); events.push('star') }
    else if (it.kind === 'boost') { boost = BOOST_T; slow = 0; sparkle = 0.6; taken.push(it.id); events.push('boost') }
    else { slow = SLOW_T; boost = 0; dust = 0.7; events.push('slip') }
  }
  const rivals = stepRivals({ ...r, t, d }, dt, true)
  let rank = r.rank
  if (d >= LAP * LAPS) { finish = 'laps'; rank = rankNow({ ...r, d, rivals }) }
  else if (t >= TIME_LIMIT) { phase = 'done'; finish = 'time'; rank = rankNow({ ...r, d, rivals }) }
  return { ...r, rivals, rank, vx, phase, count, t, d, x, after: 0, speed, boost, slow, sparkle, dust, stars, taken: taken.slice(-60), events, finish }
}

/** 지금 몇 바퀴째(1부터) */
export const lapOf = (r: Race) => Math.min(LAPS, Math.floor(r.d / LAP) + 1)
/** 남은 시간(초) */
export const timeLeft = (r: Race) => Math.max(0, Math.ceil(TIME_LIMIT - r.t))

/** 끝나고 받는 별: 모은 별(최대 12) + 두 바퀴를 다 달리면 3, 시간이 다 되어도 1. 꼴등이어도 늘 받는다 */
export function rewardStars(r: Race): number {
  if (r.phase !== 'done') return 0
  // 친구와 달렸으면 순위 선물: 1등 3개, 2등 2개, 3등 1개(꼴등도 위의 별은 그대로 받는다)
  const bonus = r.rivals.length ? Math.max(0, 4 - r.rank) : 0
  return Math.min(12, r.stars) + (r.finish === 'laps' ? 3 : 1) + bonus
}
