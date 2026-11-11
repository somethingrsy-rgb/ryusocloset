/**
 * 같이 달리기(멀티플레이 레이스): Firebase `lobby/race/r1~r6` 방에 위치(거리·옆 자리·속도)만 주고받는다. 규칙은 database.rules.json.
 * - 방 하나에 최대 4명. 처음 들어간 사람이 방장이 되어 씨앗(seed)을 정하고, 방장이 「출발!」을 누르면 모두 같은 길(같은 씨앗)을 달린다.
 * - 이 파일은 Firebase 를 직접 아는 유일한 레이스 파일이다(firebase.ts 와 같은 이유로 동적으로 불러온다).
 */
import { onDisconnect, onValue, ref, remove, serverTimestamp, set, get, update, type Database } from 'firebase/database'
import { connect } from './firebase'
import { localTest } from './config'

export const RACE_ROOMS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'] as const
export const RACE_MAX = 4
/** 출발 소식을 받고 카운트다운(3, 2, 1)이 시작하기까지 여유(ms) */
export const START_LEAD = 1500
/** 이만큼(ms) 소식이 없는 방·친구는 끊긴 것으로 본다 */
export const STALE_MS = 15000

export interface RaceMeta { host: string; seed: number; /** 0 이면 아직 대기 중, 아니면 출발 시각(서버 ms) */ startAt: number; t: number }
export interface RacePlayer { name: string; car: string; d: number; x: number; speed: number; fin: number | null; t: number }
export interface RoomSnap { meta: RaceMeta | null; players: Record<string, RacePlayer> }

const num = (v: unknown, lo: number, hi: number, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback)
/** 서버에서 온 값을 믿지 않고 한 번 걸러 쓴다 */
export function sanePlayer(v: unknown): RacePlayer | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  if (typeof r.name !== 'string' || typeof r.car !== 'string') return null
  return { name: r.name.slice(0, 12), car: r.car.slice(0, 12), d: num(r.d, 0, 5000), x: num(r.x, -3, 3), speed: num(r.speed, 0, 200), fin: r.fin === null || r.fin === undefined ? null : num(r.fin, 0, 600), t: num(r.t, 0, 1e15) }
}
export function saneMeta(v: unknown): RaceMeta | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  if (typeof r.host !== 'string' || typeof r.seed !== 'number') return null
  return { host: r.host, seed: Math.floor(num(r.seed, 0, 999999)), startAt: num(r.startAt, 0, 1e15), t: num(r.t, 0, 1e15) }
}

/** 어느 방에 들어갈까: 대기 중이고 자리가 있고 소식이 신선한 방 중 가장 작은 번호, 없으면 빈 방 */
export function pickRoom(rooms: Record<string, RoomSnap | undefined>, now: number): { room: string; create: boolean } | null {
  for (const id of RACE_ROOMS) {
    const r = rooms[id]
    if (!r || !r.meta) continue
    const fresh = now - r.meta.t < STALE_MS * 4 && r.meta.startAt === 0
    if (fresh && Object.keys(r.players).length < RACE_MAX) return { room: id, create: false }
  }
  for (const id of RACE_ROOMS) {
    const r = rooms[id]
    if (!r || !r.meta || now - r.meta.t > 600000) return { room: id, create: true }
  }
  return null
}

/** 사람들의 출발 자리(칸 순서): uid 를 글자 순으로 늘어놓은 번호. 모두의 화면에서 같다 */
export const slotOf = (uids: string[], uid: string) => [...uids].sort().indexOf(uid)

export interface RaceRoom {
  uid: string
  room: string
  host: boolean
  /** 소식 한 번 보내기(내 거리·옆 자리·속도, 결승선을 지났으면 fin) */
  report(me: { name: string; car: string; d: number; x: number; speed: number; fin: number | null }): void
  /** 방장이 출발을 알린다 */
  start(): void
  /** 서버 시각 - 내 시각(ms) */
  offset(): number
  leave(): void
}

/** 시험용(주소에 ?mp=local): 같은 브라우저의 탭끼리만 BroadcastChannel 로 같은 방을 쓴다. Firebase 없이 두 화면으로 확인할 때 */
async function joinLocal(name: string, car: string, onRoom: (room: RoomSnap) => void): Promise<RaceRoom> {
  const ch = new BroadcastChannel('ryuso-race-local')
  const uid = `L${Math.random().toString(36).slice(2, 8)}`
  const players: Record<string, RacePlayer> = {}
  let meta: RaceMeta | null = null
  const me: RacePlayer = { name: name.slice(0, 12) || '친구', car, d: 0, x: 0, speed: 0, fin: null, t: Date.now() }
  const say = (m: unknown) => ch.postMessage(m)
  const push = () => onRoom({ meta, players: { ...players } })
  ch.onmessage = (e) => {
    const m = e.data as { type: string; uid?: string; p?: RacePlayer; meta?: RaceMeta | null }
    if (m.type === 'who') { say({ type: 'p', uid, p: me }); if (meta?.host === uid) say({ type: 'meta', meta }) }
    else if (m.type === 'p' && m.uid && m.p) { players[m.uid] = m.p; push() }
    else if (m.type === 'meta') { meta = m.meta ?? null; push() }
    else if (m.type === 'bye' && m.uid) { delete players[m.uid]; if (meta && meta.host === m.uid) meta = null; push() }
  }
  say({ type: 'who' })
  await new Promise((r) => setTimeout(r, 350))
  const host = !meta
  if (host) { meta = { host: uid, seed: Math.floor(Math.random() * 900000) + 100, startAt: 0, t: Date.now() }; say({ type: 'meta', meta }) }
  players[uid] = me; say({ type: 'p', uid, p: me }); push()
  return {
    uid, room: 'local', host,
    report: (m) => { Object.assign(me, m, { t: Date.now() }); players[uid] = me; say({ type: 'p', uid, p: me }) },
    start: () => { if (host && meta) { meta = { ...meta, startAt: Date.now() + START_LEAD + 2000 }; say({ type: 'meta', meta }); push() } },
    offset: () => 0,
    leave: () => { say({ type: 'bye', uid }); ch.close() },
  }
}

/** 어느 단계에서 실패했는지 오류 글에 붙인다(규칙 거부가 어디서 났는지 알 수 있게) */
const step = async <T>(name: string, p: PromiseLike<T>): Promise<T> => { try { return await p } catch (e) { const err = e instanceof Error ? e : new Error(String(e)); err.message = `[${name}] ${err.message}`; throw err } }

/** 방에 들어간다(자리가 없으면 null). onRoom 은 방 소식이 바뀔 때마다 */
export async function joinRaceRoom(name: string, car: string, onRoom: (room: RoomSnap) => void): Promise<RaceRoom | null> {
  if (localTest) return joinLocal(name, car, onRoom)
  const { user, db } = await step('로그인', connect())
  const root = ref(db as Database, 'lobby/race')
  let skew = 0
  const offOff = onValue(ref(db, '.info/serverTimeOffset'), (s) => { skew = Number(s.val()) || 0 })
  const all = (await step('방 목록 읽기', get(root))).val() as Record<string, { meta?: unknown; players?: Record<string, unknown> }> | null
  const rooms: Record<string, RoomSnap> = {}
  for (const [id, v] of Object.entries(all ?? {})) {
    const players: Record<string, RacePlayer> = {}
    for (const [u, p] of Object.entries(v.players ?? {})) { const sp = sanePlayer(p); if (sp) players[u] = sp }
    rooms[id] = { meta: saneMeta(v.meta), players }
  }
  const pick = pickRoom(rooms, Date.now() + skew)
  if (!pick) { offOff(); return null }
  const roomRef = ref(db, `lobby/race/${pick.room}`)
  const meRef = ref(db, `lobby/race/${pick.room}/players/${user.uid}`)
  const metaRef = ref(db, `lobby/race/${pick.room}/meta`)
  if (pick.create) {
    // 오래된 방이 남아 있으면 지우고 내가 방장이 된다
    await remove(roomRef).catch(() => {})
    await step('방 만들기', set(metaRef, { host: user.uid, seed: Math.floor(Math.random() * 900000) + 100, startAt: 0, t: serverTimestamp() }))
    onDisconnect(roomRef).remove().catch(() => {})
  } else {
    onDisconnect(meRef).remove().catch(() => {})
  }
  const first = { name: name.slice(0, 12) || '친구', car, d: 0, x: 0, speed: 0, fin: null as number | null }
  await step('내 자리 쓰기', set(meRef, { ...first, t: serverTimestamp() }))
  const off = onValue(roomRef, (s) => {
    const v = s.val() as { meta?: unknown; players?: Record<string, unknown> } | null
    const players: Record<string, RacePlayer> = {}
    for (const [u, p] of Object.entries(v?.players ?? {})) { const sp = sanePlayer(p); if (sp) players[u] = sp }
    onRoom({ meta: saneMeta(v?.meta), players })
  })
  return {
    uid: user.uid, room: pick.room, host: pick.create,
    report: (m) => { update(meRef, { ...m, fin: m.fin, t: serverTimestamp() }).catch(() => {}) },
    start: () => { if (pick.create) update(metaRef, { startAt: Date.now() + skew + START_LEAD + 2000, t: serverTimestamp() }).catch(() => {}) },
    offset: () => skew,
    leave: () => {
      off(); offOff()
      if (pick.create) { onDisconnect(roomRef).cancel().catch(() => {}); remove(roomRef).catch(() => {}) }
      else { onDisconnect(meRef).cancel().catch(() => {}); remove(meRef).catch(() => {}) }
    },
  }
}
