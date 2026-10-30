import { getAvatar, subscribeAvatar } from './avatars'
import { avatarGuest, canJoin, validGuest } from './party'
import { getMeet, subscribeMeet } from './meet'
import { actFarm, getFarm, growth, subscribeFarm } from './farm'

/**
 * 농장 친구들: 고른 동물 친구(최대 2명)가 물이 필요한 밭에 저절로 가서 물을 주고,
 * 수확 버튼을 누르면 정해진 길(친구마다 자기 구역을 세로 줄로 오르내리며)을 따라 다 자란 밭을 수확한다.
 * 농장 화면 밖(다른 탭)에 있어도 앱이 열려 있는 동안 계속 일해서, 시작한 물 주기·수확은 끝까지 마친다.
 * 화면은 jobs(누가 몇 번 밭에서 무엇을 하는지)만 받아서 그린다.
 */
export type JobKind = 'water' | 'harvest'
export type Side = 'front' | 'left' | 'right'
export interface FriendJob {
  /** 지금 서 있는(걸어가는) 밭: 다른 줄로 갈 때는 먼저 같은 줄의 그 칸 앞(길목)을 지난다 */
  plot: number
  /** 그 밭의 어디에 서는지: 앞(아래 줄 사이 길목) · 왼쪽 · 오른쪽(세로 줄 사이 길목) */
  side: Side
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
  return Array.isArray(v) ? [...new Set(v.filter(validGuest))].slice(0, MAX_FARM_FRIENDS) : []
}
/** 고른 친구(저장) 중 같이 할 수 있는 친구만: 동물 친구는 수학으로 모은 친구만, 아바타 친구는 지금 내 아바타가 아니면 */
let chosen: number[] = (() => { try { return sanitizeFriends(JSON.parse(localStorage.getItem(KEY) ?? '[]')) } catch { return [] } })()
const onlyCollected = () => chosen.filter((a) => canJoin(a, getMeet().met) && a !== avatarGuest(getAvatar().id))
let friends: number[] = onlyCollected()
let jobs: Record<number, FriendJob> = {}
let jobNo = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((fn) => fn())
/** 물을 주거나 수확한 순간 알려 준다(농장 화면이 열려 있으면 소리를 낸다) */
let onWatered: ((kind: JobKind) => void) | null = null

export const getFarmFriends = () => friends
export const getFriendJobs = () => jobs
export const subscribeFarmFriends = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const setOnWatered = (fn: ((kind: JobKind) => void) | null) => { onWatered = fn }
/** 물주기 버튼: 물이 필요한 밭으로 바로 보낸다 */
export const waterNow = () => { clearTimeout(pendingTimer); dispatch() }
/** 수확 버튼: 친구마다 자기 길을 따라 다 자란 밭을 수확한다(누를 때만. 지금 다 자란 밭이 하나도 없으면 false).
 *  두 친구는 같은 박자로 움직이지 않게 두 번째 친구가 반 박자 늦게 출발한다(엇박자) */
export function harvestAll(now = Date.now()): boolean {
  const st = getFarm()
  if (!st.plots.some((p, i) => st.owned[i] && growth(p, now) === 1)) return false
  friends.forEach((f, k) => {
    harvestWanted.add(f)
    if (jobs[f]) return // 물 주기를 마치면 바로 수확하러 간다
    if (k === 0) harvestRoute(f)
    else window.setTimeout(() => { if (!jobs[f]) harvestRoute(f) }, k * HALF_BEAT)
  })
  return true
}
/** 수확 버튼을 눌렀지만 물 주기 중이라 아직 못 나선 친구(물 주기를 마치면 바로 수확하러 간다) */
const harvestWanted = new Set<number>()
/** 엇박자: 한 걸음(한 칸 걷기 + 수확)의 반 */
const HALF_BEAT = Math.round((CELL_MS + POUR_MS) / 2)

export function setFarmFriends(a: number[]) {
  chosen = sanitizeFriends(a)
  try { localStorage.setItem(KEY, JSON.stringify(chosen)) } catch { /* 저장 못 해도 지금은 같이 한다 */ }
  friends = onlyCollected()
  emit()
  schedule()
}
// 친구를 새로 모으면(수학) 같이 할 수 있는 친구가 바뀐다
const refresh = () => { const next = onlyCollected(); if (next.join() !== friends.join()) { friends = next; emit(); schedule() } }
subscribeMeet(refresh)
// 내 아바타를 바꾸면 그 아바타는 친구에서 빠진다
subscribeAvatar(refresh)

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

/** 할 일 목록(저절로 하는 일): 물이 필요한 밭. 수확은 수확 버튼을 눌렀을 때만(harvestRoute) */
function workList() {
  const st = getFarm()
  const work: { plot: number; kind: JobKind }[] = []
  st.plots.forEach((p, i) => { if (p && st.owned[i] && p.wateredAt === null) work.push({ plot: i, kind: 'water' }) })
  return work
}

/**
 * 수확 길: 자기 구역의 세로 줄을 차례로 오르내린다(보내 준 그림대로).
 * 1번 친구(왼쪽): 첫 줄은 왼쪽 바깥 길을 따라 아래→위, 다음 줄은 가운데 길을 따라 위→아래.
 * 2번 친구(오른쪽): 첫 줄은 가운데 길을 따라 위→아래, 다음 줄은 그 줄 사이 길을 따라 아래→위.
 * 밭은 지나가는 길 쪽(왼쪽·오른쪽)에서 딴다.
 */
export function harvestPath(k: number, nCols = cols, rows = Math.ceil(PLOTS / nCols), nFriends = friends.length) {
  // 친구 k 가 맡는 세로 줄들(왼쪽 친구는 왼쪽 줄들, 오른쪽 친구는 오른쪽 줄들, 혼자면 전부)
  const zone = Array.from({ length: nCols }, (_, c) => c).filter((c) => nFriends < 2 || (k === 0 ? c < Math.ceil(nCols / 2) : c >= Math.ceil(nCols / 2)))
  const out: { plot: number; side: Side }[] = []
  zone.forEach((c, j) => {
    const up = k === 0 ? j % 2 === 0 : j % 2 === 1 // 1번은 위로 먼저, 2번은 아래로 먼저
    const side: Side = j === 0 ? 'left' : k === 0 ? 'right' : 'left'
    for (let n = 0; n < rows; n++) { const r = up ? rows - 1 - n : n; out.push({ plot: r * nCols + c, side }) }
  })
  return out
}
const PLOTS = 20

/** 한 친구가 수확 길을 따라 걸으며 다 자란 밭을 딴다. 다 자라지 않은 밭은 지나가기만 한다 */
function harvestRoute(f: number) {
  harvestWanted.delete(f)
  const k = friends.indexOf(f)
  if (k < 0) return
  const path = harvestPath(k)
  // 걷는 동안 아바타가 먼저 딴 밭은 건너뛰도록 늘 지금 밭 상태로 본다
  const ripe = (i: number) => { const st = getFarm(); return st.owned[i] && growth(st.plots[i], Date.now()) === 1 }
  // 처음 다 자란 밭부터 마지막 다 자란 밭까지만 걷는다(그 사이 줄 바꿈 자리는 지나간다)
  const firstI = path.findIndex((p) => ripe(p.plot)), lastI = path.map((p) => ripe(p.plot)).lastIndexOf(true)
  if (firstI < 0) { work(f); return }
  const steps = path.slice(firstI, lastI + 1)
  const n0 = ++jobNo
  let prev: number | undefined
  const go = (i: number) => {
    if (i >= steps.length) { at[f] = steps[steps.length - 1].plot; setJob(f, null); work(f); return }
    const { plot, side } = steps[i]
    const take = ripe(plot) && !Object.entries(jobs).some(([g, j]) => +g !== f && j.target === plot)
    const ms = prev === undefined ? WALK_MS : Math.max(CELL_MS, (Math.abs(rc(plot).r - rc(prev).r) + Math.abs(rc(plot).c - rc(prev).c)) * CELL_MS)
    const base = { target: plot, kind: 'harvest' as const, side, line: LINES.harvest[Math.floor(Math.random() * LINES.harvest.length)], n: n0 }
    setJob(f, { ...base, plot, walkMs: ms, watering: false })
    prev = plot
    window.setTimeout(() => {
      if (!take) return go(i + 1) // 아직 덜 자란 밭은 지나간다
      setJob(f, { ...base, plot, walkMs: 0, watering: true })
      window.setTimeout(() => {
        if (actFarm({ type: 'harvest', plot }) === 'saved') onWatered?.('harvest')
        setJob(f, { ...base, plot, walkMs: 0, watering: false })
        window.setTimeout(() => go(i + 1), REST_MS)
      }, POUR_MS)
    }, ms)
  }
  go(0)
}

/** 한 친구가 자기 구역에서 가장 가까운 일을 하나 골라 줄을 따라 걸어가서 하고, 일이 남아 있으면 바로 다음 밭으로 이어 간다 */
function work(f: number) {
  const k = friends.indexOf(f)
  if (k < 0) { setJob(f, null); return }
  const from = at[f]
  const todo = workList().filter((w) => mine(k, w.plot) && !Object.entries(jobs).some(([g, j]) => +g !== f && j.target === w.plot))
  if (!todo.length) { setJob(f, null); if (harvestWanted.has(f)) harvestRoute(f); return }
  const d = (i: number) => (from === undefined ? rc(i).r * 10 + rc(i).c : Math.abs(rc(i).r - rc(from).r) * 1.5 + Math.abs(rc(i).c - rc(from).c))
  const next = todo.reduce((a, b) => (d(b.plot) < d(a.plot) ? b : a))
  const line = LINES[next.kind][Math.floor(Math.random() * LINES[next.kind].length)]
  const base = { target: next.plot, kind: next.kind, side: 'front' as const, watering: false, line, n: jobs[f]?.n ?? ++jobNo }
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
