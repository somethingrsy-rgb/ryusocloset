import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { earnStars } from '../lib/shop'
import { playLose, playPop, playTap, playWin } from '../lib/sound'
import { assetUrl } from '../lib/items'
import { localTest, multiplayerAvailable } from '../lib/mp/config'
import { sayStar, savedName } from '../lib/mp/session'
import { RACE_INVITE_EVENT, takeStarInvite } from '../lib/raceInvite'
import { joinStarRoom, STAR_MAX, type SState, type StarRoom, type StarSnap } from '../lib/mp/starNet'
import { createStarScene, SLOT_COLORS, SLOT_SHAPES, type StarScene } from './starScene3d'
import { AVATARS, getAvatar } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import type { Outfit } from '../lib/types'
import { CFG, applyCatch, fillStars, newRound, stepWalker, tick, type Round, type Who } from '../lib/starChase'

/**
 * 도망간 별을 잡아라: 2~4명이 별의 양쪽으로 다가가 느려지게 하고, 가까운 친구가 「잡기」로 별을 모아 별자리를 완성한다(혼자는 연습).
 * 규칙·별 움직임은 lib/starChase.ts(순수 함수), 방 연결은 lib/mp/starNet.ts. 별과 잡기 판정은 방장 한 곳에서만 돌린다.
 */
const SHAPES = SLOT_SHAPES, COLORS = SLOT_COLORS
const SPAWN: [number, number][] = [[-3, 3], [3, 3], [-3, -3], [3, -3]]
const SAYS = ['이쪽이야!', '같이 잡자!', '고마워!']
const INTRO_KEY = 'ryuso.star.intro'
const COUNTDOWN_MS = 3500
const hasKey = (k: string) => { try { return !!localStorage.getItem(k) } catch { return false } }
const setKey = (k: string) => { try { localStorage.setItem(k, '1') } catch { /* 저장 못 해도 괜찮다 */ } }
const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }

type Screen = 'menu' | 'room'
interface Anim { k: 'fly' | 'miss'; x: number; y: number; t0: number }

export function StarChase({ onClose, outfit }: { onClose: () => void; outfit: Outfit }) {
  const [screen, setScreen] = useState<Screen>('menu')
  const [snap, setSnap] = useState<StarSnap>({ meta: null, players: {}, state: null })
  const [room, setRoom] = useState<StarRoom | null>(null)
  const [practice, setPractice] = useState(false)
  const [err, setErr] = useState('')
  const [invited, setInvited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [intro, setIntro] = useState(false)
  const [settings, setSettings] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [calm, setCalm] = useState(() => hasKey('ryuso.star.calm'))
  const [chat, setChat] = useState(false)
  const [hostGone, setHostGone] = useState(false)
  const [, force] = useState(0)
  const roomRef = useRef<StarRoom | null>(null)
  const snapRef = useRef(snap); snapRef.current = snap
  const seenMeta = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; roomRef.current?.leave(); roomRef.current = null } }, [])

  const enter = useCallback(async (how: { practice?: boolean; code?: string; create?: boolean }) => {
    if (busy) return
    setBusy(true); setErr(''); seenMeta.current = false; setHostGone(false)
    try {
      const r = await joinStarRoom(savedName() || '친구', (s) => { if (mounted.current) { if (s.meta) seenMeta.current = true; setSnap(s) } }, { ...how, look: JSON.stringify({ avatar: getAvatar().id, outfit }) })
      if (!mounted.current) { r?.leave(); return }
      if (!r) { setErr('지금은 친구들이 놀고 있거나 방이 꽉 찼어요. 조금 뒤에 다시 해 봐요'); setBusy(false); return }
      roomRef.current = r; setRoom(r); setPractice(!!how.practice); setScreen('room')
      if (!hasKey(INTRO_KEY)) setIntro(true)
    } catch (e) { setErr(e instanceof Error ? e.message.replace(/^\[[^\]]+\]\s*/, '') || '연결하지 못했어요' : '연결하지 못했어요') }
    setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy])

  if (localTest) (window as unknown as { __star?: () => unknown }).__star = () => ({ snap: snapRef.current, me: meRef.current }) // 시험용(?mp=local 에서만)
  // 친구의 초대를 수락해서 열렸으면 바로 그 방으로 들어간다
  useEffect(() => {
    const go = () => { const inv = takeStarInvite(); if (inv) void enter({ code: inv.room }) }
    const t = window.setTimeout(go, 30); window.addEventListener(RACE_INVITE_EVENT, go)
    return () => { clearTimeout(t); window.removeEventListener(RACE_INVITE_EVENT, go) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const meta = snap.meta
  const me = room?.uid ?? ''
  const phase = meta?.phase ?? 'lobby'
  const slotOrder = useMemo(() => Object.entries(snap.players).sort((a, b) => a[1].j - b[1].j || a[0].localeCompare(b[0])).map(([u]) => u), [snap.players])
  const part = meta?.part ?? []
  const myIn = !!room && part.includes(me)
  const isHost = !!room?.host
  useEffect(() => { if (screen === 'room' && !meta && seenMeta.current && !practice) setHostGone(true) }, [meta, screen, practice])

  // 대기실로 돌아오면 준비 표시를 지운다
  const lastPhase = useRef('lobby')
  useEffect(() => { if (phase === 'lobby' && lastPhase.current !== 'lobby') room?.patchMe({ ready: false }); lastPhase.current = phase }, [phase, room])

  /* ───── 방장: 한 판 시작 / 별 시뮬레이션 ───── */
  const roundRef = useRef<{ r: Round; acc: Record<string, number>; lastReq: Record<string, number>; evN: number; ev: SState['ev']; lastWrite: number; last: number } | null>(null)
  const meRef = useRef({ x: 0, y: 0 })
  const whoList = (): Who[] => {
    const m = snapRef.current.meta
    return (m?.part ?? []).map((u) => (u === roomRef.current?.uid ? { uid: u, on: true, x: meRef.current.x, y: meRef.current.y } : { uid: u, on: !!snapRef.current.players[u], x: snapRef.current.players[u]?.x ?? 0, y: snapRef.current.players[u]?.y ?? 0 }))
  }
  const toState = (c: NonNullable<typeof roundRef.current>): SState => ({ r: c.r.id, caught: c.r.caught, res: c.r.res === 'win' ? 1 : c.r.res === 'lose' ? 2 : 0, ev: c.ev, acc: c.acc, stars: c.r.stars.map((s) => ({ id: s.id, x: +s.x.toFixed(2), y: +s.y.toFixed(2), m: s.mode === 'wander' ? 0 : s.mode === 'flee' ? 1 : 2 })) })
  function startGame(r: StarRoom, solo = false) {
    if (!r.host) return
    const ids = solo ? [r.uid] : slotOrder.slice(0, STAR_MAX)
    const secs = (localTest && Number(new URLSearchParams(location.search).get('sec'))) || CFG.seconds // 시험용: ?mp=local&sec=15
    const startAt = r.now() + COUNTDOWN_MS, endAt = startAt + secs * 1000
    const id = (snapRef.current.meta?.round ?? 0) + 1
    const who: Who[] = ids.map((u, i) => ({ uid: u, on: true, x: SPAWN[i][0], y: SPAWN[i][1] }))
    const rd = fillStars(newRound(id, ids.length, endAt), who, 0, Math.random, true)
    roundRef.current = { r: rd, acc: {}, lastReq: {}, evN: 0, ev: null, lastWrite: 0, last: r.now() }
    r.setMeta({ phase: 'play', round: id, target: rd.target, startAt, endAt, part: ids })
    r.setState(toState(roundRef.current))
  }
  useEffect(() => {
    if (!room || !room.host || phase !== 'play' || !meta) return
    const iv = window.setInterval(() => {
      const c = roundRef.current; if (!c || c.r.res || !roomRef.current) return
      const now = room.now()
      if (now < meta.startAt) { c.last = now; return }
      const dt = Math.min(0.2, (now - c.last) / 1000); c.last = now
      const who = whoList(); let changed = false
      // 잡기 요청 처리(요청마다 한 번만): 위치·쿨다운·접속·라운드를 방장이 다시 확인한다
      for (const [u, p] of Object.entries(snapRef.current.players)) {
        const cap = p.cap; if (!cap || cap.n <= (c.acc[u] ?? 0)) continue
        c.acc[u] = cap.n; changed = true
        const w = who.find((x) => x.uid === u); if (!w) continue
        const cd = (c.lastReq[u] ?? -1e9) + CFG.catchCd * 1000 - 150 - now
        c.lastReq[u] = now
        const res = applyCatch(c.r, { round: cap.r, cdLeft: cd }, w, now)
        if (res.star) { c.r = res.round; c.ev = { n: ++c.evN, x: res.star.x, y: res.star.y } }
      }
      c.r = tick(c.r, who, dt, now, Math.random)
      const over = !!c.r.res
      if (over || changed || now - c.lastWrite >= 100) { c.lastWrite = now; room.setState(toState(c)) }
      if (over) room.setMeta({ phase: 'done' })
    }, 50)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, phase, meta?.round])

  // 연습: 첫 안내를 닫은 뒤에 시작한다
  useEffect(() => { if (practice && room && !intro && meta && meta.phase === 'lobby' && meta.round === 0) startGame(room, true) }, [practice, room, intro, meta?.phase, meta?.round]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ───── 입력 ───── */
  const input = useRef({ jx: 0, jy: 0, kx: 0, ky: 0 })
  const keys = useRef(new Set<string>())
  const capSeq = useRef(Date.now() % 1e9)
  const lastCatch = useRef(-1e9)
  const anims = useRef<Anim[]>([])
  const doCatch = useCallback(() => {
    const r = roomRef.current, m = snapRef.current.meta; if (!r || !m || m.phase !== 'play' || !m.part.includes(r.uid)) return
    const now = r.now(); if (now < m.startAt || now - lastCatch.current < CFG.catchCd * 1000) return
    lastCatch.current = now; capSeq.current += 1
    r.patchMe({ cap: { n: capSeq.current, r: m.round } }); playTap()
    anims.current.push({ k: 'miss', x: meRef.current.x, y: meRef.current.y, t0: performance.now() })
  }, [])
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) doCatch(); return }
      if (/^(KeyW|KeyA|KeyS|KeyD|Arrow(Up|Down|Left|Right))$/.test(e.code)) { e.preventDefault(); keys.current.add(e.code) }
    }
    const ku = (e: KeyboardEvent) => { keys.current.delete(e.code) }
    const clear = () => { keys.current.clear(); input.current.jx = input.current.jy = 0; setStick({ x: 0, y: 0 }) }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', clear); window.addEventListener('touchcancel', clear)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); window.removeEventListener('touchcancel', clear) }
  }, [doCatch])
  const [stick, setStick] = useState({ x: 0, y: 0 })
  const padRef = useRef<HTMLDivElement>(null)
  const padMove = (e: React.PointerEvent) => {
    const el = padRef.current; if (!el) return
    const r = el.getBoundingClientRect(), R = r.width / 2
    let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l }
    if (l < 0.12) { x = 0; y = 0 }
    input.current.jx = x; input.current.jy = y; setStick({ x, y })
  }
  const padEnd = () => { input.current.jx = input.current.jy = 0; setStick({ x: 0, y: 0 }) }

  /* ───── 그리기·움직임 루프 ───── */
  const box = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<StarScene | null>(null)
  const shown = useRef<{ pl: Record<string, { x: number; y: number }>; st: Record<number, { x: number; y: number }> }>({ pl: {}, st: {} })
  const evSeen = useRef(0), sayShown = useRef<Record<string, { n: number; k: number; t: number }>>({}), lastSend = useRef(0), sentPos = useRef({ x: 99, y: 99 })
  const inRange = useRef(false), cdFrac = useRef(0), clock = useRef('')
  const roundSeen = useRef(-1), paid = useRef(-1)
  const [arrows, setArrows] = useState<{ x: number; y: number; rot: number; color: string }[]>([])
  const arrowSig = useRef('')
  const [hud, setHud] = useState({ range: false, cd: 0, left: 0, count: 0, hint: false })

  useEffect(() => {
    if (screen !== 'room') return
    let raf = 0, prev = performance.now(), hudAt = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.1, (t - prev) / 1000); prev = t
      const s = snapRef.current, m = s.meta, r = roomRef.current, st = s.state
      const scene = sceneRef.current
      const now = r ? r.now() : Date.now()
      const playing = !!m && m.phase === 'play' && now >= m.startAt && !!r && m.part.includes(r.uid)
      // 새 판이 시작되면 내 자리로
      if (m && m.phase === 'play' && roundSeen.current !== m.round && r) {
        roundSeen.current = m.round; const i = Math.max(0, m.part.indexOf(r.uid)); meRef.current = { x: SPAWN[i][0], y: SPAWN[i][1] }; r.patchMe({ x: meRef.current.x, y: meRef.current.y, cap: null }); shown.current.st = {}; anims.current = []
      }
      // 내 이동
      if (playing) {
        const k = keys.current; const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0), ky = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0)
        const ix = input.current.jx || kx, iy = input.current.jy || ky
        if (ix || iy) meRef.current = stepWalker(meRef.current, ix, iy, dt)
        if ((Math.abs(meRef.current.x - sentPos.current.x) > 0.02 || Math.abs(meRef.current.y - sentPos.current.y) > 0.02) && t - lastSend.current > 80) { lastSend.current = t; sentPos.current = { ...meRef.current }; r?.patchMe({ x: +meRef.current.x.toFixed(2), y: +meRef.current.y.toFixed(2) }) }
      }
      // 들어온 소식 → 부드럽게 따라가기
      const k1 = 1 - Math.exp(-dt * 14)
      const part = m?.part ?? []
      for (const u of part) { const p = s.players[u]; if (!p || u === r?.uid) continue; const o = shown.current.pl[u] ?? { x: p.x, y: p.y }; o.x += (p.x - o.x) * k1; o.y += (p.y - o.y) * k1; shown.current.pl[u] = o }
      const stars = (st && m && st.r === m.round ? st.stars : []).map((q) => { const o = shown.current.st[q.id] ?? { x: q.x, y: q.y }; o.x += (q.x - o.x) * k1; o.y += (q.y - o.y) * k1; shown.current.st[q.id] = o; return { ...q, x: o.x, y: o.y } })
      if (st && m && st.r === m.round && st.ev && st.ev.n > evSeen.current) { evSeen.current = st.ev.n; anims.current.push({ k: 'fly', x: st.ev.x, y: st.ev.y, t0: t }); playPop() }
      if (m && m.phase === 'lobby') evSeen.current = 0
      // 잡기 가능/쿨다운 표시
      const near = stars.some((q) => Math.hypot(q.x - meRef.current.x, q.y - meRef.current.y) <= CFG.catchR)
      const cd = Math.max(0, 1 - (now - lastCatch.current) / (CFG.catchCd * 1000))
      const left = m && m.phase === 'play' ? Math.max(0, m.endAt - now) : 0, count = m && m.phase === 'play' && now < m.startAt ? Math.ceil((m.startAt - now) / 1000) : 0
      const hint = stars.some((q) => q.m === 2 && Math.hypot(q.x - meRef.current.x, q.y - meRef.current.y) <= CFG.catchR + 1.5)
      const sig = `${near}|${hint}|${Math.ceil(cd * 10)}|${Math.ceil(left / 1000)}|${count}`
      if (sig !== clock.current && t - hudAt > 50) { clock.current = sig; hudAt = t; inRange.current = near; cdFrac.current = cd; setHud({ range: near, cd, left, count, hint }) }
      // 3D 무대에 그릴 것을 넘긴다
      anims.current = anims.current.filter((a) => t - a.t0 < (a.k === 'fly' ? 800 : 350))
      const pls = part.map((u, i) => {
        const p = u === r?.uid ? meRef.current : s.players[u] ? shown.current.pl[u] ?? s.players[u] : null
        if (!p) return null
        const sy = s.players[u]?.say; if (sy) { const prevSay = sayShown.current[u]; if (!prevSay || prevSay.n !== sy.n) sayShown.current[u] = { n: sy.n, k: sy.k, t } }
        const ss = sayShown.current[u]
        return { slot: i, x: p.x, y: p.y, mine: u === r?.uid, say: ss && t - ss.t < 2000 ? SAYS[ss.k] ?? null : null }
      }).filter((x): x is NonNullable<typeof x> => !!x)
      if (scene) { const sg = scene.arrows.map((a) => `${Math.round(a.x * 40)},${Math.round(a.y * 40)},${Math.round(a.rot * 8)}`).join(';'); if (sg !== arrowSig.current) { arrowSig.current = sg; setArrows(scene.arrows.map((a) => ({ ...a }))) } }
      scene?.frame({ players: pls, stars, me: meRef.current, fx: anims.current.map((a) => ({ k: a.k, x: a.x, y: a.y, u: (t - a.t0) / (a.k === 'fly' ? 800 : 350) })), calm, now: t })
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [screen, calm])

  // 3D 무대(판 화면이 열려 있는 동안)와 친구들 옷 입은 인형
  const playView = screen === 'room' && !hostGone && !(phase === 'lobby' && !practice)
  useEffect(() => {
    if (!playView || !stage.current) return
    const sc = createStarScene(stage.current); sceneRef.current = sc; looksDone.current = {}
    return () => { sc.dispose(); sceneRef.current = null }
  }, [playView])
  const looksDone = useRef<Record<number, string>>({})
  const partKey = part.join(',')
  const lookKey = part.map((u) => (u === me ? 'me' : snap.players[u]?.look ?? '')).join('|')
  useEffect(() => {
    if (!playView) return
    part.forEach((u, i) => {
      const raw = u === me ? JSON.stringify({ avatar: getAvatar().id, outfit }) : snap.players[u]?.look
      if (!raw || looksDone.current[i] === raw) return
      looksDone.current[i] = raw
      let look: { avatar?: string; outfit?: Outfit } = {}; try { look = JSON.parse(raw) } catch { /* 모양을 못 읽으면 기본 모습 */ }
      renderFigure(look.outfit ?? {}, {}, AVATARS.find((a) => a.id === look.avatar)).then((cv) => { if (sceneRef.current && looksDone.current[i] === raw) sceneRef.current.setLook(i, cv) }).catch(() => { delete looksDone.current[i] })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playView, partKey, lookKey, outfit])

  /* ───── 결과 보상(한 판에 한 번) ───── */
  const st = snap.state
  const res = st && meta && st.r === meta.round ? st.res : 0
  const caught = st?.caught ?? 0
  useEffect(() => {
    if (!res || !meta || !myIn || paid.current === meta.round) return
    paid.current = meta.round
    const n = res === 1 ? 20 : Math.min(10, caught * 2); if (!practice && n > 0) earnStars(n)
    if (res === 1) playWin(); else playLose()
  }, [res, meta, myIn, caught, practice])

  const leave = () => { roomRef.current?.leave(); roomRef.current = null; setRoom(null); setSnap({ meta: null, players: {}, state: null }); setScreen('menu'); setLeaving(false); setSettings(false); setHostGone(false) }
  const sayIt = (k: number) => { const t = Date.now(); if (t - lastSayAt.current < 3000) return; lastSayAt.current = t; room?.patchMe({ say: { k, n: t % 1e9 } }); setChat(false) }
  const lastSayAt = useRef(0)

  /* ───── 화면 ───── */
  const frame = 'absolute inset-0 z-30 flex flex-col overflow-hidden rounded-3xl text-[#3b2a63] ring-1 ring-black/5'
  const bgStyle = { backgroundColor: '#c79bea' }
  const sky = <><div aria-hidden className="pointer-events-none absolute inset-0 bg-cover bg-center portrait:hidden" style={{ backgroundImage: `url(${assetUrl('starchase/sky_land.webp')})` }} /><div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-cover bg-center portrait:block" style={{ backgroundImage: `url(${assetUrl('starchase/sky_port.webp')})` }} /></>
  const panel = 'rounded-3xl bg-[#fff8ec]/95 p-4 shadow-xl ring-2 ring-[#cdb8f2]'
  const btn = 'min-h-12 rounded-full border-0 px-5 text-base font-black shadow-md active:scale-95 disabled:opacity-50'
  const hills = <>{sky}<img aria-hidden src={assetUrl('starchase/hills.webp')} alt="" draggable={false} className="pointer-events-none absolute inset-x-0 bottom-0 w-full object-cover object-bottom" /></>

  if (screen === 'menu') return (
    <div className={frame} style={bgStyle}>
      {hills}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <h2 className="m-0 text-center text-3xl font-black text-white [font-family:Jua,'Noto_Sans_KR',sans-serif] [text-shadow:0_3px_0_#7a5cc0,0_0_14px_rgba(255,255,255,.5)]">도망간 별을<br />잡아라 ⭐</h2>
        <p className="m-0 rounded-full bg-white/85 px-4 py-1 text-sm font-bold">함께 별자리를 완성해요</p>
        <div className={`${panel} flex w-full max-w-xs flex-col gap-2`}>
          {multiplayerAvailable && <button disabled={busy} onClick={() => enter({})} className={`${btn} bg-gradient-to-b from-[#ffe27a] to-[#ffc94a] text-[#6b4a00]`}>👫 친구랑 같이 하기</button>}
          <button disabled={busy} onClick={() => enter({ practice: true })} className={`${btn} bg-[#bfe8d0] text-[#245a3d]`}>🎯 연습하기 <span className="text-xs font-bold">(혼자)</span></button>
          <button onClick={onClose} className={`${btn} bg-white text-[#6b5a99]`}>🏡 마을로</button>
          {busy && <p role="status" className="m-0 text-center text-sm font-bold text-[#7a5cc0]">연결하는 중…</p>}
          {err && <p role="alert" className="m-0 text-center text-sm font-bold text-[#c04a5a]">⚠️ {err}</p>}
        </div>
      </div>
    </div>
  )

  const players = snap.players
  const shapeChip = (u: string, i: number) => <span key={u} className="flex min-w-0 items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-black shadow" style={{ boxShadow: `0 0 0 2px ${COLORS[i]}` }}><span style={{ color: COLORS[i] }}>{SHAPES[i]}</span><span className="max-w-[4.5rem] truncate">{players[u]?.name ?? '…'}</span>{!players[u] && <span title="연결이 끊겼어요" aria-label="연결이 끊겼어요">📶</span>}</span>

  // 방장이 나감
  if (hostGone) return <div className={frame} style={bgStyle}><div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 p-6"><div className={`${panel} text-center`}><p role="status" className="m-0 mb-3 text-base font-black">방장이 나가서 방이 닫혔어요</p><button onClick={leave} className={`${btn} bg-[#ff8fab] text-white`}>돌아가기</button></div></div></div>

  // 대기실
  if (phase === 'lobby' && !practice) {
    const everyone = slotOrder.length >= 2 && slotOrder.every((u) => players[u]?.ready || u === meta?.host)
    const myReady = !!players[me]?.ready
    const reason = slotOrder.length < 2 ? '친구가 오면 시작할 수 있어요' : !everyone ? '모두 준비하면 시작할 수 있어요' : ''
    return (
      <div className={frame} style={bgStyle}>
        {hills}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-y-auto p-3 pt-[max(.75rem,env(safe-area-inset-top))]">
          <div className={`${panel} w-full max-w-md`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="m-0 text-base font-black">⭐ 같이 놀 친구들</p>
              <button onClick={() => { playTap(); sayStar(room?.room ?? 's1'); setInvited(true); window.setTimeout(() => setInvited(false), 3000) }} aria-label="친구 초대하기" className="min-h-10 rounded-full bg-[#fff0f5] px-3 text-xs font-black text-[#c0587a] ring-2 ring-[#ffc2d4] active:scale-95">{invited ? '💌 초대를 보냈어요!' : '💌 친구 초대하기'}</button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 [@media(max-width:380px)]:grid-cols-2 [@media(max-height:420px)]:mx-auto [@media(max-height:420px)]:max-w-[26rem] [@media(max-height:420px)]:gap-1">
              {Array.from({ length: STAR_MAX }, (_, i) => {
                const u = slotOrder[i], p = u ? players[u] : null
                const hue = [0, 130, 230, 290][i]
                return <div key={i} className={`relative aspect-[1100/1430] min-w-0 ${p ? '' : 'opacity-60'}`}>
                  <img aria-hidden src={assetUrl('starchase/card.webp')} alt="" draggable={false} className="absolute inset-0 h-full w-full" style={{ filter: `hue-rotate(${hue}deg)` }} />
                  <span aria-hidden className="absolute right-[8%] top-[4%] flex h-[23%] w-[23%] items-center justify-center text-lg font-black" style={{ color: COLORS[i] }}>{SHAPES[i]}</span>
                  <div className="absolute inset-x-[10%] bottom-[8%] flex flex-col items-center gap-0.5 text-center">
                    {p ? <><span className="max-w-full truncate text-xs font-black">{p.name}{u === me ? ' (나)' : ''}</span><span className="rounded-full bg-white/80 px-1.5 text-[11px] font-bold">{u === meta?.host ? '👑 방장' : p.ready ? '✅ 준비 완료' : '⏳ 준비 중'}</span></> : <span className="text-[11px] font-bold text-black/50">친구 기다리는 중</span>}
                  </div>
                </div>
              })}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {!isHost && <button onClick={() => room?.patchMe({ ready: !myReady })} className={`${btn} ${myReady ? 'bg-white text-[#6b5a99] ring-2 ring-[#cdb8f2]' : 'bg-[#ff8fab] text-white'}`}>{myReady ? '준비 취소' : '준비'}</button>}
              {isHost && <button disabled={!everyone} onClick={() => room && startGame(room)} className={`${btn} bg-gradient-to-b from-[#ffe27a] to-[#ffc94a] text-[#6b4a00]`}>▶ 시작하기</button>}
              <button onClick={() => setLeaving(true)} className={`${btn} bg-white text-[#6b5a99]`}>나가기</button>
            </div>
            {isHost && reason && <p role="status" className="m-0 mt-2 text-center text-xs font-bold text-[#7a5cc0]">{reason}</p>}
            {!isHost && <p className="m-0 mt-2 text-center text-xs font-bold text-[#7a5cc0]">방장이 시작하길 기다려요</p>}
          </div>
        </div>
        {leaving && <Confirm onKeep={() => setLeaving(false)} onLeave={leave} />}
        {intro && <Intro onOk={() => { setKey(INTRO_KEY); setIntro(false) }} />}
      </div>
    )
  }

  // 판(진행 중·결과)
  const target = meta?.target ?? 0
  const win = res === 1
  const done = !!res || phase === 'done'
  return (
    <div className={frame} style={bgStyle}>
      {sky}
      <div ref={box} className="relative z-10 min-h-0 flex-1 touch-none select-none">
        <div ref={stage} role="img" aria-label="별 잡기 놀이터" className="absolute inset-0" />
        {arrows.map((a, i) => <span key={i} aria-hidden className="pointer-events-none absolute z-[5] flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow ring-2" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, color: a.color, boxShadow: `0 0 0 2px ${a.color}` }}><span style={{ display: 'inline-block', transform: `rotate(${a.rot}rad)`, fontSize: 18, lineHeight: 1 }}>➤</span></span>)}
        {hud.count > 0 && <p aria-live="assertive" className="pointer-events-none absolute inset-0 m-0 flex items-center justify-center text-[6rem] font-black text-white [font-family:Jua,sans-serif] [text-shadow:0_4px_0_#7a5cc0,0_0_20px_rgba(122,92,192,.6)]">{hud.count}</p>}
        {myIn && !done && hud.count === 0 && <p aria-live="polite" className="pointer-events-none absolute left-1/2 bottom-3 m-0 w-[min(19rem,calc(100%-16rem))] -translate-x-1/2 rounded-full bg-[#fff8ec]/95 px-3 py-1.5 text-center text-xs font-black text-[#3b2a63] shadow ring-2 ring-[#cdb8f2] portrait:bottom-40 portrait:w-[min(19rem,calc(100%-2rem))] sm:text-sm">{hud.hint ? '⭐ 지금 잡아!' : '⭐ 친구와 반대편에서 다가가요!'}</p>}
        {/* 위쪽 HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-1 px-2 pt-[max(.5rem,env(safe-area-inset-top))]">
          <div className="flex items-start justify-between gap-2">
            <span aria-label="모은 별" className="flex h-14 w-[8.3rem] items-center gap-1 pl-[3.4rem] pr-2 text-sm font-black text-[#3b2a63] drop-shadow" style={{ backgroundImage: `url(${assetUrl('starchase/pill_star.webp')})`, backgroundSize: '100% 100%' }}><span className="whitespace-nowrap">별 {caught} / {target}</span></span>
            <span aria-label="남은 시간" className="flex h-14 w-[8.3rem] items-center pl-[3.4rem] text-lg font-black text-[#3b2a63] drop-shadow" style={{ backgroundImage: `url(${assetUrl('starchase/pill_clock.webp')})`, backgroundSize: '100% 100%' }}>{fmt(done ? 0 : hud.count ? CFG.seconds * 1000 : hud.left)}</span>
            <div className="pointer-events-auto flex gap-1.5">
              <button aria-label="설정" onClick={() => setSettings(true)} className="h-12 w-12 border-0 bg-transparent bg-contain bg-no-repeat p-0 drop-shadow-md active:scale-95" style={{ backgroundImage: `url(${assetUrl('starchase/ui_gear.webp')})` }} />
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            <span>{practice && <span className="rounded-full bg-[#bfe8d0] px-2 py-0.5 text-[11px] font-black text-[#245a3d] shadow">연습 중</span>}</span>
            <div aria-hidden className="relative flex items-center gap-2.5 px-3 py-1">
              <span className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 rounded bg-white/70" />
              {Array.from({ length: target }, (_, i) => i < caught
                ? <span key={i} className="relative text-base leading-none drop-shadow">⭐</span>
                : <span key={i} className="relative h-3 w-3 rounded-full border-2 border-white bg-[#6a5ac8]" />)}
              <span className="relative text-lg leading-none text-white [text-shadow:0_0_8px_#fff]">⬠</span>
            </div>
            <div className="flex min-w-0 flex-wrap justify-end gap-1">{part.map((u, i) => shapeChip(u, i))}</div>
          </div>
          {!myIn && !done && (meta?.round ?? 0) > 0 && <p role="status" className="m-0 self-center rounded-full bg-white/90 px-3 py-1 text-xs font-black">👀 구경 중 · 다음 판부터 같이 해요</p>}
        </div>
        {/* 조작 */}
        {myIn && !done && <>
          <div ref={padRef} role="group" aria-label="이동 조이스틱" onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); padMove(e) }} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') padMove(e) }} onPointerUp={padEnd} onPointerCancel={padEnd} onLostPointerCapture={padEnd}
            className="absolute left-3 flex h-32 w-32 items-center justify-center bg-contain bg-center bg-no-repeat drop-shadow-lg [@media(max-height:420px)]:h-28 [@media(max-height:420px)]:w-28" style={{ bottom: 'max(.75rem, env(safe-area-inset-bottom))', backgroundImage: `url(${assetUrl('starchase/joy.webp')})` }}>
            <span aria-hidden className="h-14 w-14 bg-contain bg-no-repeat drop-shadow-md" style={{ backgroundImage: `url(${assetUrl('starchase/knob.webp')})`, transform: `translate(${stick.x * 30}px, ${stick.y * 30}px)` }} />
          </div>
          <button aria-label="잡기" onPointerDown={(e) => { e.preventDefault(); doCatch() }} className={`absolute right-3 h-[5.5rem] w-[5.5rem] border-0 bg-transparent bg-contain bg-no-repeat p-0 drop-shadow-xl transition-transform active:scale-95 ${hud.cd > 0 ? 'opacity-60 grayscale-[.4]' : hud.range ? 'scale-110' : ''}`} style={{ bottom: 'max(1.6rem, calc(env(safe-area-inset-bottom) + .9rem))', backgroundImage: `url(${assetUrl(hud.range && hud.cd <= 0 ? 'starchase/catch_glow.webp' : 'starchase/catch.webp')})` }}>
            <span className="sr-only">잡기</span>
            {hud.cd > 0 && <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(rgba(255,255,255,.6) ${hud.cd * 360}deg, transparent 0)` }} />}
          </button>
          <span aria-hidden className="pointer-events-none absolute right-3 w-[5.5rem] text-center text-sm font-black text-white [text-shadow:0_2px_0_#7a5cc0,0_0_8px_rgba(0,0,0,.4)]" style={{ bottom: 'max(.3rem, env(safe-area-inset-bottom))' }}>잡기</span>
          <div className="absolute right-[6.5rem] flex flex-col items-end gap-1" style={{ bottom: 'max(.75rem, env(safe-area-inset-bottom))' }}>
            {chat && SAYS.map((s, k) => <button key={k} onClick={() => sayIt(k)} className="min-h-10 rounded-full bg-white/95 px-3 text-sm font-black shadow ring-2 ring-[#cdb8f2]">{s}</button>)}
            <button aria-label="빠른 말" aria-expanded={chat} onClick={() => setChat((v) => !v)} className="h-12 w-12 border-0 bg-transparent bg-contain bg-no-repeat p-0 drop-shadow-md active:scale-95" style={{ backgroundImage: `url(${assetUrl('starchase/chat.webp')})` }} />
          </div>
        </>}
      </div>

      {done && (
        <div role="dialog" aria-label="결과" className="absolute inset-0 z-20 flex items-center justify-center bg-[#2a1a5e]/45 p-3">
          <div className={`${panel} flex max-h-full w-full max-w-sm flex-col items-center gap-2 overflow-y-auto text-center`}>
            <p className="m-0 text-2xl font-black [font-family:Jua,'Noto_Sans_KR',sans-serif]">{win ? '우리가 해냈어! 🎉' : `별을 ${caught}개 모았어!`}</p>
            <div aria-hidden className="relative w-full max-w-[16rem] overflow-hidden rounded-2xl bg-gradient-to-b from-[#6a4bb5] to-[#9b6fd6] p-2">
              <img src={assetUrl(`starchase/${['c_bear', 'c_swan', 'c_lion', 'c_dipper', 'c_scorpion', 'c_w'][(meta?.round ?? 0) % 6]}.webp`)} alt="" draggable={false} className="w-full object-contain mix-blend-screen" style={{ opacity: win ? 1 : 0.35 + 0.5 * (caught / Math.max(1, target)), filter: win ? undefined : 'saturate(.6)' }} />
              <div className="absolute inset-x-0 bottom-1 flex flex-wrap justify-center gap-0.5 text-base">{Array.from({ length: target }, (_, i) => <span key={i} className={i < caught ? (win && !calm ? 'animate-bounce' : '') : 'opacity-30 grayscale'} style={{ animationDelay: `${i * 60}ms` }}>⭐</span>)}</div>
            </div>
            <p className="m-0 text-sm font-bold text-[#6b5a99]">{win ? '별자리를 완성했어요!' : '다음에는 더 모아봐요!'}</p>
            <div className="flex flex-wrap justify-center gap-1">{part.map((u, i) => shapeChip(u, i))}</div>
            {myIn && !practice && <p className="m-0 text-xs font-bold text-[#7a5cc0]">⭐ {win ? 20 : Math.min(10, caught * 2)}개 받았어요</p>}
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {practice ? <button onClick={() => room && startGame(room, true)} className={`${btn} bg-gradient-to-b from-[#ffe27a] to-[#ffc94a] text-[#6b4a00]`}>한 번 더</button>
                : isHost ? <button onClick={() => room?.setMeta({ phase: 'lobby', part: [] })} className={`${btn} bg-gradient-to-b from-[#ffe27a] to-[#ffc94a] text-[#6b4a00]`}>한 번 더</button>
                : <p className="m-0 w-full text-xs font-bold text-[#7a5cc0]">방장이 「한 번 더」를 누르면 대기실로 가요</p>}
              <button onClick={() => { leave(); onClose() }} className={`${btn} bg-white text-[#6b5a99]`}>🏡 마을로</button>
            </div>
          </div>
        </div>
      )}
      {settings && (
        <div role="dialog" aria-label="설정" className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 p-3" onClick={(e) => { if (e.target === e.currentTarget) setSettings(false) }}>
          <div className={`${panel} flex w-full max-w-xs flex-col gap-2`}>
            <p className="m-0 text-lg font-black">⚙️ 설정</p>
            {!practice && <p className="m-0 rounded-xl bg-[#efe5ff] px-3 py-1.5 text-xs font-bold">설정을 열어도 시간은 계속 가요</p>}
            <label className="flex min-h-12 items-center justify-between gap-2 text-sm font-bold">효과 줄이기<input type="checkbox" checked={calm} onChange={(e) => { setCalm(e.target.checked); try { e.target.checked ? localStorage.setItem('ryuso.star.calm', '1') : localStorage.removeItem('ryuso.star.calm') } catch { /* 저장 못 해도 괜찮다 */ } }} className="h-6 w-6" /></label>
            <button onClick={() => { setSettings(false); setIntro(true) }} className={`${btn} bg-white text-[#6b5a99]`}>❓ 도움말</button>
            <button onClick={() => { setSettings(false); setLeaving(true) }} className={`${btn} bg-[#ffd9e1] text-[#a33a55]`}>나가기</button>
            <button onClick={() => setSettings(false)} className={`${btn} bg-[#ff8fab] text-white`}>계속 놀기</button>
          </div>
        </div>
      )}
      {leaving && <Confirm practice={practice} onKeep={() => setLeaving(false)} onLeave={leave} />}
      {intro && <Intro onOk={() => { setKey(INTRO_KEY); setIntro(false); force((n) => n + 1) }} />}
    </div>
  )
}

function Confirm({ onKeep, onLeave, practice }: { onKeep: () => void; onLeave: () => void; practice?: boolean }) {
  return (
    <div role="dialog" aria-label="나가기" className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-3">
      <div className="flex w-full max-w-xs flex-col gap-2 rounded-3xl bg-[#fff8ec] p-4 text-center shadow-xl ring-2 ring-[#cdb8f2]">
        <p className="m-0 text-base font-black text-[#3b2a63]">{practice ? '연습을 그만할까요?' : '나갈까요?'}</p>
        {!practice && <p className="m-0 text-sm font-bold text-[#6b5a99]">친구들은 계속 놀 수 있어요</p>}
        <button onClick={onKeep} className="min-h-12 rounded-full bg-[#ff8fab] text-base font-black text-white shadow-md">계속 놀기</button>
        <button onClick={onLeave} className="min-h-12 rounded-full bg-white text-base font-black text-[#6b5a99] ring-2 ring-[#cdb8f2]">나가기</button>
      </div>
    </div>
  )
}

function Intro({ onOk }: { onOk: () => void }) {
  return (
    <div role="dialog" aria-label="놀이 방법" className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-3">
      <div className="flex max-h-full w-full max-w-xs flex-col items-center gap-2 overflow-y-auto rounded-3xl bg-[#fff8ec] p-4 text-center shadow-xl ring-2 ring-[#cdb8f2]">
        <div aria-hidden className="flex items-center gap-1 text-3xl">🧒<span className="text-2xl">➡️</span>⭐<span className="text-2xl">⬅️</span>🧒</div>
        <p className="m-0 text-base font-black text-[#3b2a63]">친구와 반대편에서 다가가요!</p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-left text-sm font-bold text-[#6b5a99]">
          <li>🕹️ <b>이동</b>: 왼쪽 조이스틱 (키보드는 WASD·화살표)</li>
          <li>🙌 <b>잡기</b>: 별이 가까이 오면 눌러요 (스페이스)</li>
          <li>⭐ 양쪽에서 다가가면 별이 놀라서 느려져요!</li>
        </ul>
        <button onClick={onOk} className="min-h-12 w-full rounded-full bg-gradient-to-b from-[#ffe27a] to-[#ffc94a] text-base font-black text-[#6b4a00] shadow-md">알겠어!</button>
      </div>
    </div>
  )
}
