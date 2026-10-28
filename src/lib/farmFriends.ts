import { CALL_ANIMALS } from './animalCalls'
import { actFarm, getFarm, growth, subscribeFarm } from './farm'

/**
 * 농장 친구들: 고른 동물 친구(최대 2명)가 물이 필요한 밭에 저절로 가서 물을 주고,
 * 수확 버튼을 누르면 다 자란 밭을 모두 돌며 수확한다.
 * 농장 화면 밖(다른 탭)에 있어도 앱이 열려 있는 동안 계속 일해서, 시작한 물 주기는 끝까지 마친다.
 * 화면은 jobs(누가 몇 번 밭에서 무엇을 하는지)만 받아서 그린다.
 */
export type JobKind = 'water' | 'harvest'
export interface FriendJob {
  /** 지금 서 있는(걸어가는) 밭: 다른 줄로 갈 때는 먼저 같은 줄의 그 칸 앞(길목)을 지난다 */
  plot: number
  /** 일할 밭 */
  target: number
  /** 이번 걸음에 걸리는 시간(ms): 거리만큼 */
  walkMs: number
  kind: JobKind
  /** 밭에서 일하는 중(물뿌리개를 기울이거나 바구니에 담는 중). 아니면 밭으로 걸어가는 중이거나 다 하고 잠깐 서 있는 중 */
  watering: boolean
  line: string
  /** 맡은 차례(말풍선은 가장 나중에 일을 맡은 친구 하나만: 겹치지 않게) */
  n: number
}

const KEY = 'ryuso.farm.friends'
export const MAX_FARM_FRIENDS = 2
/** 처음 밭으로 걸어가는 시간, 밭 한 칸 옮기는 데 걸리는 시간, 물 주는 시간, 다음 밭으로 가기 전 잠깐(ms) */
export const WALK_MS = 900, CELL_MS = 520, POUR_MS = 450, REST_MS = 250
const LINES: Record<JobKind, string[]> = {
  water: ['내가 물 줄게!', '쑥쑥 자라라~', '촉촉하게!', '물 주기는 맡겨!'],
  harvest: ['내가 딸게!', '와, 잘 익었다!', '바구니에 쏙!', '수확은 맡겨!'],
}

export function sanitizeFriends(v: unknown): number[] {
  return Array.isArray(v) ? [...new Set(v.filter((a): a is number => Number.isInteger(a) && a >= 0 && a < CALL_ANIMALS.length))].slice(0, MAX_FARM_FRIENDS) : []
}
let friends: number[] = (() => { try { return sanitizeFriends(JSON.parse(localStorage.getItem(KEY) ?? '[]')) } catch { return [] } })()
let jobs: Record<number, FriendJob> = {}
let jobNo = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())
/** 물을 주거나 수확한 순간 알려 준다(농장 화면이 열려 있으면 소리를 낸다) */
let onWatered: ((kind: JobKind) => void) | null = null
/** 수확 버튼을 눌렀다: 다 자란 밭이 남아 있는 동안 친구들이 계속 수확한다 */
let harvesting = false

export const getFarmFriends = () => friends
export const getFriendJobs = () => jobs
export const subscribeFarmFriends = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const setOnWatered = (fn: ((kind: JobKind) => void) | null) => { onWatered = fn }
/** 물주기 버튼: 물이 필요한 밭으로 바로 보낸다 */
export const waterNow = () => { clearTimeout(pendingTimer); dispatch() }
/** 수확 버튼: 다 자란 밭을 친구들이 모두 수확한다(지금 다 자란 밭이 하나도 없으면 false) */
export function harvestAll(now = Date.now()): boolean {
  const st = getFarm()
  if (!st.plots.some((p, i) => st.owned[i] && growth(p, now) === 1)) return false
  harvesting = true
  clearTimeout(pendingTimer)
  dispatch()
  return true
}

export function setFarmFriends(a: number[]) {
  friends = sanitizeFriends(a)
  try { localStorage.setItem(KEY, JSON.stringify(friends)) } catch { /* 저장 못 해도 지금은 같이 한다 */ }
  emit()
  schedule()
}

/** 지금 친구가 맡고 있는 밭인지(아바타가 같은 밭에 가지 않게) */
export const claimed = (plot: number) => Object.values(jobs).some((j) => j.target === plot)

const setJob = (f: number, j: FriendJob | null) => {
  const next = { ...jobs }
  if (j) next[f] = j; else delete next[f]
  jobs = next
  emit()
}

/** 밭 그림의 한 줄 칸 수(세로 그림 4, 가로 그림 5): 농장 화면이 알려 준다. 친구가 둘이면 왼쪽 반·오른쪽 반을 나눠 맡는다 */
let cols = 4
export const setFarmCols = (n: number) => { cols = n }
/** 친구마다 마지막으로 일한 밭(다음에는 거기서 가까운 밭부터) */
const at: Record<number, number> = {}
const rc = (i: number) => ({ r: Math.floor(i / cols), c: i % cols })
/** k 번째 친구가 맡는 칸인지: 혼자면 전부, 둘이면 왼쪽(가운데 줄 포함)·오른쪽 */
const mine = (k: number, i: number) => friends.length < 2 || (k === 0 ? rc(i).c < Math.ceil(cols / 2) : rc(i).c >= Math.ceil(cols / 2))

/** 할 일 목록: 물이 필요한 밭, 수확 버튼을 눌렀으면 다 자란 밭도 */
function workList() {
  const st = getFarm(), now = Date.now()
  const work: { plot: number; kind: JobKind }[] = []
  st.plots.forEach((p, i) => { if (p && p.wateredAt === null && st.owned[i]) work.push({ plot: i, kind: 'water' }) })
  const ripe = st.plots.map((_, i) => i).filter((i) => st.owned[i] && growth(st.plots[i], now) === 1)
  if (harvesting) ripe.forEach((i) => work.push({ plot: i, kind: 'harvest' }))
  if (harvesting && !ripe.length) harvesting = false // 다 수확하면 수확 일은 끝
  return work
}

/** 한 친구가 자기 구역에서 가장 가까운 일을 하나 골라 줄을 따라 걸어가서 하고, 일이 남아 있으면 바로 다음 밭으로 이어 간다 */
function work(f: number) {
  const k = friends.indexOf(f)
  if (k < 0) { setJob(f, null); return }
  const from = at[f]
  const todo = workList().filter((w) => mine(k, w.plot) && !Object.entries(jobs).some(([g, j]) => +g !== f && j.target === w.plot))
  if (!todo.length) { setJob(f, null); return }
  const d = (i: number) => (from === undefined ? rc(i).r * 10 + rc(i).c : Math.abs(rc(i).r - rc(from).r) * 1.5 + Math.abs(rc(i).c - rc(from).c))
  const next = todo.reduce((a, b) => (d(b.plot) < d(a.plot) ? b : a))
  const line = LINES[next.kind][Math.floor(Math.random() * LINES[next.kind].length)]
  const base = { target: next.plot, kind: next.kind, watering: false, line, n: jobs[f]?.n ?? ++jobNo }
  // 다른 줄로 갈 때는 작물 위를 가로지르지 않게 지금 줄을 따라 옆으로 먼저 가고, 그다음 위아래로
  const legs: number[] = []
  if (from !== undefined && rc(from).r !== rc(next.plot).r && rc(from).c !== rc(next.plot).c) legs.push(rc(from).r * cols + rc(next.plot).c)
  legs.push(next.plot)
  let prev = from
  const walk = (n: number) => {
    if (n >= legs.length) return pour()
    const leg = legs[n]
    const ms = prev === undefined ? WALK_MS : Math.max(CELL_MS, (Math.abs(rc(leg).r - rc(prev).r) + Math.abs(rc(leg).c - rc(prev).c)) * CELL_MS)
    setJob(f, { ...base, plot: leg, walkMs: ms })
    prev = leg
    window.setTimeout(() => walk(n + 1), ms)
  }
  const pour = () => {
    setJob(f, { ...base, plot: next.plot, walkMs: 0, watering: true })
    window.setTimeout(() => {
      if (actFarm(next.kind === 'water' ? { type: 'water', plot: next.plot } : { type: 'harvest', plot: next.plot }) === 'saved') onWatered?.(next.kind)
      at[f] = next.plot
      setJob(f, { ...base, plot: next.plot, walkMs: 0 })
      window.setTimeout(() => work(f), REST_MS)
    }, POUR_MS)
  }
  walk(0)
}

/** 쉬고 있는 친구들에게 일을 준다 */
function dispatch() {
  for (const f of friends) if (!jobs[f]) work(f)
}
// 씨앗을 심으면 잠깐(0.5초) 뒤에 친구가 출발한다
let pendingTimer = 0
function schedule() {
  if (!friends.length || typeof window === 'undefined') return
  clearTimeout(pendingTimer)
  pendingTimer = window.setTimeout(dispatch, 500)
}
if (typeof window !== 'undefined') { subscribeFarm(schedule); schedule() }
