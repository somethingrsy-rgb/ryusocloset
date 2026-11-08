/** 시험용 연결(주소에 ?mp=local): 같은 브라우저의 다른 탭끼리 BroadcastChannel 로 주고받는다. Firebase 설정 없이 화면을 확인할 때 */
import { MAX_PLAYERS, bossCanRespawn, bossHit, saneBoss, saneFood, sanePlayer, type Boss, type ChatMsg, type Food, type Home, type PlayerState } from './core'
import type { Transport } from './transport'

export function localTransport(): Transport {
  const uid = `local-${Math.random().toString(36).slice(2, 10)}`
  let ch: BroadcastChannel | null = null
  let state: Record<string, unknown> = {}
  const players: Record<string, PlayerState> = {}
  const chat: ChatMsg[] = []
  let playersCb: (p: Record<string, PlayerState>) => void = () => {}
  let chatCb: (m: ChatMsg[]) => void = () => {}
  let beat = 0
  let boss: Boss | null = null
  // 집 놀이: 집(방 꾸밈)과 바닥 음식. 지켜보는 쪽에 알려 준다
  const homes: Record<string, Home> = {}
  const foods: Record<string, Record<string, Food>> = {}
  const watchers = new Set<{ host: string; cb: (h: Home | null, f: Food[]) => void }>()
  const tellWatch = (host: string) => watchers.forEach((w) => { if (w.host === host) w.cb(homes[host] ?? null, Object.values(foods[host] ?? {})) })
  const myHome = () => { if (homes[uid]) ch?.postMessage({ type: 'home', uid, home: homes[uid] }); for (const f of Object.values(foods[uid] ?? {})) ch?.postMessage({ type: 'food+', uid, host: uid, food: f }) }
  let bossCb: (b: Boss | null) => void = () => {}
  const setBoss = (b: Boss, tell: boolean) => { boss = b; bossCb(b); if (tell) ch?.postMessage({ type: 'boss', uid, boss: b }) }
  const emit = () => playersCb({ ...players })
  const send = () => ch?.postMessage({ type: 'p', uid, state: { ...state, t: Date.now() } })
  const bye = () => ch?.postMessage({ type: 'bye', uid })
  return {
    async join(me) {
      ch = new BroadcastChannel('ryuso-mp-lobby')
      state = { ...me }
      ch.onmessage = (e) => {
        const m = e.data as { type: string; uid: string; state?: unknown; msg?: ChatMsg }
        if (m.type === 'p') { const p = sanePlayer(m.state); if (p) { players[m.uid] = { ...p, t: Date.now() }; emit() } }
        else if (m.type === 'hi') { send(); if (boss) ch?.postMessage({ type: 'boss', uid, boss }); myHome() }
        else if (m.type === 'home') { const h = (m as { home?: Home | null }).home; if (h) homes[m.uid] = h; else delete homes[m.uid]; tellWatch(m.uid) }
        else if (m.type === 'food+') { const x = m as unknown as { host: string; food: Food }; const f = saneFood(x.food?.id, x.food); if (f) { (foods[x.host] ??= {})[f.id] = f; tellWatch(x.host) } }
        else if (m.type === 'food-') { const x = m as unknown as { host: string; id: string }; if (foods[x.host]) { delete foods[x.host][x.id]; tellWatch(x.host) } }
        else if (m.type === 'boss') { const b = saneBoss((m as { boss?: unknown }).boss); if (b && (!boss || b.id !== boss.id || b.hp < boss.hp)) setBoss(b, false) }
        else if (m.type === 'bye') { delete players[m.uid]; emit(); if (homes[m.uid]) { delete homes[m.uid]; tellWatch(m.uid) } }
        else if (m.type === 'chat' && m.msg) { chat.push(m.msg); chatCb(chat.slice(-30)) }
      }
      ch.postMessage({ type: 'hi', uid })
      await new Promise((r) => setTimeout(r, 300))
      if (Object.keys(players).length >= MAX_PLAYERS) { ch.close(); ch = null; return { uid, full: true } }
      players[uid] = { ...(sanePlayer({ ...state, t: Date.now() }) as PlayerState) }
      send(); emit()
      beat = window.setInterval(send, 2000)
      window.addEventListener('pagehide', bye)
      return { uid, full: false }
    },
    update(part) { Object.assign(state, part); players[uid] = { ...(sanePlayer({ ...state, t: Date.now() }) as PlayerState) }; send() },
    chat(name, text, home) {
      const msg: ChatMsg = { id: `${Date.now()}-${uid}`, uid, name, text, t: Date.now(), ...(home ? { home: uid } : {}) }
      chat.push(msg); chatCb(chat.slice(-30))
      ch?.postMessage({ type: 'chat', uid, msg })
    },
    hitBoss(id, power) { const b = bossHit(boss, id, power); if (b) setBoss({ ...b, t: Date.now() }, true) },
    spawnBoss(next) { if (bossCanRespawn(boss, Date.now())) setBoss({ ...next, t: Date.now() }, true) },
    onBoss(cb) { bossCb = cb },
    async openHome(home) { homes[uid] = { ...home, t: Date.now() }; ch?.postMessage({ type: 'home', uid, home: homes[uid] }); tellWatch(uid) },
    closeHome() { delete homes[uid]; ch?.postMessage({ type: 'home', uid, home: null }); tellWatch(uid) },
    watchHome(host, cb) { const w = { host, cb }; watchers.add(w); cb(homes[host] ?? null, Object.values(foods[host] ?? {})); return () => { watchers.delete(w) } },
    addFood(host, food) { const f: Food = { ...food, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, t: Date.now() }; (foods[host] ??= {})[f.id] = f; ch?.postMessage({ type: 'food+', uid, host, food: f }); tellWatch(host) },
    eatFood(host, id) { if (foods[host]) delete foods[host][id]; ch?.postMessage({ type: 'food-', uid, host, id }); tellWatch(host) },
    leave() { bye(); clearInterval(beat); window.removeEventListener('pagehide', bye); ch?.close(); ch = null },
    onPlayers(cb) { playersCb = cb },
    onChat(cb) { chatCb = cb },
    offset: () => 0,
  }
}
