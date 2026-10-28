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
  plot: number
  kind: JobKind
  /** 밭에서 일하는 중(물뿌리개를 기울이거나 바구니에 담는 중). 아니면 밭으로 걸어가는 중이거나 다 하고 잠깐 서 있는 중 */
  watering: boolean
  line: string
  /** 맡은 차례(말풍선은 가장 나중에 일을 맡은 친구 하나만: 겹치지 않게) */
  n: number
}

const KEY = 'ryuso.farm.friends'
export const MAX_FARM_FRIENDS = 2
/** 걸어가는 시간, 물 주는 시간, 다 주고 서 있는 시간(ms) */
export const WALK_MS = 900, POUR_MS = 450, REST_MS = 500
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
export const claimed = (plot: number) => Object.values(jobs).some((j) => j.plot === plot)

const setJob = (f: number, j: FriendJob | null) => {
  const next = { ...jobs }
  if (j) next[f] = j; else delete next[f]
  jobs = next
  emit()
}

/** 쉬고 있는 친구를 일이 있는 밭으로 보낸다: 물이 필요한 밭 먼저, 수확 버튼을 눌렀으면 다 자란 밭도 */
function dispatch() {
  const st = getFarm(), now = Date.now()
  const work: { plot: number; kind: JobKind }[] = []
  st.plots.forEach((p, i) => { if (p && p.wateredAt === null && st.owned[i] && !claimed(i)) work.push({ plot: i, kind: 'water' }) })
  const ripe = st.plots.map((_, i) => i).filter((i) => st.owned[i] && growth(st.plots[i], now) === 1)
  if (harvesting) ripe.filter((i) => !claimed(i)).forEach((i) => work.push({ plot: i, kind: 'harvest' }))
  // 맡은 밭까지 다 수확하면 수확 일은 끝
  if (harvesting && !ripe.length) harvesting = false
  for (const { plot: i, kind } of work) {
    const f = friends.find((x) => !jobs[x])
    if (f === undefined) return
    setJob(f, { plot: i, kind, watering: false, line: LINES[kind][Math.floor(Math.random() * LINES[kind].length)], n: ++jobNo })
    window.setTimeout(() => {
      if (jobs[f]) setJob(f, { ...jobs[f], watering: true })
      window.setTimeout(() => {
        if (actFarm(kind === 'water' ? { type: 'water', plot: i } : { type: 'harvest', plot: i }) === 'saved') onWatered?.(kind)
        if (jobs[f]) setJob(f, { ...jobs[f], watering: false })
        window.setTimeout(() => { setJob(f, null); schedule() }, REST_MS)
      }, POUR_MS)
    }, WALK_MS)
  }
}
// 씨앗을 심으면 잠깐(0.5초) 뒤에 친구가 출발한다
let pendingTimer = 0
function schedule() {
  if (!friends.length || typeof window === 'undefined') return
  clearTimeout(pendingTimer)
  pendingTimer = window.setTimeout(dispatch, 500)
}
if (typeof window !== 'undefined') { subscribeFarm(schedule); schedule() }
