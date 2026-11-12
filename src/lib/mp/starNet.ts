/**
 * 도망간 별을 잡아라 방(Firebase `lobby/star/s1~s4`). 규칙은 database.rules.json.
 * - 방장 한 곳(host)이 별을 움직이고 잡기를 판정해서 `state` 에 쓴다. 나머지는 자기 위치·준비·잡기 요청만 자기 칸(players/내uid)에 쓴다.
 * - 방장이 방을 나가면 방이 사라지고 모두 대기실로 돌아간다(방장 넘기기는 아직 없다).
 * - 주소에 ?mp=local 이면 같은 브라우저 탭끼리 BroadcastChannel 로 시험한다. practice 는 혼자 하는 연습(네트워크 없음).
 */
import { onDisconnect, onValue, ref, remove, serverTimestamp, set, get, update, type Database } from 'firebase/database'
import { connect } from './firebase'
import { localTest } from './config'

export const STAR_ROOMS = ['s1', 's2', 's3', 's4'] as const
export const STAR_MAX = 4
export const STAR_STALE_MS = 60000
export interface SPlayer { name: string; ready: boolean; x: number; y: number; cap: { n: number; r: number } | null; say: { k: number; n: number } | null; j: number }
export interface SMeta { host: string; phase: 'lobby' | 'play' | 'done'; round: number; target: number; startAt: number; endAt: number; part: string[]; t: number }
export interface SStar { id: number; x: number; y: number; m: number }
export interface SState { r: number; caught: number; res: 0 | 1 | 2; ev: { n: number; x: number; y: number } | null; acc: Record<string, number>; stars: SStar[] }
export interface StarSnap { meta: SMeta | null; players: Record<string, SPlayer>; state: SState | null }

const fin = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const rng = (v: unknown, lo: number, hi: number, d = 0) => { const n = fin(v); return n === null ? d : Math.max(lo, Math.min(hi, n)) }
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v.filter((x) => x != null) : Object.values(obj(v)))

export function saneMeta(v: unknown): SMeta | null {
  const r = obj(v)
  if (typeof r.host !== 'string') return null
  const phase = r.phase === 'play' || r.phase === 'done' ? r.phase : 'lobby'
  return { host: r.host.slice(0, 64), phase, round: rng(r.round, 0, 99999), target: rng(r.target, 0, 20), startAt: rng(r.startAt, 0, 1e15), endAt: rng(r.endAt, 0, 1e15), part: Object.keys(obj(r.part)).slice(0, STAR_MAX), t: rng(r.t, 0, 1e15) }
}
export function sanePlayers(v: unknown): Record<string, SPlayer> {
  const out: Record<string, SPlayer> = {}
  for (const [u, raw] of Object.entries(obj(v))) {
    const p = obj(raw); if (typeof p.name !== 'string' || !p.name) continue
    const c = obj(p.cap), s = obj(p.say)
    out[u] = { name: p.name.slice(0, 12), ready: p.ready === true, x: rng(p.x, -12, 12), y: rng(p.y, -9, 9), j: rng(p.j, 0, 1e15), cap: fin(c.n) !== null ? { n: rng(c.n, 0, 1e9), r: rng(c.r, 0, 99999) } : null, say: fin(s.k) !== null ? { k: rng(s.k, 0, 2), n: rng(s.n, 0, 1e9) } : null }
  }
  return out
}
export function saneState(v: unknown): SState | null {
  const r = obj(v); if (fin(r.r) === null) return null
  const ev = obj(r.ev), acc: Record<string, number> = {}
  for (const [u, n] of Object.entries(obj(r.acc))) { const k = fin(n); if (k !== null) acc[u] = k }
  const stars = list(r.stars).slice(0, 3).map((x) => { const s = obj(x); return { id: rng(s.id, 0, 1e9), x: rng(s.x, -12, 12), y: rng(s.y, -9, 9), m: rng(s.m, 0, 2) } })
  return { r: rng(r.r, 0, 99999), caught: rng(r.caught, 0, 20), res: r.res === 1 ? 1 : r.res === 2 ? 2 : 0, ev: fin(ev.n) !== null ? { n: rng(ev.n, 0, 1e9), x: rng(ev.x, -12, 12), y: rng(ev.y, -9, 9) } : null, acc, stars }
}
export const sanitizeStar = (v: unknown): StarSnap => { const r = obj(v); return { meta: saneMeta(r.meta), players: sanePlayers(r.players), state: saneState(r.state) } }

export interface StarRoom {
  uid: string; room: string; host: boolean
  /** 서버 시각 기준 지금(ms) */
  now(): number
  /** 내 칸 고쳐 쓰기(위치·준비·잡기·말) */
  patchMe(p: Partial<Pick<SPlayer, 'ready' | 'x' | 'y' | 'cap' | 'say'>>): void
  /** 방장만: 판 정보 고쳐 쓰기 */
  setMeta(m: Partial<Omit<SMeta, 'host' | 't'>>): void
  /** 방장만: 별·점수 상태 쓰기 */
  setState(s: SState | null): void
  leave(): void
}

/** 들어갈 방 후보: 대기 중이고 자리가 있는 방 → 빈 방 */
export function pickStarRooms(rooms: Record<string, StarSnap | undefined>, now: number): { room: string; create: boolean }[] {
  const out: { room: string; create: boolean }[] = []
  for (const id of STAR_ROOMS) { const r = rooms[id]; if (r?.meta && r.meta.phase === 'lobby' && now - r.meta.t < STAR_STALE_MS * 3 && Object.keys(r.players).length < STAR_MAX) out.push({ room: id, create: false }) }
  for (const id of STAR_ROOMS) if (!rooms[id]?.meta) out.push({ room: id, create: true })
  for (const id of STAR_ROOMS) { const r = rooms[id]; if (r?.meta && now - r.meta.t > 600000) out.push({ room: id, create: true }) }
  return out
}

const blankMe = (name: string): SPlayer => ({ name: name.slice(0, 12) || '친구', ready: false, x: 0, y: 0, cap: null, say: null, j: Date.now() })

/** 시험·연습용: practice 면 네트워크 없이 혼자, 아니면 같은 브라우저 탭끼리(BroadcastChannel) */
async function joinLocal(name: string, onSnap: (s: StarSnap) => void, practice: boolean): Promise<StarRoom> {
  const ch = practice ? null : new BroadcastChannel('ryuso-star-local')
  const uid = `L${Math.random().toString(36).slice(2, 8)}`
  const players: Record<string, SPlayer> = {}
  let meta: SMeta | null = null, state: SState | null = null
  const push = () => onSnap({ meta, players: { ...players }, state })
  const say = (m: unknown) => ch?.postMessage(m)
  if (ch) ch.onmessage = (e) => {
    const m = e.data as { type: string; uid?: string; p?: SPlayer; meta?: SMeta | null; state?: SState | null }
    if (m.type === 'who') { if (players[uid]) say({ type: 'p', uid, p: players[uid] }); if (meta?.host === uid) { say({ type: 'meta', meta }); say({ type: 'state', state }) } }
    else if (m.type === 'p' && m.uid && m.p) { players[m.uid] = m.p; push() }
    else if (m.type === 'meta') { meta = m.meta ?? null; push() }
    else if (m.type === 'state') { state = m.state ?? null; push() }
    else if (m.type === 'bye' && m.uid) { delete players[m.uid]; if (meta?.host === m.uid) { meta = null; state = null } push() }
  }
  say({ type: 'who' })
  if (!practice) await new Promise((r) => setTimeout(r, 350))
  const host = !meta
  if (host) { meta = { host: uid, phase: 'lobby', round: 0, target: 0, startAt: 0, endAt: 0, part: [], t: Date.now() }; say({ type: 'meta', meta }) }
  players[uid] = blankMe(name); say({ type: 'p', uid, p: players[uid] }); push()
  return {
    uid, room: practice ? 'practice' : 'local', host, now: () => Date.now(),
    patchMe: (p) => { players[uid] = { ...players[uid], ...p }; say({ type: 'p', uid, p: players[uid] }); push() },
    setMeta: (m) => { if (!host || !meta) return; meta = { ...meta, ...m, t: Date.now() }; say({ type: 'meta', meta }); push() },
    setState: (s) => { if (!host) return; state = s; say({ type: 'state', state }); push() },
    leave: () => { say({ type: 'bye', uid }); ch?.close() },
  }
}

/** 방에 들어간다. code: 친구 방 번호(1~4, 'S1' 같은 표기도 허용). create 면 새 방. 자리가 없으면 null */
export async function joinStarRoom(name: string, onSnap: (s: StarSnap) => void, opts: { practice?: boolean; code?: string; create?: boolean } = {}): Promise<StarRoom | null> {
  if (opts.practice || localTest) return joinLocal(name, onSnap, !!opts.practice)
  const { user, db } = await connect()
  let skew = 0
  const offOff = onValue(ref(db as Database, '.info/serverTimeOffset'), (s) => { skew = Number(s.val()) || 0 })
  const all = (await get(ref(db, 'lobby/star'))).val() as Record<string, unknown> | null
  const rooms: Record<string, StarSnap> = {}
  for (const [id, v] of Object.entries(all ?? {})) rooms[id] = sanitizeStar(v)
  let candidates = pickStarRooms(rooms, Date.now() + skew)
  if (opts.code) {
    const id = `s${String(opts.code).replace(/\D/g, '')}`
    const r = rooms[id]
    if (!(STAR_ROOMS as readonly string[]).includes(id) || !r?.meta) { offOff(); throw new Error('그 방을 찾지 못했어요. 방 번호를 확인해 주세요') }
    if (r.meta.phase !== 'lobby') { offOff(); throw new Error('그 방은 이미 시작했어요. 다음 판을 기다려 주세요') }
    if (Object.keys(r.players).length >= STAR_MAX) { offOff(); throw new Error('그 방은 4명이 꽉 찼어요') }
    candidates = [{ room: id, create: false }]
  }
  if (opts.create) candidates = pickStarRooms(rooms, Date.now() + skew).filter((c) => c.create)
  if (!candidates.length) { offOff(); return null }
  let pick = candidates[0], lastErr: unknown = null, ready = false
  const step = async <T,>(label: string, p: PromiseLike<T>): Promise<T> => { try { return await p } catch (e) { const er = e instanceof Error ? e : new Error(String(e)); er.message = `[${label}] ${er.message}`; throw er } }
  for (const c of candidates) {
    pick = c
    if (!c.create) { ready = true; break }
    try {
      await remove(ref(db, `lobby/star/${c.room}/state`)).catch(() => {})
      await step('방 만들기', set(ref(db, `lobby/star/${c.room}/meta`), { host: user.uid, phase: 'lobby', round: 0, target: 0, startAt: 0, endAt: 0, t: serverTimestamp() }))
      ready = true; break
    } catch (e) { lastErr = e }
  }
  if (!ready) { offOff(); throw lastErr }
  const base = `lobby/star/${pick.room}`
  const roomRef = ref(db, base), metaRef = ref(db, `${base}/meta`), stateRef = ref(db, `${base}/state`), meRef = ref(db, `${base}/players/${user.uid}`)
  await step('내 자리 쓰기', set(meRef, { name: name.slice(0, 12) || '친구', ready: false, x: 0, y: 0, j: Date.now() + skew, t: serverTimestamp() }))
  onDisconnect(meRef).remove().catch(() => {})
  if (pick.create) onDisconnect(metaRef).remove().catch(() => {})
  const off = onValue(roomRef, (s) => onSnap(sanitizeStar(s.val())))
  const beat = pick.create ? window.setInterval(() => { update(metaRef, { t: serverTimestamp() }).catch(() => {}) }, 15000) : 0
  return {
    uid: user.uid, room: pick.room, host: pick.create, now: () => Date.now() + skew,
    patchMe: (p) => { const u: Record<string, unknown> = { ...p }; if ('cap' in p && !p.cap) u.cap = null; update(meRef, u).catch(() => {}) },
    setMeta: (m) => {
      if (!pick.create) return
      const u: Record<string, unknown> = { ...m, t: serverTimestamp() }
      if (m.part) u.part = Object.fromEntries(m.part.map((x) => [x, 1]))
      update(metaRef, u).catch(() => {})
    },
    setState: (s) => {
      if (!pick.create) return
      if (!s) { remove(stateRef).catch(() => {}); return }
      set(stateRef, { ...s, ev: s.ev ?? null }).catch(() => {})
    },
    leave: () => {
      off(); offOff(); if (beat) clearInterval(beat)
      onDisconnect(meRef).cancel().catch(() => {}); remove(meRef).catch(() => {})
      if (pick.create) { onDisconnect(metaRef).cancel().catch(() => {}); remove(stateRef).catch(() => {}); remove(metaRef).catch(() => {}) }
    },
  }
}
