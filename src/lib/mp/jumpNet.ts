/**
 * 점프 퍼즐 같이 하기 방(Firebase `lobby/jump/j1~j4`). 규칙은 database.rules.json.
 * - 방 하나에 최대 4자리. 처음 들어간 사람이 방장이 되어 씨앗(seed)을 정하고, 모이면 방장이 시작한다(빈 자리는 컴퓨터 동물).
 * - 판은 씨앗으로 만들고, 사람들이 「수」를 moves/0, moves/1 … 순서대로 쌓는다. 모두가 같은 순서로 적용해서 같은 판이 된다.
 * - 방장은 컴퓨터 자리와, 방을 나가 버린 사람의 자리도 대신 둔다(규칙이 허용한다).
 */
import { onDisconnect, onValue, ref, remove, serverTimestamp, set, get, update, type Database } from 'firebase/database'
import { connect } from './firebase'
import { localTest } from './config'
import type { Action } from '../jumpMulti'

export const JUMP_ROOMS = ['j1', 'j2', 'j3', 'j4'] as const
export const JUMP_MAX = 4
export const JUMP_STALE_MS = 60000
export interface JumpMeta { host: string; seed: number; started: boolean; /** 자리 번호 → uid 또는 'cpu' */ order: string[]; /** 컴퓨터 자리 번호 → 동물 번호 */ cpus: Record<number, number>; t: number }
export interface JumpSnap { meta: JumpMeta | null; players: Record<string, { name: string }>; moves: Action[] }

const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : null)
/** 서버에서 온 배열/객체(키가 0,1,2…)를 순서대로 읽는다 */
const listOf = (v: unknown): [number, unknown][] => {
  if (Array.isArray(v)) return v.map((x, i) => [i, x] as [number, unknown]).filter(([, x]) => x !== null && x !== undefined)
  if (v && typeof v === 'object') return Object.entries(v as Record<string, unknown>).map(([k, x]) => [Number(k), x] as [number, unknown]).filter(([k]) => Number.isInteger(k) && k >= 0).sort((a, b) => a[0] - b[0])
  return []
}
export function saneMeta(v: unknown): JumpMeta | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  if (typeof r.host !== 'string' || typeof r.seed !== 'number') return null
  const order: string[] = []
  for (const [i, x] of listOf(r.order)) if (i < JUMP_MAX && typeof x === 'string') order[i] = x.slice(0, 64)
  const cpus: Record<number, number> = {}
  for (const [i, x] of listOf(r.cpus)) { const n = num(x, 0, 5); if (i < JUMP_MAX && n !== null) cpus[i] = n }
  return { host: r.host, seed: Math.floor(num(r.seed, 0, 999999) ?? 0), started: r.started === true, order, cpus, t: typeof r.t === 'number' ? r.t : 0 }
}
export function saneMoves(v: unknown): Action[] {
  const out: Action[] = []
  for (const [i, x] of listOf(v)) {
    if (i !== out.length) break // 빈 번호가 있으면 거기까지만(뒤는 아직 안 온 것)
    if (!x || typeof x !== 'object') break
    const r = x as Record<string, unknown>
    const s = num(r.s, 0, 3); if (s === null) break
    if (r.e === 1) { out.push({ s, e: 1 }); continue }
    const fr = num(r.fr, 0, 7), fc = num(r.fc, 0, 7), tr = num(r.tr, 0, 7), tc = num(r.tc, 0, 7)
    if (fr === null || fc === null || tr === null || tc === null) break
    out.push({ s, fr, fc, tr, tc })
  }
  return out
}
export function sanePlayers(v: unknown): Record<string, { name: string }> {
  const out: Record<string, { name: string }> = {}
  if (v && typeof v === 'object') for (const [u, p] of Object.entries(v as Record<string, unknown>)) {
    const n = (p as { name?: unknown } | null)?.name
    if (typeof n === 'string' && n) out[u] = { name: n.slice(0, 12) }
  }
  return out
}
export function sanitizeRoom(v: unknown): JumpSnap {
  const r = (v ?? {}) as Record<string, unknown>
  return { meta: saneMeta(r.meta), players: sanePlayers(r.players), moves: saneMoves(r.moves) }
}

/** 들어갈 방 후보(좋은 순서): ① 대기 중이고 자리가 있고 방장 소식이 신선한 방 ② 빈 방 ③ 방장 소식이 10분 넘게 끊긴 방 */
export function pickJumpRooms(rooms: Record<string, JumpSnap | undefined>, now: number): { room: string; create: boolean }[] {
  const out: { room: string; create: boolean }[] = []
  for (const id of JUMP_ROOMS) { const r = rooms[id]; if (r?.meta && !r.meta.started && now - r.meta.t < JUMP_STALE_MS * 3 && Object.keys(r.players).length < JUMP_MAX) out.push({ room: id, create: false }) }
  for (const id of JUMP_ROOMS) if (!rooms[id]?.meta) out.push({ room: id, create: true })
  for (const id of JUMP_ROOMS) { const r = rooms[id]; if (r?.meta && now - r.meta.t > 600000) out.push({ room: id, create: true }) }
  return out
}

export interface JumpRoom {
  uid: string
  room: string
  host: boolean
  /** 방장이 시작한다: 사람(uid 순)+컴퓨터 cpuCount 마리가 자리가 된다 */
  start(cpuCount: number): void
  /** 내가 둔(또는 방장이 대신 두는) 수를 서버에 쌓는다. n = 이 수의 번호(지금까지 적용한 수의 개수) */
  send(n: number, a: Action): void
  leave(): void
}

/** 시험용(주소에 ?mp=local): 같은 브라우저의 탭끼리 BroadcastChannel 로 같은 방을 쓴다 */
async function joinLocal(name: string, onRoom: (s: JumpSnap) => void): Promise<JumpRoom> {
  const ch = new BroadcastChannel('ryuso-jump-local')
  const uid = `L${Math.random().toString(36).slice(2, 8)}`
  const players: Record<string, { name: string }> = {}
  const moves: Action[] = []
  let meta: JumpMeta | null = null
  const push = () => onRoom({ meta, players: { ...players }, moves: [...moves] })
  const say = (m: unknown) => ch.postMessage(m)
  ch.onmessage = (e) => {
    const m = e.data as { type: string; uid?: string; p?: { name: string }; meta?: JumpMeta | null; n?: number; a?: Action }
    if (m.type === 'who') { say({ type: 'p', uid, p: players[uid] }); if (meta?.host === uid) say({ type: 'meta', meta }); moves.forEach((a, n) => say({ type: 'move', n, a })) }
    else if (m.type === 'p' && m.uid && m.p) { players[m.uid] = m.p; push() }
    else if (m.type === 'meta') { meta = m.meta ?? null; push() }
    else if (m.type === 'move' && m.a && typeof m.n === 'number') { if (m.n === moves.length) { moves.push(m.a); push() } }
    else if (m.type === 'bye' && m.uid) { delete players[m.uid]; if (meta?.host === m.uid && !meta.started) meta = null; push() }
  }
  say({ type: 'who' })
  await new Promise((r) => setTimeout(r, 350))
  const host = !meta
  if (host) { meta = { host: uid, seed: Math.floor(Math.random() * 900000) + 100, started: false, order: [], cpus: {}, t: Date.now() }; say({ type: 'meta', meta }) }
  players[uid] = { name: name.slice(0, 12) || '친구' }; say({ type: 'p', uid, p: players[uid] }); push()
  return {
    uid, room: 'local', host,
    start: (cpuCount) => {
      if (!host || !meta) return
      const uids = Object.keys(players).sort(), cpus: Record<number, number> = {}, order = [...uids]
      const pool = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5)
      for (let i = 0; i < cpuCount && order.length < JUMP_MAX; i++) { cpus[order.length] = pool[i]; order.push('cpu') }
      meta = { ...meta, started: true, order, cpus }; say({ type: 'meta', meta }); push()
    },
    send: (n, a) => { if (n === moves.length) { moves.push(a); say({ type: 'move', n, a }); push() } },
    leave: () => { say({ type: 'bye', uid }); ch.close() },
  }
}

/** 방에 들어간다. prefer: 초대받은 방(그 방이 아직 대기 중이고 자리가 있어야 한다). 자리가 없으면 null */
export async function joinJumpRoom(name: string, onRoom: (s: JumpSnap) => void, prefer?: string): Promise<JumpRoom | null> {
  if (localTest) return joinLocal(name, onRoom)
  const { user, db } = await connect()
  const root = ref(db as Database, 'lobby/jump')
  let skew = 0
  const offOff = onValue(ref(db, '.info/serverTimeOffset'), (s) => { skew = Number(s.val()) || 0 })
  const all = (await get(root)).val() as Record<string, unknown> | null
  const rooms: Record<string, JumpSnap> = {}
  for (const [id, v] of Object.entries(all ?? {})) rooms[id] = sanitizeRoom(v)
  let candidates = pickJumpRooms(rooms, Date.now() + skew)
  if (prefer) {
    const r = rooms[prefer]
    if (!(r?.meta && !r.meta.started && Object.keys(r.players).length < JUMP_MAX)) { offOff(); throw new Error('초대한 방이 이미 시작했거나 꽉 찼어요') }
    candidates = [{ room: prefer, create: false }]
  }
  if (!candidates.length) { offOff(); return null }
  let pick = candidates[0], lastErr: unknown = null, ready = false
  const step = async <T,>(label: string, p: PromiseLike<T>): Promise<T> => { try { return await p } catch (e) { const er = e instanceof Error ? e : new Error(String(e)); er.message = `[${label}] ${er.message}`; throw er } }
  for (const c of candidates) {
    pick = c
    if (!c.create) { ready = true; break }
    try {
      const base = `lobby/jump/${c.room}`
      // 남은 찌꺼기(옛 수 목록·옛 자리)를 치우고 내가 방장이 된다
      await remove(ref(db, `${base}/moves`)).catch(() => {})
      await step('방 만들기', set(ref(db, `${base}/meta`), { host: user.uid, seed: Math.floor(Math.random() * 900000) + 100, started: false, t: serverTimestamp() }))
      ready = true; break
    } catch (e) { lastErr = e }
  }
  if (!ready) { offOff(); throw lastErr }
  const base = `lobby/jump/${pick.room}`
  const roomRef = ref(db, base), metaRef = ref(db, `${base}/meta`), meRef = ref(db, `${base}/players/${user.uid}`)
  await step('내 자리 쓰기', set(meRef, { name: name.slice(0, 12) || '친구', t: serverTimestamp() }))
  onDisconnect(meRef).remove().catch(() => {})
  if (pick.create) onDisconnect(metaRef).remove().catch(() => {})
  const off = onValue(roomRef, (s) => onRoom(sanitizeRoom(s.val())))
  // 방장은 15초마다 소식을 새로 써서, 오래 기다려도 방이 살아 있게 한다
  const beat = pick.create ? window.setInterval(() => { update(metaRef, { t: serverTimestamp() }).catch(() => {}) }, 15000) : 0
  return {
    uid: user.uid, room: pick.room, host: pick.create,
    start: (cpuCount) => {
      if (!pick.create) return
      get(ref(db, `${base}/players`)).then((s) => {
        const uids = Object.keys(sanePlayers(s.val())).sort()
        const order: Record<number, string> = {}, cpus: Record<number, number> = {}
        uids.slice(0, JUMP_MAX).forEach((u, i) => { order[i] = u })
        const pool = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5)
        let n = Math.min(uids.length, JUMP_MAX)
        for (let i = 0; i < cpuCount && n < JUMP_MAX; i++, n++) { order[n] = 'cpu'; cpus[n] = pool[i] }
        update(metaRef, { started: true, order, cpus, t: serverTimestamp() }).catch(() => {})
      }).catch(() => {})
    },
    send: (n, a) => { set(ref(db, `${base}/moves/${n}`), { ...a, t: serverTimestamp() }).catch(() => {}) },
    leave: () => {
      off(); offOff(); if (beat) clearInterval(beat)
      onDisconnect(meRef).cancel().catch(() => {}); remove(meRef).catch(() => {})
      if (pick.create) { onDisconnect(metaRef).cancel().catch(() => {}); remove(ref(db, `${base}/moves`)).catch(() => {}); remove(metaRef).catch(() => {}) }
    },
  }
}
