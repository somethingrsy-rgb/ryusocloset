/**
 * 별 거품 같이 하기 방(Firebase `lobby/bub/b1`, 방은 하나). 규칙은 database.rules.json.
 * - 방장 한 곳(host)이 괴물·거품·과일·점수·목숨을 계산해서 `state` 에 약 10번/초 쓴다. 숫자 목록은 짧은 글(문자열)로 묶어 쓴다.
 * - 나머지는 자기 몸의 위치(`p`)와 마지막으로 쏜 거품(`sh`)·준비만 자기 칸(players/내uid)에 쓴다.
 * - 방장이 나가면 방이 사라지고 모두 대기실로 돌아간다. 주소에 ?mp=local 이면 같은 브라우저 탭끼리 BroadcastChannel 로 시험한다.
 */
import { onDisconnect, onValue, ref, remove, serverTimestamp, set, get, update, type Database } from 'firebase/database'
import { connect } from './firebase'
import { localTest } from './config'

export const BUB_ROOMS = ['b1'] as const
export const BUB_MAX = 4
export const BUB_STALE_MS = 60000
export interface BPlayer { name: string; look: string; ready: boolean; /** "x,y,vy,방향" */ p: string; /** "번호,x,y,방향" 마지막으로 쏜 거품 */ sh: string; j: number }
export interface BMeta { host: string; phase: 'lobby' | 'play'; round: number; part: string[]; t: number }
/** 방장이 보내는 세상: 숫자를 쉼표·세미콜론으로 묶은 짧은 글 */
export interface BState { r: number; lv: number; ph: 0 | 1 | 2 | 3; sc: number; li: number; st: number; /** 괴물 "id,x,y,방향,화남" */ f: string; /** 거품 "id,x,y,갇힌괴물id" */ b: string; /** 과일 "id,x,y,종류" */ fr: string; /** 대왕 "x,y,방향,체력,최대,아픔,종류" 또는 빈 글 */ bo: string; /** 사람별 "uid,x,y,방향,안전,다침횟수,튐횟수" */ pl: string; /** 몇 번째 소식인지 */ n: number }
export interface BubSnap { meta: BMeta | null; players: Record<string, BPlayer>; state: BState | null }

const fin = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const rng = (v: unknown, lo: number, hi: number, d = 0) => { const n = fin(v); return n === null ? d : Math.max(lo, Math.min(hi, n)) }
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

export function saneMeta(v: unknown): BMeta | null {
  const r = obj(v); if (typeof r.host !== 'string') return null
  return { host: r.host.slice(0, 64), phase: r.phase === 'play' ? 'play' : 'lobby', round: rng(r.round, 0, 99999), part: Object.keys(obj(r.part)).slice(0, BUB_MAX), t: rng(r.t, 0, 1e15) }
}
export function sanePlayers(v: unknown): Record<string, BPlayer> {
  const out: Record<string, BPlayer> = {}
  for (const [u, raw] of Object.entries(obj(v))) {
    const p = obj(raw); if (typeof p.name !== 'string' || !p.name) continue
    out[u] = { name: p.name.slice(0, 12), look: str(p.look, 900), ready: p.ready === true, p: str(p.p, 60), sh: str(p.sh, 60), j: rng(p.j, 0, 1e15) }
  }
  return out
}
export function saneState(v: unknown): BState | null {
  const r = obj(v); if (fin(r.r) === null) return null
  const ph = r.ph === 1 ? 1 : r.ph === 2 ? 2 : r.ph === 3 ? 3 : 0
  return { r: rng(r.r, 0, 99999), lv: rng(r.lv, 0, 8), ph, sc: rng(r.sc, 0, 1e9), li: rng(r.li, 0, 9), st: rng(r.st, 0, 9999), f: str(r.f, 700), b: str(r.b, 700), fr: str(r.fr, 500), bo: str(r.bo, 90), pl: str(r.pl, 400), n: rng(r.n, 0, 1e9) }
}
export const sanitizeBub = (v: unknown): BubSnap => { const r = obj(v); return { meta: saneMeta(r.meta), players: sanePlayers(r.players), state: saneState(r.state) } }

/** 숫자 목록 글 ↔ 배열: "a,b,c;d,e,f" */
export const pack = (rows: (string | number)[][]) => rows.map((r) => r.map((x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x)).join(',')).join(';')
export const unpack = (s: string): string[][] => (s ? s.split(';').map((r) => r.split(',')) : [])
export const num = (v: string | undefined, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d }

export interface BubRoom {
  uid: string; room: string; host: boolean
  /** 서버 시각 기준 지금(ms) */
  now(): number
  /** 내 칸 고쳐 쓰기(위치·쏜 거품·준비) */
  patchMe(p: Partial<Pick<BPlayer, 'ready' | 'p' | 'sh'>>): void
  /** 방장만: 판 정보 고쳐 쓰기 */
  setMeta(m: Partial<Omit<BMeta, 'host' | 't'>>): void
  /** 방장만: 세상 쓰기 */
  setState(s: BState | null): void
  leave(): void
}

/** 시험용(?mp=local): 같은 브라우저의 탭끼리 BroadcastChannel 로 같은 방을 쓴다 */
async function joinLocal(name: string, onSnap: (s: BubSnap) => void, look: string): Promise<BubRoom> {
  const ch = new BroadcastChannel('ryuso-bub-local')
  const uid = `L${Math.random().toString(36).slice(2, 8)}`
  const players: Record<string, BPlayer> = {}
  let meta: BMeta | null = null, state: BState | null = null
  const push = () => onSnap({ meta, players: { ...players }, state })
  const say = (m: unknown) => ch.postMessage(m)
  ch.onmessage = (e) => {
    const m = e.data as { type: string; uid?: string; p?: BPlayer; meta?: BMeta | null; state?: BState | null }
    if (m.type === 'who') { if (players[uid]) say({ type: 'p', uid, p: players[uid] }); if (meta?.host === uid) { say({ type: 'meta', meta }); say({ type: 'state', state }) } }
    else if (m.type === 'p' && m.uid && m.p) { players[m.uid] = m.p; push() }
    else if (m.type === 'meta') { meta = m.meta ?? null; push() }
    else if (m.type === 'state') { state = m.state ?? null; push() }
    else if (m.type === 'bye' && m.uid) { delete players[m.uid]; if (meta?.host === m.uid) { meta = null; state = null } push() }
  }
  say({ type: 'who' })
  await new Promise((r) => setTimeout(r, 350))
  const host = !meta
  if (host) { meta = { host: uid, phase: 'lobby', round: 0, part: [], t: Date.now() }; say({ type: 'meta', meta }) }
  players[uid] = { name: name.slice(0, 12) || '친구', look, ready: false, p: '', sh: '', j: Date.now() }; say({ type: 'p', uid, p: players[uid] }); push()
  return {
    uid, room: 'b1', host, now: () => Date.now(),
    patchMe: (p) => { players[uid] = { ...players[uid], ...p }; say({ type: 'p', uid, p: players[uid] }); push() },
    setMeta: (m) => { if (!host || !meta) return; meta = { ...meta, ...m, t: Date.now() }; say({ type: 'meta', meta }); push() },
    setState: (s) => { if (!host) return; state = s; say({ type: 'state', state }); push() },
    leave: () => { say({ type: 'bye', uid }); ch.close() },
  }
}

/** 방에 들어간다(방은 하나): 대기 중인 방이 있으면 들어가고, 없으면 새로 만든다. 이미 시작했거나 꽉 찼으면 이유를 담아 던진다 */
export async function joinBubRoom(name: string, onSnap: (s: BubSnap) => void, opts: { look?: string } = {}): Promise<BubRoom> {
  if (localTest) return joinLocal(name, onSnap, opts.look ?? '')
  const { user, db } = await connect()
  let skew = 0
  const offOff = onValue(ref(db as Database, '.info/serverTimeOffset'), (s) => { skew = Number(s.val()) || 0 })
  const cur = sanitizeBub((await get(ref(db, 'lobby/bub/b1'))).val())
  const alive = !!cur.meta && Date.now() + skew - cur.meta.t < BUB_STALE_MS * 3
  let create = !cur.meta || !alive
  if (!create) {
    if (cur.meta!.phase !== 'lobby') { offOff(); throw new Error('친구들이 지금 놀고 있어요. 끝나면 같이 해요') }
    if (Object.keys(cur.players).length >= BUB_MAX) { offOff(); throw new Error('방이 4명으로 꽉 찼어요') }
  }
  const base = 'lobby/bub/b1'
  const step = async <T,>(label: string, p: PromiseLike<T>): Promise<T> => { try { return await p } catch (e) { const er = e instanceof Error ? e : new Error(String(e)); er.message = `[${label}] ${er.message}`; offOff(); throw er } }
  if (create) {
    await remove(ref(db, `${base}/state`)).catch(() => {})
    await step('방 만들기', set(ref(db, `${base}/meta`), { host: user.uid, phase: 'lobby', round: 0, t: serverTimestamp() }))
    create = true
  }
  const roomRef = ref(db, base), metaRef = ref(db, `${base}/meta`), stateRef = ref(db, `${base}/state`), meRef = ref(db, `${base}/players/${user.uid}`)
  await step('내 자리 쓰기', set(meRef, { name: name.slice(0, 12) || '친구', look: (opts.look ?? '').slice(0, 900), ready: false, p: '', sh: '', j: Date.now() + skew, t: serverTimestamp() }))
  onDisconnect(meRef).remove().catch(() => {})
  if (create) onDisconnect(metaRef).remove().catch(() => {})
  const off = onValue(roomRef, (s) => onSnap(sanitizeBub(s.val())))
  const beat = create ? window.setInterval(() => { update(metaRef, { t: serverTimestamp() }).catch(() => {}) }, 15000) : 0
  return {
    uid: user.uid, room: 'b1', host: create, now: () => Date.now() + skew,
    patchMe: (p) => { update(meRef, { ...p }).catch(() => {}) },
    setMeta: (m) => {
      if (!create) return
      const u: Record<string, unknown> = { ...m, t: serverTimestamp() }
      if (m.part) u.part = Object.fromEntries(m.part.map((x) => [x, 1]))
      update(metaRef, u).catch(() => {})
    },
    setState: (s) => { if (!create) return; if (!s) { remove(stateRef).catch(() => {}); return } set(stateRef, s).catch(() => {}) },
    leave: () => {
      off(); offOff(); if (beat) clearInterval(beat)
      onDisconnect(meRef).cancel().catch(() => {}); remove(meRef).catch(() => {})
      if (create) { onDisconnect(metaRef).cancel().catch(() => {}); remove(stateRef).catch(() => {}); remove(metaRef).catch(() => {}) }
    },
  }
}
