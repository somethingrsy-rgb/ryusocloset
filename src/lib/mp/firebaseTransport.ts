/** Firebase Realtime Database 로 하는 연결. 경로: lobby/players/{uid}(지금 있는 곳 room 포함), lobby/chat/{id}, lobby/bosses/{장소}(같이 사냥하는 대왕 몬스터) (규칙은 database.rules.json).
 *  한 번 들어가면 카페·농장·산책·다른 탭 어디에 있든 같이 놀기에 남아 있고 채팅은 모두와 한다 */
import { child, get, limitToLast, onDisconnect, onValue, push, query, ref, remove, runTransaction, serverTimestamp, set, update, type Database, type DatabaseReference, type Unsubscribe } from 'firebase/database'
import { connect } from './firebase'
import { MAX_PLAYERS, bossCanRespawn, bossHit, saneBoss, saneFood, sanePlayer, type Boss, type ChatMsg, type Food, type Home, type PlayerState } from './core'
import type { Transport } from './transport'

/** 서버가 쓰기를 거절하면(대개 Firebase 콘솔의 보안 규칙이 예전 것일 때) 화면에 알린다: MultiplayerBar 가 듣는다 */
export const MP_DENIED = 'ryuso:mp-denied'
const denied = (what: string) => (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e)
  // 규칙 거절(permission)이든 다른 실패(연결 끊김 등)든 조용히 넘기지 않고 화면에 알린다
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(MP_DENIED, { detail: { what, rules: /permission/i.test(msg), msg: msg.slice(0, 80) } }))
}

export function firebaseTransport(): Transport {
  let me: DatabaseReference | null = null
  let chatRef: DatabaseReference | null = null
  let bossRef: DatabaseReference | null = null
  let db: Database | null = null
  let uid = ''
  let bossCb: (b: Record<string, Boss>) => void = () => {}
  let last: Record<string, unknown> = {}
  let playersCb: (p: Record<string, PlayerState>) => void = () => {}
  let chatCb: (m: ChatMsg[]) => void = () => {}
  let off: Unsubscribe[] = []
  let skew = 0
  return {
    async join(state) {
      const { user, db: d } = await connect()
      db = d; uid = user.uid
      const players = ref(db, 'lobby/players')
      // 10명이 넘으면 들어가지 않는다(규칙으로는 사람 수를 셀 수 없어서 들어가기 전에 확인한다)
      const now = (await get(players)).val() as Record<string, unknown> | null
      const others = Object.keys(now ?? {}).filter((k) => k !== user.uid)
      if (others.length >= MAX_PLAYERS) return { uid: user.uid, full: true }
      me = child(players, user.uid)
      last = { ...state }
      const meRef = me
      // 다시 연결될 때마다: 끊기면 내 자리를 지우도록 걸어 두고, 내 상태를 다시 쓴다
      off.push(onValue(ref(db, '.info/connected'), (s) => {
        if (s.val() !== true) return
        onDisconnect(meRef).remove().then(() => set(meRef, { ...last, t: serverTimestamp() })).catch(() => {})
      }))
      off.push(onValue(ref(db, '.info/serverTimeOffset'), (s) => { skew = Number(s.val()) || 0 }))
      off.push(onValue(players, (s) => {
        const out: Record<string, PlayerState> = {}
        s.forEach((c) => { const p = sanePlayer(c.val()); if (p && c.key) out[c.key] = p })
        playersCb(out)
      }))
      chatRef = ref(db, 'lobby/chat')
      off.push(onValue(query(chatRef, limitToLast(30)), (s) => {
        const out: ChatMsg[] = []
        s.forEach((c) => {
          const v = c.val() as Record<string, unknown>
          if (c.key && typeof v?.text === 'string' && typeof v.uid === 'string') out.push({ id: c.key, uid: v.uid, name: typeof v.name === 'string' ? v.name : '친구', text: v.text, t: Number(v.t) || 0, ...(v.home === v.uid ? { home: v.uid } : {}) })
        })
        chatCb(out)
      }))
      bossRef = ref(db, 'lobby/bosses')
      off.push(onValue(bossRef, (s) => { const out: Record<string, Boss> = {}; s.forEach((c) => { const b = saneBoss(c.val()); if (b && c.key) out[c.key] = b }); bossCb(out) }))
      return { uid: user.uid, full: false }
    },
    update(part) {
      if (!me) return
      Object.assign(last, part)
      update(me, { ...part, t: serverTimestamp() }).catch(() => {})
    },
    chat(name, text, home) {
      if (!chatRef || !me) return
      push(chatRef, { uid: me.key, name, text, t: serverTimestamp(), ...(home ? { home: me.key } : {}) }).catch(denied('채팅'))
    },
    hitBoss(room, id, power) {
      if (!bossRef || !me) return
      // 트랜잭션: 여럿이 동시에 쳐도 서로 덮어쓰지 않고 차례로 깎인다
      runTransaction(child(bossRef, room), (cur) => { const b = bossHit(saneBoss(cur), id, power); return b ? { ...b, t: serverTimestamp() } : undefined }).catch(denied('대왕 몬스터'))
    },
    spawnBoss(room, next) {
      if (!bossRef || !me) return
      const now = Date.now() + skew
      runTransaction(child(bossRef, room), (cur) => (bossCanRespawn(saneBoss(cur), now) ? { ...next, t: serverTimestamp() } : undefined)).catch(denied('대왕 몬스터'))
    },
    openHome(home) {
      if (!db || !uid) return
      const r = ref(db, `lobby/homes/${uid}`)
      onDisconnect(r).remove().catch(() => {})
      set(r, { ...home, t: serverTimestamp() }).catch(denied('집 열기'))
    },
    closeHome() {
      if (!db || !uid) return
      const r = ref(db, `lobby/homes/${uid}`)
      onDisconnect(r).cancel().catch(() => {})
      remove(r).catch(() => {})
    },
    watchHome(host, cb) {
      if (!db) return () => {}
      let home: Home | null = null, foods: Food[] = []
      const a = onValue(ref(db, `lobby/homes/${host}`), (s) => { const v = s.val() as Home | null; home = v && typeof v.name === 'string' ? { name: v.name, room: v.room, t: Number(v.t) || 0 } : null; cb(home, foods) })
      const b = onValue(ref(db, `lobby/food/${host}`), (s) => { const out: Food[] = []; s.forEach((c) => { const f = c.key ? saneFood(c.key, c.val()) : null; if (f) out.push(f) }); foods = out; cb(home, foods) })
      return () => { a(); b() }
    },
    addFood(host, food) {
      if (!db) return
      push(ref(db, `lobby/food/${host}`), { ...food, t: serverTimestamp() }).catch(denied('간식'))
    },
    eatFood(host, id) {
      if (!db) return
      remove(ref(db, `lobby/food/${host}/${id}`)).catch(() => {})
    },
    leave() {
      for (const f of off) f()
      off = []
      if (me) { onDisconnect(me).cancel().catch(() => {}); remove(me).catch(() => {}) }
      if (db && uid) { const h = ref(db, `lobby/homes/${uid}`); onDisconnect(h).cancel().catch(() => {}); remove(h).catch(() => {}) }
      me = null
      chatRef = null
      bossRef = null
    },
    onPlayers(cb) { playersCb = cb },
    onChat(cb) { chatCb = cb },
    onBosses(cb) { bossCb = cb },
    offset: () => skew,
  }
}
