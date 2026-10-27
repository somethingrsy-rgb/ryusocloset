import { CALL_ANIMALS } from './animalCalls'
import { actFarm, getFarm, subscribeFarm } from './farm'

/**
 * 농장 친구들: 고른 동물 친구(최대 2명)가 물이 필요한 밭에 저절로 가서 물을 준다.
 * 농장 화면 밖(다른 탭)에 있어도 앱이 열려 있는 동안 계속 일해서, 시작한 물 주기는 끝까지 마친다.
 * 화면은 jobs(누가 몇 번 밭에서 무엇을 하는지)만 받아서 그린다.
 */
export interface FriendJob {
  plot: number
  /** 물뿌리개를 기울이는 중(아니면 밭으로 걸어가는 중이거나 다 주고 잠깐 서 있는 중) */
  watering: boolean
  line: string
  /** 맡은 차례(말풍선은 가장 나중에 일을 맡은 친구 하나만: 겹치지 않게) */
  n: number
}

const KEY = 'ryuso.farm.friends'
export const MAX_FARM_FRIENDS = 2
/** 걸어가는 시간, 물 주는 시간, 다 주고 서 있는 시간(ms) */
export const WALK_MS = 900, POUR_MS = 450, REST_MS = 500
const LINES = ['내가 물 줄게!', '쑥쑥 자라라~', '촉촉하게!', '물 주기는 맡겨!']

export function sanitizeFriends(v: unknown): number[] {
  return Array.isArray(v) ? [...new Set(v.filter((a): a is number => Number.isInteger(a) && a >= 0 && a < CALL_ANIMALS.length))].slice(0, MAX_FARM_FRIENDS) : []
}
let friends: number[] = (() => { try { return sanitizeFriends(JSON.parse(localStorage.getItem(KEY) ?? '[]')) } catch { return [] } })()
let jobs: Record<number, FriendJob> = {}
let jobNo = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())
/** 물을 준 순간 알려 준다(농장 화면이 열려 있으면 소리를 낸다) */
let onWatered: (() => void) | null = null

export const getFarmFriends = () => friends
export const getFriendJobs = () => jobs
export const subscribeFarmFriends = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const setOnWatered = (fn: (() => void) | null) => { onWatered = fn }

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

/** 쉬고 있는 친구를 물이 필요한 밭으로 보낸다 */
function dispatch() {
  const st = getFarm()
  for (let i = 0; i < st.plots.length; i++) {
    const p = st.plots[i]
    if (!p || p.wateredAt !== null || !st.owned[i] || claimed(i)) continue
    const f = friends.find((x) => !jobs[x])
    if (f === undefined) return
    setJob(f, { plot: i, watering: false, line: LINES[Math.floor(Math.random() * LINES.length)], n: ++jobNo })
    window.setTimeout(() => {
      if (jobs[f]) setJob(f, { ...jobs[f], watering: true })
      window.setTimeout(() => {
        if (actFarm({ type: 'water', plot: i }) === 'saved') onWatered?.()
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
