import { useCallback, useEffect, useRef, useState } from 'react'
import { earnStars } from '../lib/shop'
import { playCoin, playHop, playLose, playPop, playTap, playWin, startBgm, stopBgm } from '../lib/sound'
import { assetUrl } from '../lib/items'
import { localTest } from '../lib/mp/config'
import { AVATARS, getAvatar } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import type { Outfit } from '../lib/types'
import { sayBub, savedName } from '../lib/mp/session'
import { BUB_MAX, joinBubRoom, num, pack, unpack, type BState, type BubRoom, type BubSnap } from '../lib/mp/bubNet'
import { RACE_INVITE_EVENT, takeBubInvite } from '../lib/raceInvite'
import { BOSS, CFG, COLS, LEVELS, ROWS, SPAWN, newGame, newLevel, step, stepLocalPlayer, type Ev, type Input, type Mate, type State } from '../lib/bubbleBop'
import { PLACES, SEA_FOES, SNOW_FOES, THEMES, monsterTheme, type Theme } from './gameThemes'
import { draw, load, type Imgs, type Other } from './BubbleBop'

/**
 * 별 거품 같이 하기(같은 세상): 방장의 폰이 괴물·거품·과일·점수·목숨을 계산해서 보내고(lib/mp/bubNet.ts),
 * 친구들은 자기 몸(걷기·점프)만 자기 폰에서 계산해서 위치를 알린다. 목숨은 모두가 같이 쓰고, 거품과 괴물은 모두가 같이 잡는다.
 */
const COLORS = ['#ff8fab', '#5fc27a', '#4aa6ea', '#a77be8']
const PH = ['play', 'clear', 'won', 'over'] as const
const SEND_MS = 66, STATE_MS = 100
type FxItem = { k: 'pop' | 'burst' | 'hit' | 'pts'; x: number; y: number; t: number; text?: string }

const spawnFor = (slot: number) => ({ x: SPAWN.x + slot * 1.2, y: SPAWN.y })
const mkMate = (uid: string, slot: number): Mate => ({ uid, ...spawnFor(slot), vx: 0, vy: 0, on: true, dir: 1, inv: 1.5, cd: 0, hitN: 0, bounceN: 0, shots: [] })

export function BubbleCoop({ onClose, outfit }: { onClose: () => void; outfit: Outfit }) {
  const [snap, setSnap] = useState<BubSnap>({ meta: null, players: {}, state: null })
  const [room, setRoom] = useState<BubRoom | null>(null)
  const [err, setErr] = useState('')
  const [hostGone, setHostGone] = useState(false)
  const [invited, setInvited] = useState(false)
  const [paused, setPaused] = useState(false)
  const [hud, setHud] = useState({ score: 0, lives: CFG.lives, level: 1, stars: 0, phase: 'play' as State['phase'] })
  const roomRef = useRef<BubRoom | null>(null)
  const snapRef = useRef(snap); snapRef.current = snap
  const seenMeta = useRef(false)
  const mounted = useRef(true)
  const box = useRef<HTMLDivElement>(null)
  const cvs = useRef<HTMLCanvasElement>(null)
  const game = useRef<State>(newGame())
  const keys = useRef(new Set<string>())
  const touch = useRef({ left: false, right: false, jump: false, shoot: false })
  const fx = useRef<FxItem[]>([])
  const imgs = useRef<Imgs>({ sets: [], burst: load('starchase/burst.webp'), me: null, sea: SEA_FOES.map((f) => ({ walk: load(f.walk), trapped: load(f.trapped), mad: load(f.mad), h: f.h })), snow: SNOW_FOES.map((f) => ({ walk: load(f.walk), trapped: load(f.trapped), mad: load(f.mad), h: f.h })), deco: PLACES.map((p) => p.deco.map(([n]) => load(`race/${n}.webp`))) })
  const looks = useRef<Record<string, { raw: string; cv: HTMLCanvasElement | null }>>({})
  const paidKey = useRef(-1)
  const themeRound = useRef(-1)
  if (localTest) (window as unknown as { __bc?: () => unknown }).__bc = () => ({ s: game.current, snap: snapRef.current })

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; roomRef.current?.leave(); roomRef.current = null } }, [])
  // 들어가기(초대를 받아 열렸으면 그 초대는 여기서 소비한다). StrictMode 의 두 번 열림을 피하려고 잠깐 뒤에
  const enter = useCallback(() => {
    takeBubInvite()
    setErr(''); seenMeta.current = false; setHostGone(false)
    joinBubRoom(savedName() || '친구', (s) => { if (mounted.current) { if (s.meta) seenMeta.current = true; setSnap(s) } }, { look: JSON.stringify({ avatar: getAvatar().id, outfit }) })
      .then((r) => { if (!mounted.current) { r.leave(); return } roomRef.current = r; setRoom(r) })
      .catch((e) => { if (mounted.current) setErr(e instanceof Error ? e.message.replace(/^\[[^\]]+\]\s*/, '') || '연결하지 못했어요' : '연결하지 못했어요') })
  }, [outfit])
  useEffect(() => { const t = window.setTimeout(enter, 30); return () => clearTimeout(t) }, [enter])
  useEffect(() => { const f = () => { if (!roomRef.current) enter() }; window.addEventListener(RACE_INVITE_EVENT, f); return () => window.removeEventListener(RACE_INVITE_EVENT, f) }, [enter])

  const meta = snap.meta
  const me = room?.uid ?? ''
  const isHost = !!room?.host
  const part = meta?.part ?? []
  const inPart = part.includes(me)
  const playing = meta?.phase === 'play'
  const lobbyOrder = Object.entries(snap.players).sort((a, b) => a[1].j - b[1].j || a[0].localeCompare(b[0])).map(([u]) => u)
  useEffect(() => { if (seenMeta.current && !meta) setHostGone(true) }, [meta])

  // 내 아바타와 친구들 아바타 그림
  useEffect(() => {
    renderFigure(outfit, {}, AVATARS.find((a) => a.id === getAvatar().id)).then((cv) => { imgs.current.me = cv }).catch(() => {})
  }, [outfit])
  const lookKey = Object.entries(snap.players).map(([u, p]) => `${u}:${p.look}`).join('|')
  useEffect(() => {
    for (const [u, p] of Object.entries(snapRef.current.players)) {
      const cur = looks.current[u]; if (cur && cur.raw === p.look) continue
      looks.current[u] = { raw: p.look, cv: cur?.cv ?? null }
      let look: { avatar?: string; outfit?: Outfit } = {}; try { look = JSON.parse(p.look) } catch { /* 못 읽으면 기본 모습 */ }
      renderFigure(look.outfit ?? {}, {}, AVATARS.find((a) => a.id === look.avatar)).then((cv) => { if (looks.current[u]?.raw === p.look) looks.current[u].cv = cv }).catch(() => {})
    }
  }, [lookKey])

  // 판마다 컨셉 그림(몬스터 3마리는 판 번호로 정해서 모두 같다)
  const round = meta?.round ?? 0
  useEffect(() => {
    if (!playing || themeRound.current === round) return
    themeRound.current = round
    const themes: Theme[] = [THEMES[0], THEMES[1], monsterTheme(round)]
    imgs.current.sets = themes.map((th) => ({ theme: th, foes: th.foes.map((f) => ({ walk: load(f.walk), trapped: load(f.trapped), mad: load(f.mad), h: f.h })), fruit: th.treats.map(load) }))
  }, [playing, round])
  useEffect(() => { if (!playing || paused) return; startBgm('run'); return stopBgm }, [playing, paused])

  // 키보드·앱이 가려지면 입력 해제
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (/^(ArrowLeft|ArrowRight|ArrowUp|Space|KeyA|KeyD|KeyW)$/.test(e.code)) { e.preventDefault(); keys.current.add(e.code) }
    }
    const ku = (e: KeyboardEvent) => { keys.current.delete(e.code) }
    const clear = () => { keys.current.clear(); touch.current = { left: false, right: false, jump: false, shoot: false } }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear); window.addEventListener('touchcancel', clear)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); window.removeEventListener('touchcancel', clear) }
  }, [])

  /* ───── 방장: 한 판 시작·이어서 하기 ───── */
  const restartN = useRef(0)
  const startGame = () => {
    const r = roomRef.current; if (!r || !r.host) return
    const ids = lobbyOrder.slice(0, BUB_MAX)
    const s = newLevel(0); s.mates = ids.filter((u) => u !== r.uid).map((u, i) => mkMate(u, i + 1)); s.p.x = spawnFor(0).x
    game.current = s; fx.current = []; restartN.current = (meta?.round ?? 0) * 100 + 1; paidKey.current = -1
    r.setMeta({ phase: 'play', round: (meta?.round ?? 0) + 1, part: ids })
  }
  const resume = () => {
    const o = game.current; const n = newLevel(o.level, { score: o.score, lives: CFG.lives, stars: 0 })
    n.mates = o.mates.map((m, i) => ({ ...mkMate(m.uid, i + 1), hitN: m.hitN, bounceN: m.bounceN })); fx.current = []; restartN.current++; paidKey.current = -1
    game.current = n
  }
  const backToLobby = () => { roomRef.current?.setMeta({ phase: 'lobby', part: [] }); roomRef.current?.setState(null); for (const u of Object.keys(snapRef.current.players)) if (u === roomRef.current?.uid) roomRef.current?.patchMe({ ready: false }) }
  useEffect(() => { if (meta?.phase === 'lobby') { paidKey.current = -1; roomRef.current?.patchMe({ ready: false, p: '', sh: '' }) } }, [meta?.phase])

  /* ───── 그리기·움직임 루프(방장은 세상을 계산하고, 친구는 받은 세상을 따라간다) ───── */
  const onEvents = useCallback((ev: Ev[]) => {
    for (const e of ev) {
      if (e.k === 'jump') playHop()
      else if (e.k === 'trap' || e.k === 'pop' || e.k === 'bossHit') { playPop(); if (e.k !== 'trap') fx.current.push({ k: 'pop', x: e.x!, y: e.y!, t: 0 }) }
      else if (e.k === 'bossStomp') { playHop(); fx.current.push({ k: 'burst', x: e.x!, y: e.y!, t: 0 }) }
      else if (e.k === 'bossDown' || e.k === 'defeat') { playPop(); fx.current.push({ k: 'burst', x: e.x!, y: e.y!, t: 0 }) }
      else if (e.k === 'fruit') { playCoin() }
      else if (e.k === 'hit') { playLose(); fx.current.push({ k: 'hit', x: e.x!, y: e.y!, t: 0 }) }
      else if (e.k === 'clear') playWin()
    }
  }, [])

  useEffect(() => {
    if (!playing || !room) return
    const host = room.host
    let raf = 0, prev = performance.now(), lastSend = 0, lastState = 0, hudSig = '', seq = 0, shotN = 0
    const lastShot: Record<string, number> = {}, smooth: Record<string, { x: number; y: number }> = {}
    let appliedN = -1, appliedR = -999, myHit = 0, myBounce = 0, myInitRound = -1, hasPrevScore = 0
    const view: { tgt: BState | null } = { tgt: null }
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (t - prev) / 1000); prev = t
      const c = cvs.current, b = box.current; if (!c || !b) return
      const W = b.clientWidth, H = b.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1)
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
      const sn = snapRef.current, s = game.current
      const k = keys.current, tc = touch.current
      const inp: Input = { left: tc.left || k.has('ArrowLeft') || k.has('KeyA'), right: tc.right || k.has('ArrowRight') || k.has('KeyD'), jump: tc.jump || k.has('ArrowUp') || k.has('KeyW'), shoot: tc.shoot || k.has('Space') }
      const inGame = (sn.meta?.part ?? []).includes(room.uid)
      let others: Other[] = []
      const smoothTo = (key: string, x: number, y: number) => { const o = smooth[key] ?? (smooth[key] = { x, y }); const kk = 1 - Math.exp(-dt * 16); if (Math.hypot(x - o.x, y - o.y) > 4) { o.x = x; o.y = y } else { o.x += (x - o.x) * kk; o.y += (y - o.y) * kk } return o }
      if (host) {
        // ── 방장: 친구들의 위치·쏜 거품을 받아 세상을 계산한다
        for (const m of [...s.mates]) {
          const pl = sn.players[m.uid]
          if (!pl) { s.mates.splice(s.mates.indexOf(m), 1); continue }
          const [x, y, vy, d] = pl.p.split(',').map((q) => Number(q))
          if (Number.isFinite(x) && Number.isFinite(y)) { m.x = Math.max(1.3, Math.min(COLS - 1.3, x)); m.y = Math.max(1.4, Math.min(ROWS - 1, y)); m.vy = Number.isFinite(vy) ? vy : 0; m.dir = d < 0 ? -1 : 1 }
          const [n, sx, sy, sd] = pl.sh.split(',').map((q) => Number(q))
          if (Number.isFinite(n) && n > (lastShot[m.uid] ?? n - 1)) { m.shots.push({ x: Number.isFinite(sx) ? sx : m.x, y: Number.isFinite(sy) ? sy : m.y, dir: sd < 0 ? -1 : 1 }) }
          if (Number.isFinite(n)) lastShot[m.uid] = n
        }
        if (!paused && s.phase !== 'over' && s.phase !== 'won') onEvents(step(s, inp, dt))
        const nameOf = (u: string) => sn.players[u]?.name ?? '친구'
        others = s.mates.map((m, i) => { const o = smoothTo(m.uid, m.x, m.y); return { x: o.x, y: o.y, dir: m.dir, inv: m.inv, cv: looks.current[m.uid]?.cv ?? null, name: nameOf(m.uid), color: COLORS[(part.indexOf(m.uid) + 4) % 4 || (i + 1) % 4], moving: Math.abs(m.vy) > 0.5 || Math.hypot(o.x - m.x, o.y - m.y) > 0.05 } })
        // 방장이 세상을 약 10번/초 알린다
        if (t - lastState > STATE_MS) {
          lastState = t
          const st: BState = {
            r: restartN.current, lv: s.level, ph: PH.indexOf(s.phase) as 0 | 1 | 2 | 3, sc: s.score, li: s.lives, st: s.stars, n: ++seq,
            f: pack(s.foes.map((f) => [f.id, f.x, f.y, f.dir, f.mad ? 1 : 0])),
            b: pack(s.bubbles.slice(0, 24).map((q) => [q.id, q.x, q.y, q.foe ? q.foe.id : 0])),
            fr: pack(s.fruits.slice(0, 12).map((f) => [f.id, f.x, f.y, f.kind])),
            bo: s.boss ? pack([[s.boss.x, s.boss.y, s.boss.dir, s.boss.hp, s.boss.max, s.boss.hurt, s.boss.kindId]]) : '',
            pl: pack([[room.uid, s.p.x, s.p.y, s.p.dir, s.p.inv, 0, 0], ...s.mates.map((m) => [m.uid, m.x, m.y, m.dir, m.inv, m.hitN, m.bounceN])]),
          }
          room.setState(st)
        }
      } else {
        // ── 친구: 받은 세상으로 바꾸고, 내 몸만 계산한다
        const st = sn.state
        if (st && st.n !== appliedN) {
          appliedN = st.n; view.tgt = st
          const slot = Math.max(0, (sn.meta?.part ?? []).indexOf(room.uid))
          if (st.r !== appliedR || st.lv !== s.level) {
            const fresh = newLevel(st.lv); fresh.foes = []; fresh.boss = null; const me0 = spawnFor(slot)
            fresh.p.x = me0.x; fresh.p.y = me0.y; fresh.p.inv = 1.5; game.current = fresh; fx.current = []; appliedR = st.r; myHit = 0; myBounce = 0; hasPrevScore = st.sc
            // 이 판의 처음 상태에서 시작하는 hitN 기준선을 맞춘다
            const mine = unpack(st.pl).find((r) => r[0] === room.uid); if (mine) { myHit = num(mine[5]); myBounce = num(mine[6]) }
            myInitRound = st.r
          }
          const g2 = game.current
          g2.score = st.sc; g2.lives = st.li; g2.stars = st.st; g2.phase = PH[st.ph]; g2.level = st.lv
          const mine = unpack(st.pl).find((r) => r[0] === room.uid)
          if (mine && myInitRound === st.r) {
            const h = num(mine[5]), bn = num(mine[6])
            if (h > myHit) { myHit = h; g2.p.x = spawnFor(slot).x; g2.p.y = spawnFor(slot).y; g2.p.vy = 0; g2.p.inv = CFG.inv; fx.current.push({ k: 'hit', x: g2.p.x, y: g2.p.y, t: 0 }); playLose() }
            if (bn > myBounce) { myBounce = bn; g2.p.vy = -BOSS.bounce; g2.p.on = false; playHop() }
          }
          if (st.sc > hasPrevScore) playPop()
          hasPrevScore = st.sc
        }
        const g2 = game.current
        const tg = view.tgt
        if (tg) {
          const kk = 1 - Math.exp(-dt * 16)
          const sm = (key: string, x: number, y: number) => { const o = smooth[key] ?? (smooth[key] = { x, y }); if (Math.hypot(x - o.x, y - o.y) > 4) { o.x = x; o.y = y } else { o.x += (x - o.x) * kk; o.y += (y - o.y) * kk } return o }
          g2.foes = unpack(tg.f).map((r) => { const o = sm('f' + r[0], num(r[1]), num(r[2])); return { id: num(r[0]), x: o.x, y: o.y, vx: 0, vy: 0, on: true, dir: num(r[3]) < 0 ? -1 : 1, mad: r[4] === '1', jumpT: 0 } })
          g2.bubbles = unpack(tg.b).map((r) => { const o = sm('b' + r[0], num(r[1]), num(r[2])); const fid = num(r[3]); return { id: num(r[0]), x: o.x, y: o.y, vx: 0, vy: 0, t: 1, life: 9, foe: fid ? { id: fid, x: o.x, y: o.y, vx: 0, vy: 0, on: false, dir: 1, mad: false, jumpT: 0 } : null } })
          g2.fruits = unpack(tg.fr).map((r) => { const o = sm('r' + r[0], num(r[1]), num(r[2])); return { id: num(r[0]), x: o.x, y: o.y, vy: 0, kind: num(r[3]), t: 0, pts: 0 } })
          const bo = unpack(tg.bo)[0]
          g2.boss = bo ? (() => { const o = sm('boss', num(bo[0]), num(bo[1])); return { x: o.x, y: o.y, dir: num(bo[2]) < 0 ? -1 : 1, hp: num(bo[3]), max: num(bo[4]), hurt: num(bo[5]), age: 3, kindId: num(bo[6], 1), vx: 0, vy: 0, on: true, jumpT: 0, dropT: 0 } })() : null
          const names = (u: string) => sn.players[u]?.name ?? '친구'
          others = unpack(tg.pl).filter((r) => r[0] !== room.uid).map((r) => { const o = sm('p' + r[0], num(r[1]), num(r[2])); return { x: o.x, y: o.y, dir: num(r[3]) < 0 ? -1 : 1, inv: num(r[4]), cv: looks.current[r[0]]?.cv ?? null, name: names(r[0]), color: COLORS[Math.max(0, (sn.meta?.part ?? []).indexOf(r[0])) % 4], moving: Math.hypot(num(r[1]) - o.x, num(r[2]) - o.y) > 0.05 } })
        }
        if (inGame && !paused && g2.phase !== 'over' && g2.phase !== 'won') {
          const ev = stepLocalPlayer(g2, inp, dt); onEvents(ev.filter((e) => e.k === 'jump'))
          for (const e of ev) if (e.k === 'shoot') { shotN++; room.patchMe({ sh: `${shotN},${g2.p.x.toFixed(2)},${g2.p.y.toFixed(2)},${g2.p.dir}` }); playTap() }
        }
      }
      // 내 위치를 알린다(약 15번/초)
      const g3 = game.current
      if (!host && inGame && t - lastSend > SEND_MS) { lastSend = t; room.patchMe({ p: `${g3.p.x.toFixed(2)},${g3.p.y.toFixed(2)},${g3.p.vy.toFixed(1)},${g3.p.dir}` }) }
      fx.current = fx.current.filter((f) => (f.t += dt) < (f.k === 'pts' ? 1.1 : 0.6))
      // ── 그리기
      const portrait = H > W
      const sc = portrait ? W / COLS : Math.min(W / COLS, H / ROWS)
      const topPad = 64, botPad = 150
      const K = portrait ? Math.max(1, Math.min(2.3, (H - topPad - botPad) / (ROWS * sc))) : 1, S = 1 + (K - 1) * 0.5
      const ox = (W - sc * COLS) / 2, oy = portrait ? topPad : (H - sc * ROWS) / 2
      const g = c.getContext('2d'); if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.translate(ox, oy); g.scale(sc, sc * K)
      draw(g, g3, imgs.current, t / 1000, fx.current, K, S, others)
      const sig = `${g3.score}|${g3.lives}|${g3.level}|${g3.stars}|${g3.phase}`
      if (sig !== hudSig) {
        hudSig = sig; setHud({ score: g3.score, lives: g3.lives, level: g3.level + 1, stars: g3.stars, phase: g3.phase })
        if ((g3.phase === 'over' || g3.phase === 'won') && paidKey.current !== (host ? restartN.current : appliedR)) {
          paidKey.current = host ? restartN.current : appliedR
          if (g3.stars > 0 && inGame) earnStars(g3.stars)
          if (g3.phase === 'won') playWin(); else playLose()
        }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, room, paused, onEvents])

  const leave = () => { roomRef.current?.leave(); roomRef.current = null; onClose() }
  const hold = (k: 'left' | 'right' | 'jump' | 'shoot') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); touch.current[k] = true },
    onPointerUp: () => { touch.current[k] = false }, onPointerCancel: () => { touch.current[k] = false }, onLostPointerCapture: () => { touch.current[k] = false },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })
  const place = PLACES[(hud.level - 1) % PLACES.length]
  const btn = 'absolute border-0 bg-transparent bg-contain bg-center bg-no-repeat p-0 drop-shadow-lg active:scale-90 touch-none select-none'
  const bottom = 'max(.9rem, calc(env(safe-area-inset-bottom) + .5rem))'
  const frame = 'absolute inset-0 z-30 flex flex-col overflow-hidden rounded-3xl bg-[#c79bea] text-[#3b2a63] ring-1 ring-black/5'
  const panel = 'rounded-3xl bg-[#fff8ec]/95 p-4 shadow-xl ring-2 ring-[#cdb8f2]'
  const pbtn = 'min-h-12 rounded-full border-0 px-5 text-base font-black shadow-md active:scale-95 disabled:opacity-50'
  const bg = <div aria-hidden className="pointer-events-none absolute inset-0 bg-cover bg-bottom" style={{ backgroundImage: `url(${assetUrl(playing ? place.sky : PLACES[0].sky)})` }} />

  if (err) return <div className={frame}>{bg}<div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 p-6"><div className={`${panel} text-center`}><p role="alert" className="m-0 mb-3 text-sm font-black text-[#c04a5a]">⚠️ {err}</p><button onClick={leave} className={`${pbtn} bg-[#ff8fab] text-white`}>돌아가기</button></div></div></div>
  if (hostGone) return <div className={frame}>{bg}<div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3 p-6"><div className={`${panel} text-center`}><p role="status" className="m-0 mb-3 text-base font-black">방장이 나가서 방이 닫혔어요</p><button onClick={leave} className={`${pbtn} bg-[#ff8fab] text-white`}>돌아가기</button></div></div></div>
  if (!room || !meta) return <div className={frame}>{bg}<div className="relative z-10 flex flex-1 items-center justify-center"><p role="status" className="m-0 rounded-full bg-white/90 px-5 py-2 text-sm font-black">방을 찾는 중…</p></div></div>

  // 대기실
  if (!playing) {
    const myReady = !!snap.players[me]?.ready
    const others2 = lobbyOrder.filter((u) => u !== meta.host)
    const everyone = lobbyOrder.length >= 2 && others2.every((u) => snap.players[u]?.ready)
    const reason = lobbyOrder.length < 2 ? '친구가 오면 시작할 수 있어요' : !everyone ? '모두 준비하면 시작할 수 있어요' : ''
    return (
      <div className={frame}>
        {bg}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-2 overflow-y-auto p-3 pt-[max(.75rem,env(safe-area-inset-top))]">
          <div className={`${panel} w-full max-w-md`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="m-0 text-base font-black">🫧 별 거품 · 같이 하기</p>
              <button onClick={() => { playTap(); sayBub(room.room); setInvited(true); window.setTimeout(() => setInvited(false), 3000) }} aria-label="친구 초대하기" className="min-h-10 rounded-full bg-[#fff0f5] px-3 text-xs font-black text-[#c0587a] ring-2 ring-[#ffc2d4] active:scale-95">{invited ? '💌 초대를 보냈어요!' : '💌 친구 초대하기'}</button>
            </div>
            <div className="grid grid-cols-4 gap-1.5 [@media(max-width:380px)]:grid-cols-2">
              {Array.from({ length: BUB_MAX }, (_, i) => {
                const u = lobbyOrder[i], p = u ? snap.players[u] : null
                return <div key={i} className={`flex min-h-[5.2rem] flex-col items-center justify-center gap-0.5 rounded-2xl p-1.5 text-center ${p ? 'bg-white' : 'bg-white/50'}`} style={p ? { boxShadow: `0 0 0 2px ${COLORS[i]}` } : undefined}>
                  {p ? <><span className="max-w-full truncate text-xs font-black">{p.name}{u === me ? ' (나)' : ''}</span><span className="text-[11px] font-bold">{u === meta.host ? '👑 방장' : p.ready ? '✅ 준비 완료' : '⏳ 준비 중'}</span></> : <span className="text-[11px] font-bold text-black/45">친구 기다리는 중</span>}
                </div>
              })}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {!isHost && <button onClick={() => room.patchMe({ ready: !myReady })} className={`${pbtn} ${myReady ? 'bg-white text-[#6b5a99] ring-2 ring-[#cdb8f2]' : 'bg-[#ff8fab] text-white'}`}>{myReady ? '준비 취소' : '준비'}</button>}
              {isHost && <button disabled={!everyone} onClick={startGame} className={`${pbtn} bg-gradient-to-b from-[#ffe27a] to-[#ffc94a] text-[#6b4a00]`}>▶ 시작하기</button>}
              <button onClick={leave} className={`${pbtn} bg-white text-[#6b5a99]`}>나가기</button>
            </div>
            {isHost && reason && <p role="status" className="m-0 mt-2 text-center text-xs font-bold text-[#7a5cc0]">{reason}</p>}
            {!isHost && <p className="m-0 mt-2 text-center text-xs font-bold text-[#7a5cc0]">방장이 시작하길 기다려요</p>}
            <p className="m-0 mt-2 text-center text-[11px] font-bold text-[#6b5a99]">목숨은 모두 같이 3개! 거품은 같이 쏘고, 대왕 몬스터는 함께 잡아요</p>
          </div>
        </div>
      </div>
    )
  }

  const over = hud.phase === 'over' || hud.phase === 'won'
  const nameChip = (u: string, i: number) => <span key={u} className="flex min-w-0 items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-black shadow" style={{ boxShadow: `0 0 0 2px ${COLORS[i % 4]}` }}><span className="max-w-[4.5rem] truncate">{snap.players[u]?.name ?? '…'}</span>{!snap.players[u] && <span aria-label="연결이 끊겼어요">📶</span>}</span>
  return (
    <div className={frame}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-cover bg-bottom" style={{ backgroundImage: `url(${assetUrl(place.sky)})` }} />
      <div ref={box} className="relative z-10 min-h-0 flex-1 touch-none select-none [-webkit-touch-callout:none]">
        <canvas ref={cvs} aria-label="별 거품 같이 하기 놀이판" className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-1 px-2 pt-[max(.5rem,env(safe-area-inset-top))]">
          <div className="flex items-start justify-between gap-1">
            <div className="flex min-w-0 items-center gap-1 whitespace-nowrap">
              <span aria-label="점수" className="flex h-11 w-[7.6rem] items-center pl-[2.9rem] text-sm font-black drop-shadow" style={{ backgroundImage: `url(${assetUrl('starchase/pill_star.webp')})`, backgroundSize: '100% 100%' }}>{hud.score}</span>
              <span aria-label="단계와 목숨" className="flex h-9 items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-black shadow ring-2 ring-[#cdb8f2]">{place.ico} {hud.level}/{LEVELS.length} · <span className="text-[#e0567a]">♥</span>{hud.lives}</span>
            </div>
            <div className="pointer-events-auto flex gap-1.5">
              {isHost && <button aria-label={paused ? '계속하기' : '잠깐 멈춤'} onClick={() => { playTap(); setPaused((v) => !v) }} className="h-11 w-11 rounded-full bg-white/95 text-lg font-black shadow ring-2 ring-[#cdb8f2]">{paused ? '▶' : 'Ⅱ'}</button>}
              <button aria-label="나가기" onClick={() => { playTap(); leave() }} className="h-11 w-11 rounded-full bg-white/95 text-lg font-bold shadow ring-2 ring-[#cdb8f2]">✕</button>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1">{part.map((u, i) => nameChip(u, i))}</div>
          {!inPart && !over && <p role="status" className="m-0 self-center rounded-full bg-white/90 px-3 py-1 text-xs font-black">👀 구경 중</p>}
        </div>
        {inPart && !over && <>
          <button aria-label="왼쪽으로" {...hold('left')} className={`${btn} left-3 h-[4.6rem] w-[4.6rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('race/btn_left.webp')})` }} />
          <button aria-label="오른쪽으로" {...hold('right')} className={`${btn} left-[6.2rem] h-[4.6rem] w-[4.6rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('race/btn_right.webp')})` }} />
          <button aria-label="점프" {...hold('jump')} className={`${btn} right-[6.4rem] h-[4.6rem] w-[4.6rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('starchase/btn_up.webp')})` }} />
          <button aria-label="거품 쏘기" {...hold('shoot')} className={`${btn} right-3 h-[5.4rem] w-[5.4rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('starchase/catch.webp')})` }} />
        </>}
        {paused && <p role="status" className="pointer-events-none absolute inset-x-0 top-1/2 m-0 -translate-y-1/2 text-center text-3xl font-black text-white [text-shadow:0_3px_0_#7a5cc0]">잠깐 멈춤</p>}
      </div>
      {over && (
        <div role="dialog" aria-label="결과" className="absolute inset-0 z-40 flex items-center justify-center bg-[#2a1a5e]/45 p-3">
          <div className="flex w-full max-w-xs flex-col items-center gap-2 rounded-3xl bg-[#fff8ec] p-4 text-center shadow-xl ring-2 ring-[#cdb8f2]">
            <p className="m-0 text-2xl font-black">{hud.phase === 'won' ? '모두 해냈어! 🎉' : '다음에는 더 해봐요!'}</p>
            <p className="m-0 text-sm font-bold text-[#6b5a99]">점수 {hud.score}점 · {hud.phase === 'won' ? `${LEVELS.length}단계 모두 끝!` : `${hud.level}단계까지 갔어요`}</p>
            {hud.stars > 0 && inPart && <p className="m-0 text-xs font-bold text-[#7a5cc0]">⭐ {hud.stars}개 받았어요</p>}
            <div className="flex flex-wrap justify-center gap-2">
              {isHost ? <>
                {hud.phase === 'over' && <button onClick={resume} className={`${pbtn} bg-gradient-to-b from-[#ffe27a] to-[#ffc94a] text-[#6b4a00]`}>▶ 이어서 하기 <span className="text-xs">({hud.level}단계)</span></button>}
                <button onClick={backToLobby} className={`${pbtn} bg-[#ffe9f0] text-[#c0587a] ring-2 ring-[#ffc2d4]`}>🔄 대기실로</button>
              </> : <p className="m-0 w-full text-xs font-bold text-[#7a5cc0]">방장이 다음을 고르길 기다려요</p>}
              <button onClick={leave} className={`${pbtn} bg-white text-[#6b5a99] ring-2 ring-[#cdb8f2]`}>🏡 마을로</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
