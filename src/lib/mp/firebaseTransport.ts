/** Firebase Realtime Database 로 하는 연결. 경로: lobby/players/{uid}(지금 있는 곳 room 포함), lobby/chat/{id}, lobby/bosses/{장소}(같이 사냥하는 대왕 몬스터) (규칙은 database.rules.json).
 *  한 번 들어가면 카페·농장·산책·다른 탭 어디에 있든 같이 놀기에 남아 있고 채팅은 모두와 한다 */
import { child, get, limitToLast, onDisconnect, onValue, push, query, ref, remove, runTransaction, serverTimestamp, set, update, type Database, type DatabaseReference, type Unsubscribe } from 'firebase/database'
import { connect } from './firebase'
import { MAX_PLAYERS, bossCanRespawn, bossHit, saneBoss, saneFood, sanePlayer, type Boss, type ChatMsg, type Food, type Home, type PlayerState } from './core'
import { retained } from './presence'
import type { Transport } from './transport'

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
  let connected = false, ready = false, away = false, stopped = false
  const session = crypto.randomUUID()
  let expiredCb = () => {}
  let connectionCb = (_connected: boolean) => {}
  let pending: Promise<void> = Promise.resolve()
  const expire = () => { ready = false; expiredCb() }
  // Serialize reconnect/visibility transitions so a delayed foreground write cannot undo a lock.
  const activate = () => {
    pending = pending.then(async () => {
      if (!me || stopped || !connected || away) return
      const target = me
      const current = sanePlayer((await get(target)).val())
      if (stopped || !connected || away) return
      if (!current || current.session !== session || !retained(current, Date.now() + skew)) { expire(); return }
      await onDisconnect(target).update({ away: true, moving: false })
      if (stopped || !connected || away) return
      const result = await runTransaction(target, value => {
        if (stopped || !connected || away) return undefined
        const player = sanePlayer(value)
        return player?.session === session && retained(player, Date.now() + skew)
          ? { ...last, away: false, moving: false, t: serverTimestamp() } : undefined
      }, { applyLocally: false })
      if (!result.committed) { if (!stopped && !away && connected) expire(); return }
      ready = !stopped && connected && !away
      connectionCb(ready)
    }).catch(() => { ready = false; connectionCb(false) })
  }

  return {
    async join(state, resumeUid) {
      const { user, db: d } = await connect()
      db = d; uid = user.uid
      const players = ref(db, 'lobby/players')
      // .info 값은 get() 으로 읽을 수 없다(서버가 'Invalid token in path' 로 거절해 들어가기가 통째로 실패한다): 한 번만 듣는다
      skew = await new Promise<number>((resolve) => {
        const done = (v: number) => { clearTimeout(timer); resolve(v) }
        const timer = setTimeout(() => done(0), 3000)
        onValue(ref(db!, '.info/serverTimeOffset'), (s) => done(Number(s.val()) || 0), { onlyOnce: true })
      })
      const snapshot = (await get(players)).val() as Record<string, unknown> | null
      const previous = sanePlayer(snapshot?.[uid])
      if (resumeUid && (resumeUid !== uid || !previous || !retained(previous, Date.now() + skew))) return { uid, full: false, expired: true }
      const others = Object.entries(snapshot ?? {}).filter(([key, value]) => key !== uid && retained(sanePlayer(value) ?? { t: 0 }, Date.now() + skew))
      if (others.length >= MAX_PLAYERS) return { uid, full: true }
      me = child(players, uid)
      last = { ...(resumeUid && previous ? previous : state), look: state.look, session, away: false, moving: false }
      // 끊기면 자리 비움으로: 규칙이 이 쓰기를 「지금 있는 기록」에 비춰 검사하므로, 기록이 있을 때(복귀) 먼저, 새로 들어갈 때는 기록을 쓴 뒤에 건다
      if (resumeUid) await onDisconnect(me).update({ away: true, moving: false })
      if (resumeUid) {
        const restored = await runTransaction(me, value => {
          // 처음엔 가진 값이 없어 null 로 불린다: null 을 돌려주면 서버가 실제 값으로 다시 부른다(서버에도 없으면 아무것도 쓰지 않고 끝난다)
          if (value === null) return null
          const current = sanePlayer(value)
          return current && current.session === previous?.session && retained(current, Date.now() + skew)
            ? { ...last, t: serverTimestamp() } : undefined
        }, { applyLocally: false })
        if (!restored.committed || !restored.snapshot.exists()) { await onDisconnect(me).cancel(); me = null; return { uid, full: false, expired: true } }
      } else { await set(me, { ...last, t: serverTimestamp() }); await onDisconnect(me).update({ away: true, moving: false }) }
      connected = true; ready = true
      off.push(onValue(ref(db, '.info/connected'), (s) => {
        connected = s.val() === true
        ready = false
        connectionCb(false)
        if (connected) {
          if (away) void onDisconnect(me!).update({ away: true, moving: false }).catch(() => {})
          else activate()
        }
      }))
      off.push(onValue(ref(db, '.info/serverTimeOffset'), (s) => { skew = Number(s.val()) || 0 }))
      off.push(onValue(players, (s) => {
        const out: Record<string, PlayerState> = {}
        s.forEach((c) => { const p = sanePlayer(c.val()); if (p && c.key) out[c.key] = p })
        if (!stopped && connected && (!out[uid] || out[uid].session !== session)) { expire(); return }
        playersCb(out)
      }))
      chatRef = ref(db, 'lobby/chat')
      off.push(onValue(query(chatRef, limitToLast(30)), (s) => {
        const out: ChatMsg[] = []
        s.forEach((c) => {
          const v = c.val() as Record<string, unknown>
          if (c.key && typeof v?.text === 'string' && typeof v.uid === 'string') out.push({ id: c.key, uid: v.uid, name: typeof v.name === 'string' ? v.name : '친구', text: v.text, t: Number(v.t) || 0, ...(v.home === v.uid ? { home: v.uid } : {}), ...(typeof v.call === 'string' ? { call: v.call } : {}) })
        })
        chatCb(out)
      }))
      bossRef = ref(db, 'lobby/bosses')
      off.push(onValue(bossRef, (s) => { const out: Record<string, Boss> = {}; s.forEach((c) => { const b = saneBoss(c.val()); if (b && c.key) out[c.key] = b }); bossCb(out) }))
      return { uid: user.uid, full: false, ...(resumeUid && previous ? { player: previous } : {}) }
    },
    onExpired(cb) { expiredCb = cb },
    onConnection(cb) { connectionCb = cb },
    setAway(value) {
      away = value
      ready = false
      if (value) {
        // Do not touch t: repeated hidden/disconnect events must not extend the ten minutes.
        if (me && connected) void update(me, { away: true, moving: false }).catch(() => {})
      } else activate()
    },
    update(part) {
      if (!me) return
      Object.assign(last, part)
      if (!ready || away || !connected || stopped) return
      update(me, { ...part, away: false, t: serverTimestamp() }).catch(() => { ready = false; connectionCb(false) })
    },
    chat(name, text, home, call) {
      if (!chatRef || !me || !ready) return
      push(chatRef, { uid: me.key, name, text, t: serverTimestamp(), ...(home ? { home: me.key } : {}), ...(call ? { call } : {}) }).catch(() => {})
    },
    hitBoss(room, id, power) {
      if (!bossRef || !me) return
      // 트랜잭션: 여럿이 동시에 쳐도 서로 덮어쓰지 않고 차례로 깎인다
      runTransaction(child(bossRef, room), (cur) => { const b = bossHit(saneBoss(cur), id, power); return b ? { ...b, t: serverTimestamp() } : undefined }).catch(() => {})
    },
    spawnBoss(room, next) {
      if (!bossRef || !me) return
      const now = Date.now() + skew
      runTransaction(child(bossRef, room), (cur) => (bossCanRespawn(saneBoss(cur), now) ? { ...next, t: serverTimestamp() } : undefined)).catch(() => {})
    },
    openHome(home) {
      if (!db || !uid) return
      const r = ref(db, `lobby/homes/${uid}`)

      set(r, { ...home, t: serverTimestamp() }).catch(() => {})
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
      push(ref(db, `lobby/food/${host}`), { ...food, t: serverTimestamp() }).catch(() => {})
    },
    eatFood(host, id) {
      if (!db) return
      remove(ref(db, `lobby/food/${host}/${id}`)).catch(() => {})
    },
    leave() {
      stopped = true; ready = false
      for (const f of off) f()
      off = []
      const target = me, database = db, owner = uid
      me = null; chatRef = null; bossRef = null
      if (target && database) {
        void onDisconnect(target).cancel().catch(() => {})
        // Compare ownership before removal: leaving an old tab must not delete a newer session.
        // 처음엔 가진 값이 없어 null 로 불릴 수 있다: 그때 그만두면(undefined) 서버 값으로 다시 묻지 않아 지워지지 않는다. null 을 돌려주면 서버가 실제 값으로 다시 부른다
        void runTransaction(ref(database, 'lobby/players/' + owner), current => current === null || current?.session === session ? null : undefined)
          .catch(() => {})
      }
    },
    onPlayers(cb) { playersCb = cb },
    onChat(cb) { chatCb = cb },
    onBosses(cb) { bossCb = cb },
    offset: () => skew,
  }
}
