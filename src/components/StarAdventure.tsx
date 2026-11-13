import { useCallback, useEffect, useRef, useState } from 'react'
import { earnStars } from '../lib/shop'
import { playCloud, playCoin, playHop, playLose, playPop, playStar, playTap, playWin, startBgm, stopBgm } from '../lib/sound'
import { assetUrl } from '../lib/items'
import { AVATARS, getAvatar } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import { localTest } from '../lib/mp/config'
import type { Outfit } from '../lib/types'
import { CFG, LEVELS, ROWS, newRun, step, type Ev, type Input, type State } from '../lib/starAdventure'
import { FOE_SET, PLACES, SEA_FOES, SEA_LEVEL, THEMES, monsterTheme, type FoeImgs, type Theme } from './gameThemes'

/**
 * 별 모험: 옆으로 달리는 발판 게임. 내 아바타로 걷고 뛰어서 별 코인을 모으고, 별 친구를 밟고, 파이프로 들어가 보너스 방에 다녀온다.
 * 규칙은 lib/starAdventure.ts(순수 함수), 여기는 그리기와 조작만. 단계마다 컨셉(별 나라·할로윈·몬스터 마을)이 돌아간다.
 */
const load = (src: string) => { const i = new Image(); i.src = assetUrl(src); return i }
type Set = { theme: Theme; foes: FoeImgs }
type Imgs = { sets: Set[]; me: HTMLCanvasElement | null; deco: HTMLImageElement[][]; potion: HTMLImageElement; sea: FoeImgs }
const ready = (i: HTMLImageElement | HTMLCanvasElement | null): i is HTMLImageElement | HTMLCanvasElement => !!i && (i instanceof HTMLCanvasElement || (i.complete && i.naturalWidth > 0))

export function StarAdventure({ onClose, outfit }: { onClose: () => void; outfit: Outfit }) {
  const [state, setState] = useState<'intro' | 'play' | 'over' | 'won'>('intro')
  const [hud, setHud] = useState({ score: 0, lives: CFG.lives, level: 1, coins: 0, stars: 0 })
  const [paused, setPaused] = useState(false)
  const [themes, setThemes] = useState<Theme[]>(() => [THEMES[0], THEMES[1], monsterTheme()])
  const box = useRef<HTMLDivElement>(null)
  const cvs = useRef<HTMLCanvasElement>(null)
  const game = useRef<State>(newRun(0))
  const keys = useRef(new window.Set<string>())
  const touch = useRef({ left: false, right: false, jump: false, down: false })
  const imgs = useRef<Imgs>({ sets: [], me: null, potion: load('starchase/heart_potion.webp'), sea: SEA_FOES.map((f) => ({ walk: load(f.walk), trapped: load(f.trapped), mad: load(f.mad), h: f.h })), deco: PLACES.map((p) => p.deco.map(([n]) => load(`race/${n}.webp`))) })
  const paid = useRef(false)
  if (localTest) (window as unknown as { __sa?: () => State }).__sa = () => game.current // 시험용(?mp=local 에서만)

  const begin = useCallback((fresh: boolean) => { if (fresh) setThemes([THEMES[0], THEMES[1], monsterTheme()]); game.current = newRun(0); paid.current = false; setState('play'); setPaused(false) }, [])
  useEffect(() => { imgs.current.sets = themes.map((th) => ({ theme: th, foes: th.foes.map((f) => ({ walk: load(f.walk), trapped: load(f.trapped), mad: load(f.mad), h: f.h })) })) }, [themes])
  useEffect(() => { renderFigure(outfit, {}, AVATARS.find((a) => a.id === getAvatar().id)).then((cv) => { imgs.current.me = cv }).catch(() => {}) }, [outfit])
  useEffect(() => { if (state !== 'play' || paused) return; startBgm('run'); return stopBgm }, [state, paused])
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (/^(ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Space|KeyA|KeyD|KeyW|KeyS)$/.test(e.code)) { e.preventDefault(); keys.current.add(e.code) }
    }
    const ku = (e: KeyboardEvent) => { keys.current.delete(e.code) }
    const clear = () => { keys.current.clear(); touch.current = { left: false, right: false, jump: false, down: false } }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear); window.addEventListener('touchcancel', clear)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); window.removeEventListener('touchcancel', clear) }
  }, [])

  const onEvents = useCallback((ev: Ev[]) => {
    for (const e of ev) {
      if (e.k === 'jump') playHop(); else if (e.k === 'coin') playCoin(); else if (e.k === 'stomp' || e.k === 'break') playPop()
      else if (e.k === 'potion') playPop(); else if (e.k === 'grow') playStar(); else if (e.k === 'shrink') playLose(); else if (e.k === 'bump') playTap(); else if (e.k === 'hit' || e.k === 'fall') playLose(); else if (e.k === 'pipe') playCloud(); else if (e.k === 'clear') playWin()
    }
  }, [])

  useEffect(() => {
    if (state !== 'play') return
    let raf = 0, prev = performance.now(), sig0 = '', cam = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (t - prev) / 1000); prev = t
      const c = cvs.current, b = box.current; if (!c || !b) return
      const W = b.clientWidth, H = b.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1)
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
      const s = game.current
      if (!paused && s.phase !== 'over' && s.phase !== 'won') {
        const k = keys.current, tc = touch.current
        const inp: Input = { left: tc.left || k.has('ArrowLeft') || k.has('KeyA'), right: tc.right || k.has('ArrowRight') || k.has('KeyD'), jump: tc.jump || k.has('ArrowUp') || k.has('KeyW') || k.has('Space'), down: tc.down || k.has('ArrowDown') || k.has('KeyS') }
        onEvents(step(s, inp, dt))
      }
      const portrait = H > W
      const sc = portrait ? W / 11 : H / 11
      const botPad = portrait ? 150 : 0
      const oy = portrait ? H - botPad - ROWS * sc : H - ROWS * sc
      const R = s.room === 'main' ? s.main : s.bonus, vis = W / sc
      const target = Math.max(0, Math.min(R.w - vis, s.p.x - vis * 0.4)); cam += (target - cam) * Math.min(1, dt * 8)
      if (s.room === 'bonus') cam = Math.max(0, Math.min(R.w - vis, s.p.x - vis * 0.4))
      const g = c.getContext('2d'); if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.save(); g.translate(-cam * sc, oy); g.scale(sc, sc)
      draw(g, s, imgs.current, t / 1000, cam, vis, H, oy, sc)
      g.restore()
      if (s.fade > 0) { g.fillStyle = `rgba(20,10,40,${Math.min(1, s.fade / 0.5)})`; g.fillRect(0, 0, W, H) }
      const sig = `${s.score}|${s.lives}|${s.level}|${s.coins}|${s.stars}|${s.phase}`
      if (sig !== sig0) {
        sig0 = sig; setHud({ score: s.score, lives: s.lives, level: s.level + 1, coins: s.coins, stars: s.stars })
        if (s.phase === 'over' || s.phase === 'won') { if (!paid.current) { paid.current = true; if (s.stars > 0) earnStars(s.stars); if (s.phase === 'won') playWin() } setState(s.phase) }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [state, paused, onEvents])

  const hold = (k: 'left' | 'right' | 'jump' | 'down') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); touch.current[k] = true },
    onPointerUp: () => { touch.current[k] = false }, onPointerCancel: () => { touch.current[k] = false }, onLostPointerCapture: () => { touch.current[k] = false },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })
  const place = PLACES[(hud.level - 1) % PLACES.length]
  const sky = <div aria-hidden className="pointer-events-none absolute inset-0 bg-cover bg-bottom" style={{ backgroundImage: `url(${assetUrl(place.sky)})` }} />
  const btn = 'absolute border-0 bg-transparent bg-contain bg-center bg-no-repeat p-0 drop-shadow-lg active:scale-90 touch-none select-none'
  const bottom = 'max(.9rem, calc(env(safe-area-inset-bottom) + .5rem))'

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden rounded-3xl bg-[#c79bea] text-[#3b2a63] ring-1 ring-black/5">
      {sky}
      <div ref={box} className="relative z-10 min-h-0 flex-1 touch-none select-none [-webkit-touch-callout:none]">
        <canvas ref={cvs} aria-label="별 모험 놀이판" className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 px-2 pt-[max(.5rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-1 whitespace-nowrap">
            <span aria-label="점수" className="flex h-11 w-[7.6rem] items-center pl-[2.9rem] text-sm font-black drop-shadow" style={{ backgroundImage: `url(${assetUrl('starchase/pill_star.webp')})`, backgroundSize: '100% 100%' }}>{hud.score}</span>
            <span aria-label="단계·코인·목숨" className="flex h-9 items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-black shadow ring-2 ring-[#cdb8f2]">{place.ico} {hud.level}/{LEVELS} · 🪙{hud.coins} · <span className="text-[#e0567a]">♥</span>{hud.lives}</span>
          </div>
          <div className="pointer-events-auto flex gap-1.5">
            <button aria-label={paused ? '계속하기' : '잠깐 멈춤'} onClick={() => { playTap(); setPaused((v) => !v) }} className="h-11 w-11 rounded-full bg-white/95 text-lg font-black shadow ring-2 ring-[#cdb8f2]">{paused ? '▶' : 'Ⅱ'}</button>
            <button aria-label="닫기" onClick={() => { playTap(); if (!paid.current && game.current.stars > 0) { paid.current = true; earnStars(game.current.stars) } onClose() }} className="h-11 w-11 rounded-full bg-white/95 text-lg font-bold shadow ring-2 ring-[#cdb8f2]">✕</button>
          </div>
        </div>
        {state === 'play' && <>
          <button aria-label="왼쪽으로" {...hold('left')} className={`${btn} left-3 h-[4.6rem] w-[4.6rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('race/btn_left.webp')})` }} />
          <button aria-label="오른쪽으로" {...hold('right')} className={`${btn} left-[6.2rem] h-[4.6rem] w-[4.6rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('race/btn_right.webp')})` }} />
          <button aria-label="파이프로 들어가기(아래)" {...hold('down')} className={`${btn} right-[6.9rem] h-[4.2rem] w-[4.2rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('starchase/btn_down.webp')})` }} />
          <button aria-label="점프" {...hold('jump')} className={`${btn} right-3 h-[5.4rem] w-[5.4rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('starchase/btn_up.webp')})` }} />
        </>}
        {paused && state === 'play' && <p role="status" className="pointer-events-none absolute inset-x-0 top-1/2 m-0 -translate-y-1/2 text-center text-3xl font-black text-white [text-shadow:0_3px_0_#7a5cc0]">잠깐 멈춤</p>}
      </div>
      {state === 'intro' && (
        <div role="dialog" aria-label="놀이 방법" className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 p-3">
          <div className="flex max-h-full w-full max-w-xs flex-col items-center gap-2 overflow-y-auto rounded-3xl bg-[#fff8ec] p-4 text-center shadow-xl ring-2 ring-[#cdb8f2]">
            <p className="m-0 text-xl font-black">🌟 별 모험</p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-left text-sm font-bold text-[#6b5a99]">
              <li>◀ ▶ <b>달리기</b> · ▲ <b>점프</b> — 공중에서 한 번 더 누르면 <b>더블 점프</b>! (키보드: 화살표, 스페이스)</li>
              <li>🪙 별 코인을 모아요. 계단과 높은 판을 타고 올라가면 위쪽 별도 먹을 수 있어요</li>
              <li>❓ 물음표 블록을 아래에서 톡! 코인이 나오고, 가끔 <b>하트 약병 💖</b>이 나와서 땅에 내려앉아요. 주워 먹으면 <b>몸이 커져요</b>! 커진 동안 친구에게 닿으면 원래 크기로 돌아와요(♥는 그대로)</li>
              <li>👣 친구는 <b>위에서 밟으면</b> 물리쳐요. 옆으로 닿으면 ♥가 줄어요</li>
              <li>🕳️ <b>▼ 표시가 있는 관 위에서 ▼ 버튼</b>을 누르면 보너스 방으로! (나오는 관에서 ▼ 를 누르면 돌아와요)</li>
              <li>🚩 깃발까지 가면 다음 단계예요</li>
            </ul>
            <button onClick={() => begin(false)} className="min-h-12 w-full rounded-full bg-gradient-to-b from-[#ffe27a] to-[#ffc94a] text-base font-black text-[#6b4a00] shadow-md">시작!</button>
            <button onClick={onClose} className="min-h-11 w-full rounded-full bg-white text-sm font-black text-[#6b5a99] ring-2 ring-[#cdb8f2]">🏡 마을로</button>
          </div>
        </div>
      )}
      {(state === 'over' || state === 'won') && (
        <div role="dialog" aria-label="결과" className="absolute inset-0 z-40 flex items-center justify-center bg-[#2a1a5e]/45 p-3">
          <div className="flex w-full max-w-xs flex-col items-center gap-2 rounded-3xl bg-[#fff8ec] p-4 text-center shadow-xl ring-2 ring-[#cdb8f2]">
            <p className="m-0 text-2xl font-black">{state === 'won' ? '모험을 끝냈어! 🎉' : '다음에는 더 가봐요!'}</p>
            <p className="m-0 text-sm font-bold text-[#6b5a99]">점수 {hud.score}점 · 코인 {hud.coins}개 · {state === 'won' ? `${LEVELS}단계 모두 끝!` : `${hud.level}단계까지 갔어요`}</p>
            {hud.stars > 0 && <p className="m-0 text-xs font-bold text-[#7a5cc0]">⭐ {hud.stars}개 받았어요</p>}
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => begin(true)} className="min-h-12 rounded-full bg-gradient-to-b from-[#ffe27a] to-[#ffc94a] px-5 text-base font-black text-[#6b4a00] shadow-md">한 번 더</button>
              <button onClick={onClose} className="min-h-12 rounded-full bg-white px-5 text-base font-black text-[#6b5a99] ring-2 ring-[#cdb8f2]">🏡 마을로</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───── 그리기 ───── */
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top: string, bot: string, r = 0.2) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bot)
  g.fillStyle = gr; g.beginPath(); g.roundRect(x + 0.02, y + 0.02, w - 0.04, h - 0.04, r); g.fill(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 0.05; g.stroke()
}
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, sx: number) {
  g.save(); g.translate(x, y); g.scale(sx, 1); g.beginPath()
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r * 0.48 : r; g.lineTo(Math.cos(a) * q, Math.sin(a) * q) }
  g.closePath(); g.fillStyle = '#ffd84a'; g.fill(); g.lineJoin = 'round'; g.lineWidth = 0.07; g.strokeStyle = '#e8a91e'; g.stroke(); g.restore()
}
function draw(g: CanvasRenderingContext2D, s: State, im: Imgs, t: number, cam: number, vis: number, H: number, oy: number, sc: number) {
  const set = im.sets[FOE_SET[s.level % PLACES.length]]; if (!set) return
  const pl = PLACES[s.level % PLACES.length], R = s.room === 'main' ? s.main : s.bonus
  const c0 = Math.max(0, Math.floor(cam) - 1), c1 = Math.min(R.w - 1, Math.ceil(cam + vis) + 1)
  const below = Math.ceil((H - oy) / sc) - ROWS // 화면 아래까지 땅을 이어 그린다
  // 그 장소의 구경거리(길가 그림): 너무 크지 않게(높이 2.4칸·폭 3칸 이하) 줄이고, 관·계단·블록·구덩이와 겹치면 옆으로 비켜서 놓는다(자리가 없으면 안 그린다)
  if (s.room === 'main') for (let k = 0; k * 6.3 + 3 < R.w; k++) {
    const [, h0] = pl.deco[k % pl.deco.length], i = im.deco[s.level % PLACES.length][k % pl.deco.length]; if (!ready(i)) continue
    const asp = i.naturalWidth / i.naturalHeight
    const sz = Math.min(1, 2.4 / h0, 3 / (h0 * asp)) * 0.9, h = h0 * sz, w = h * asp
    const x0 = 3 + k * 6.3 + ((k * 7) % 3) * 0.6
    if (x0 < cam - 4 || x0 > cam + vis + 4) continue
    const free = (x: number) => {
      const a = Math.floor(x - w / 2), b = Math.floor(x + w / 2)
      if (a < 1 || b >= R.w - 4) return false
      for (let c = a; c <= b; c++) { if (R.rows[10][c] !== '#') return false; for (let r = 7; r <= 9; r++) if (R.rows[r][c] !== '.' && R.rows[r][c] !== 'o') return false }
      return true
    }
    let x = NaN
    for (const d of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.5, -2.5, 3, -3]) if (free(x0 + d)) { x = x0 + d; break }
    if (Number.isNaN(x)) continue
    g.globalAlpha = 0.95; g.drawImage(i, x - w / 2, 10 - h, w, h); g.globalAlpha = 1
  }
  for (let c = c0; c <= c1; c++) {
    for (let r = 0; r < ROWS; r++) {
      const ch = R.rows[r][c]
      if (ch === '#') rr(g, c, r, 1, 1, pl.ground[0], pl.ground[1])
      else if (ch === '=') rr(g, c, r, 1, 1, '#d98a4a', '#9a5a2a', 0.12)
      else if (ch === '?' || ch === 'u') { rr(g, c, r, 1, 1, ch === '?' ? '#ffe27a' : '#b9b0c8', ch === '?' ? '#e8a91e' : '#8a8099', 0.15); if (ch === '?') { g.fillStyle = '#fff'; g.font = '900 0.8px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', c + 0.5, r + 0.55); g.textBaseline = 'alphabetic' } }
      else if ('lrefxy'.includes(ch)) { const left = 'lex'.includes(ch); rr(g, c - (left ? 0.08 : 0), r, 1.08, 1, pl.pipe[0], pl.pipe[1], 0.14) ; if (ch === 'e' || ch === 'f' || ch === 'x' || ch === 'y') { g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '900 0.55px sans-serif'; g.textAlign = 'center'; if (ch === 'e' || ch === 'x') g.fillText('▼', c + 1, r + 0.7) } }
      else if (ch === 'L' || ch === 'R') rr(g, c + (ch === 'L' ? 0.06 : 0), r, 0.94, 1.02, pl.pipe[1], pl.pipe[0], 0.06)
      else if (ch === 'o') star(g, c + 0.5, r + 0.5 + Math.sin(t * 4 + c) * 0.08, 0.38, Math.cos(t * 5 + c))
      else if (ch === 'F') { if (r === 2) { g.fillStyle = '#ff5f8f'; g.beginPath(); g.moveTo(c + 0.5, 2.1); g.lineTo(c + 2, 2.8); g.lineTo(c + 0.5, 3.5); g.fill() } g.fillStyle = '#fff'; g.fillRect(c + 0.42, r, 0.16, 1); g.strokeStyle = '#cdb8f2'; g.lineWidth = 0.04; g.strokeRect(c + 0.42, r, 0.16, 1) }
    }
    if (R.rows[ROWS - 1][c] === '#' ) for (let k = 0; k < below; k++) rr(g, c, ROWS + k, 1, 1, pl.ground[0], pl.ground[1])
  }
  // 별 친구
  for (const f of R.foes) {
    if (f.x < cam - 2 || f.x > cam + vis + 2) continue
    if (!f.alive && f.squash > 0.5) continue
    const fl = s.level % PLACES.length === SEA_LEVEL ? im.sea : set.foes
    const v = fl[f.id % Math.max(1, fl.length)]; const i = v ? v.walk : null; if (!ready(i)) continue
    const h = v.h * 0.95, w = h * i.naturalWidth / i.naturalHeight, k = f.alive ? 1 : Math.max(0.15, 1 - f.squash * 3)
    g.save(); g.translate(f.x, f.y); g.scale(f.dir > 0 ? -1 : 1, k); g.translate(0, f.alive ? -Math.abs(Math.sin(t * 8 + f.id)) * 0.1 : 0); g.drawImage(i, -w / 2, -h, w, h); g.restore()
  }
  // 하트 약병: 하얀 빛 동그라미와 함께 통통 튀며 도망간다
  for (const it of R.items) {
    const i = im.potion; if (!ready(i)) continue
    const h = 1.15, w = h * i.naturalWidth / i.naturalHeight, bob = it.vy === 0 ? Math.abs(Math.sin(t * 9)) * 0.18 : 0
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(it.x, it.y - h / 2 - bob, h * 0.65, 0, 7); g.fill()
    g.save(); g.translate(it.x, it.y - bob); g.scale(it.dir > 0 ? 1 : -1, 1); g.drawImage(i, -w / 2, -h, w, h); g.restore()
  }
  // 나
  const p = s.p, me = im.me
  if (!(p.inv > 0 && Math.floor(t * 10) % 2)) {
    const Hh = p.big ? 2.6 : 1.95, Ww = Hh * 1024 / 1536
    g.fillStyle = 'rgba(60,30,100,.25)'; g.beginPath(); g.ellipse(p.x, p.y, 0.5, 0.13, 0, 0, 7); g.fill()
    if (ready(me)) { const bob = p.on && Math.abs(p.vx) > 0.1 ? Math.abs(Math.sin(t * 14)) * 0.1 : 0; g.save(); g.translate(p.x, p.y - bob); g.scale(p.dir > 0 ? 1 : -1, 1); g.drawImage(me, -Ww / 2, -Hh * (1504 / 1536), Ww, Hh); g.restore() }
    else { g.fillStyle = '#ff8fab'; g.beginPath(); g.ellipse(p.x, p.y - 0.65, 0.35, 0.65, 0, 0, 7); g.fill() }
  }
}
