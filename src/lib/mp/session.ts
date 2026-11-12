/**
 * 멀티플레이어 세션: 한 번 들어가면 앱 어디에 있든(카페·농장·산책·옷장…) 계속 같이 놀기 중이고 채팅은 모두와 한다.
 * 3D 카페·농장·산책에 들어가면 그곳(room)을 알려서, 같은 곳에 있는 친구만 3D 로 보인다. 화면(UI)과 3D 장면이 같이 본다:
 * - UI: 같이 놀기 켜기/끄기, 닉네임, 채팅, 인원
 * - 3D: 내 위치 보내기(setPos), 다른 플레이어 그리기(state.players)
 * Firebase 는 들어갈 때 처음 불러온다(동적 import) → 멀티플레이어를 안 쓰면 앱 크기·동작이 그대로다.
 */
import { MAX_FOOD, MAX_PLAYERS, STALE_MS, cleanChat, cleanName, shouldSend, type Boss, type ChatMsg, type Food, type Home, type Look, type PlayerState, type Where } from './core'
import { firebaseReady, localTest } from './config'
import type { Transport } from './transport'

export type Status = 'off' | 'connecting' | 'on' | 'full' | 'error'
export interface MpState { status: Status; /** 내가 지금 있는 곳 */ room: Where; /** room 이 home 이면 그 집 주인 uid */ host: string | null;
  /** 놀러 가려는(가 있는) 친구 집 주인 uid: 앱이 그 집 화면을 띄운다 */ visiting: string | null; /** 내 집을 열었는지 */ hosting: boolean;
  /** 지켜보는 집(내 집이나 놀러 간 집)과 그 바닥 음식 */ home: Home | null; foods: Food[]; uid: string | null; players: Record<string, PlayerState>; chat: ChatMsg[]; /** 같이 사냥하는 대왕 몬스터(장소마다) */ bosses: Record<string, Boss>; error: string | null }

const NAME_KEY = 'ryuso.mp.name'
export const savedName = () => { try { return cleanName(localStorage.getItem(NAME_KEY)) } catch { return '' } }

let state: MpState = { status: 'off', room: 'none', host: null, visiting: null, hosting: false, home: null, foods: [], uid: null, players: {}, chat: [], bosses: {}, error: null }
const listeners = new Set<() => void>()
const set = (p: Partial<MpState>) => { state = { ...state, ...p }; listeners.forEach((f) => f()) }
export const getMp = () => state
export const subscribeMp = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn))

let tr: Transport | null = null
let myName = ''
let lastSent: { x: number; z: number; dir: number; moving: boolean; at: number } | null = null
let pos = { x: 0, z: 0, dir: 1 as 1 | -1, moving: false }
let joinId = 0

export async function joinMp(name: string, look: Look) {
  leaveMp()
  const id = ++joinId
  myName = cleanName(name) || '친구'
  try { localStorage.setItem(NAME_KEY, myName) } catch { /* 이번만 */ }
  set({ status: 'connecting', error: null, players: {}, chat: [], bosses: {} })
  try {
    const t: Transport = localTest && !firebaseReady
      ? (await import('./localTransport')).localTransport()
      : (await import('./firebaseTransport')).firebaseTransport()
    if (id !== joinId) return
    t.onPlayers((players) => {
      // 오래 소식 없는 플레이어(끊겼는데 정리가 늦은)는 뺀다
      const now = Date.now() + t.offset()
      set({ players: Object.fromEntries(Object.entries(players).filter(([, p]) => now - p.t < STALE_MS)) })
    })
    t.onChat((chat) => set({ chat }))
    t.onBosses((bosses) => set({ bosses }))
    const r = await t.join({ name: myName, room: state.room, ...(state.host ? { host: state.host } : {}), ...pos, look })
    if (id !== joinId) { t.leave(); return }
    if (r.full) { set({ status: 'full', uid: r.uid }); return }
    tr = t
    lastSent = { ...pos, at: performance.now() }
    set({ status: 'on', uid: r.uid })
  } catch (e) {
    if (id === joinId) set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

export function leaveMp() {
  joinId++
  unwatch()
  tr?.leave()
  tr = null
  lastSent = null
  if (state.status !== 'off') set({ status: 'off', players: {}, chat: [], bosses: {}, uid: null, visiting: null, hosting: false, home: null, foods: [] })
}

/** 3D 장면이 매 프레임 부른다: 보낼 때가 된 것만 보낸다 */
export function setPos(x: number, z: number, dir: 1 | -1, moving: boolean) {
  pos = { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, dir, moving }
  if (!tr) return
  const at = performance.now()
  if (!shouldSend(lastSent, pos, at)) return
  lastSent = { ...pos, at }
  tr.update(pos)
}
export function setLook(look: Look) { tr?.update({ look }) }
/** 3D 카페·농장·산책에 들어오고 나갈 때(나가면 'none'). 들어오기 전 상태에서도 기억해 둔다 */
export function setWhere(room: Where, host: string | null = null) {
  if (room !== 'home') host = null
  if (state.room === room && state.host === host) return
  set({ room, host })
  tr?.update({ room, host, ...pos })
  lastSent = { ...pos, at: performance.now() }
}
export function say(text: string, home = false) { const t = cleanChat(text); if (t && tr) tr.chat(myName, t, home) }
/** 같이 레이스할 친구들에게 초대를 보낸다(방 번호를 담은 채팅 한 줄) */
export function sayRace(room: string) { if (tr) tr.chat(myName, '🏎️ 자동차 레이스 같이할래?', false, room) }
export function sayJump(room: string) { if (tr) tr.chat(myName, '🎯 점프 퍼즐 같이할래?', false, undefined, room) }
export const playerCount = () => Object.keys(state.players).length
export { MAX_PLAYERS }
/** 대왕 몬스터에게 마법 한 번 / 새로 내기(같이 놀기 중일 때만) */
export function hitBoss(room: string, id: string, power: number) { tr?.hitBoss(room, id, power) }
export function spawnBoss(room: string, next: Omit<Boss, 't'>) { tr?.spawnBoss(room, next) }
/** 서버 시각(대략) */
export const serverNow = () => Date.now() + (tr?.offset() ?? 0)

// ── 집 놀이: 내 방에 친구를 초대하고, 친구 집에 놀러 간다 ──
let stopWatch: (() => void) | null = null
let watching: string | null = null
function watch(host: string) {
  if (watching === host || !tr) return
  unwatch()
  watching = host
  stopWatch = tr.watchHome(host, (home, foods) => set({ home, foods }))
}
function unwatch() { stopWatch?.(); stopWatch = null; watching = null; if (state.home || state.foods.length) set({ home: null, foods: [] }) }
/** 지금 있는 곳(방 꾸밈 또는 장소)을 친구들에게 열고 모두에게 초대장(초대 글)을 보낸다 */
export function inviteHome(room: unknown, text = '🏠 우리집에 놀러 와! 같이 간식 먹자 🍰') {
  if (!tr || !state.uid) return
  // Firebase 는 undefined 값을 받지 않아서 JSON 으로 한 번 걸러 보낸다
  tr.openHome({ name: myName, room: JSON.parse(JSON.stringify(room ?? null)) })
  set({ hosting: true })
  watch(state.uid)
  say(text, true)
}
/** 내 방 화면에 들어오면 부른다: 이미 연 집이면 친구들·음식을 다시 본다 */
export function enterMyHome() { if (state.hosting && state.uid) watch(state.uid) }
/** 내 방 화면을 나가면 집을 닫는다(놀러 와 있던 친구들은 돌아간다) */
export function closeHome() {
  if (!state.hosting) return
  tr?.closeHome()
  set({ hosting: false })
  if (watching === state.uid) unwatch()
}
/** 친구 집에 놀러 간다 / 돌아온다 */
export function visitHome(host: string) {
  if (!tr || host === state.uid) return
  // 내가 다른 곳으로 친구를 부르던 중이면 그건 닫는다: 안 그러면 뒤에 남은 내 장소와 놀러 간 곳이 번갈아 위치를 보내서
  // 친구 화면에서 내가 두 자리를 왔다 갔다 한다
  if (state.hosting) { tr.closeHome(); set({ hosting: false }); unwatch() }
  set({ visiting: host })
  watch(host)
}
export function leaveVisit() { set({ visiting: null }); if (watching && watching !== state.uid) unwatch(); setWhere(sceneWhere) }
// 3D 카페·농장·산책은 친구 집에 가 있는 동안에도 뒤에 그대로 있다: 그동안은 3D 위치를 보내지 않고, 돌아오면 그 3D 장소로 되돌린다
let sceneWhere: Where = 'none'
/** 3D 장면이 들어오고 나갈 때(remotePlayers3d) */
export function setSceneWhere(room: Where) { sceneWhere = room; if (!state.visiting) setWhere(room) }
/** 3D 장면을 나갈 때: 그 장면이 아직 지금 장소면 'none' 으로 */
export function leaveSceneWhere(room: Where) { if (sceneWhere === room) setSceneWhere('none') }
/** 3D 장면이 매 프레임 부르는 위치 보내기(친구 집에 가 있으면 보내지 않는다) */
export function setPos3d(x: number, z: number, dir: 1 | -1, moving: boolean) { if (!state.visiting) setPos(x, z, dir, moving) }
/** 지켜보는 집 바닥에 음식 놓기 / 먹기 */
export function putFood(menu: string, x: number, y: number) {
  if (!tr || !watching) return
  // 바닥이 꽉 차면 가장 오래된 것을 치우고 놓는다
  const old = [...state.foods].sort((a, b) => a.t - b.t)
  for (const f of old.slice(0, Math.max(0, old.length - MAX_FOOD + 1))) tr.eatFood(watching, f.id)
  tr.addFood(watching, { menu, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, by: myName })
}
export function eatFood(id: string) { if (tr && watching) tr.eatFood(watching, id) }
/** 방 주문(같이 놀기): 놀러 간 친구가 메뉴를 주문 / 방 주인이 만든 음식을 그 친구에게 가져다 준다 */
export function orderFood(menu: string) { if (tr && watching && state.uid) tr.addFood(watching, { menu, x: 0, y: 0, by: myName, uid: state.uid, kind: 'order' }) }
export function serveFood(order: Food) {
  if (!tr || !watching) return
  tr.eatFood(watching, order.id)
  tr.addFood(watching, { menu: order.menu, x: 0, y: 0, by: order.by, uid: order.uid, kind: 'served' })
}
/** 내가 먹는 중인 음식(친구 화면에도 보인다), 4초 뒤 저절로 끝 */
let eatTimer = 0
export function setEating(menu: string) {
  tr?.update({ eat: menu })
  clearTimeout(eatTimer)
  eatTimer = window.setTimeout(() => tr?.update({ eat: null }), 4000)
}
export const myMpName = () => myName
