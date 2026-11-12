import { useCallback, useEffect, useRef, useState } from 'react'
import { earnStars } from '../lib/shop'
import { playCoin, playHop, playLose, playPop, playTap, playWin, startBgm, stopBgm } from '../lib/sound'
import { assetUrl } from '../lib/items'
import { localTest } from '../lib/mp/config'
import { AVATARS, getAvatar } from '../lib/avatars'
import { renderFigure } from '../lib/exportPng'
import type { Outfit } from '../lib/types'
import { COLS, CFG, LEVELS, ROWS, newGame, step, type Ev, type Input, type State } from '../lib/bubbleBop'

/**
 * 별 거품: 한 화면 발판 게임. 내 아바타가 거품을 뿜어 별 친구를 가두고, 터뜨리면 과일이 나온다.
 * 규칙은 lib/bubbleBop.ts(순수 함수), 여기는 그리기와 조작만.
 */
import { PLACES, THEMES, monsterTheme, type FoeImgs, type Theme } from './gameThemes'
const INTRO_KEY = 'ryuso.bubble.intro'
const setKey = (k: string) => { try { localStorage.setItem(k, '1') } catch { /* 저장 못 해도 괜찮다 */ } }
const load = (src: string) => { const i = new Image(); i.src = assetUrl(src); return i }

export function BubbleBop({ onClose, outfit }: { onClose: () => void; outfit: Outfit }) {
  const [state, setState] = useState<'intro' | 'play' | 'over' | 'won'>('intro')
  const [hud, setHud] = useState({ score: 0, lives: CFG.lives, level: 1, foes: 0, stars: 0 })
  const [paused, setPaused] = useState(false)
  const [themes, setThemes] = useState<Theme[]>(() => [THEMES[0], THEMES[1], monsterTheme()])
  const [, force] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const cvs = useRef<HTMLCanvasElement>(null)
  const game = useRef<State>(newGame())
  const keys = useRef(new Set<string>())
  const touch = useRef({ left: false, right: false, jump: false, shoot: false })
  const fx = useRef<{ k: 'pop' | 'burst' | 'hit'; x: number; y: number; t: number }[]>([])
  const imgs = useRef<Imgs>({ sets: [], burst: load('starchase/burst.webp'), me: null, deco: PLACES.map((p) => p.deco.map(([n]) => load(`race/${n}.webp`))) })
  const paid = useRef(false)
  if (localTest) (window as unknown as { __bb?: () => State }).__bb = () => game.current // 시험용(?mp=local 에서만)

  const begin = useCallback((fresh: boolean) => { if (fresh) setThemes([THEMES[0], THEMES[1], monsterTheme()]); game.current = newGame(); fx.current = []; paid.current = false; setState('play'); setPaused(false) }, [])
  // 세 컨셉의 그림을 미리 불러 둔다
  useEffect(() => { imgs.current.sets = themes.map((th) => ({ theme: th, foes: th.foes.map((f) => ({ walk: load(f.walk), trapped: load(f.trapped), mad: load(f.mad), h: f.h })), fruit: th.treats.map(load) })) }, [themes])
  useEffect(() => { if (state !== 'play' || paused) return; startBgm('run'); return stopBgm }, [state, paused])
  useEffect(() => {
    const look = { avatar: getAvatar().id }
    renderFigure(outfit, {}, AVATARS.find((a) => a.id === look.avatar)).then((cv) => { imgs.current.me = cv }).catch(() => {})
  }, [outfit])

  // 키보드·화면 이탈 시 입력 해제
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

  const onEvents = useCallback((ev: Ev[]) => {
    for (const e of ev) {
      if (e.k === 'jump') playHop()
      else if (e.k === 'shoot') playTap()
      else if (e.k === 'trap' || e.k === 'pop') { playPop(); if (e.k === 'pop') fx.current.push({ k: 'pop', x: e.x!, y: e.y!, t: 0 }) }
      else if (e.k === 'defeat') { playPop(); fx.current.push({ k: 'burst', x: e.x!, y: e.y!, t: 0 }) }
      else if (e.k === 'fruit') playCoin()
      else if (e.k === 'hit') { playLose(); fx.current.push({ k: 'hit', x: e.x!, y: e.y!, t: 0 }) }
      else if (e.k === 'clear') playWin()
    }
  }, [])

  // 그리기·움직임 루프
  useEffect(() => {
    if (state !== 'play') return
    let raf = 0, prev = performance.now(), hudSig = ''
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (t - prev) / 1000); prev = t
      const c = cvs.current, b = box.current; if (!c || !b) return
      const W = b.clientWidth, H = b.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1)
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
      const s = game.current
      if (!paused && s.phase !== 'over' && s.phase !== 'won') {
        const k = keys.current, tc = touch.current
        const inp: Input = { left: tc.left || k.has('ArrowLeft') || k.has('KeyA'), right: tc.right || k.has('ArrowRight') || k.has('KeyD'), jump: tc.jump || k.has('ArrowUp') || k.has('KeyW'), shoot: tc.shoot || k.has('Space') }
        onEvents(step(s, inp, dt))
      }
      fx.current = fx.current.filter((f) => (f.t += dt) < 0.6)
      // 화면 크기에 맞춰 16×12 칸 놀이판을 놓는다(가로 화면은 가운데, 세로 화면은 위쪽)
      const portrait = H > W
      const sc = portrait ? W / COLS : Math.min(W / COLS, H / ROWS)
      // 세로 화면: 위 알약과 아래 버튼 사이를 가득 채우도록 위아래로 늘린다(최대 2.3배), 그림 크기는 조금만 키운다
      const topPad = 64, botPad = 150
      const K = portrait ? Math.max(1, Math.min(2.3, (H - topPad - botPad) / (ROWS * sc))) : 1, S = 1 + (K - 1) * 0.5
      const ox = (W - sc * COLS) / 2, oy = portrait ? topPad : (H - sc * ROWS) / 2
      const g = c.getContext('2d'); if (!g) return
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.translate(ox, oy); g.scale(sc, sc * K)
      draw(g, s, imgs.current, t / 1000, fx.current, K, S)
      const sig = `${s.score}|${s.lives}|${s.level}|${s.foes.length + s.bubbles.filter((x) => x.foe).length}|${s.stars}|${s.phase}`
      if (sig !== hudSig) {
        hudSig = sig; setHud({ score: s.score, lives: s.lives, level: s.level + 1, foes: s.foes.length + s.bubbles.filter((x) => x.foe).length, stars: s.stars })
        if (s.phase === 'over' || s.phase === 'won') {
          if (!paid.current) { paid.current = true; if (s.stars > 0) earnStars(s.stars); if (s.phase === 'won') playWin() }
          setState(s.phase)
        }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [state, paused, onEvents])

  const hold = (k: 'left' | 'right' | 'jump' | 'shoot') => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); touch.current[k] = true },
    onPointerUp: () => { touch.current[k] = false }, onPointerCancel: () => { touch.current[k] = false }, onLostPointerCapture: () => { touch.current[k] = false },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })
  const place = PLACES[(hud.level - 1) % PLACES.length]
  const sky = <div aria-hidden className="pointer-events-none absolute inset-0 bg-cover bg-bottom" style={{ backgroundImage: `url(${assetUrl(place.sky)})` }} />
  const btn = 'absolute border-0 bg-transparent bg-contain bg-center bg-no-repeat p-0 drop-shadow-lg active:scale-90 touch-none select-none'
  const bottom = 'max(.9rem, calc(env(safe-area-inset-bottom) + .5rem))'
  const pill = (img: string) => ({ backgroundImage: `url(${assetUrl(img)})`, backgroundSize: '100% 100%' })

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden rounded-3xl bg-[#c79bea] text-[#3b2a63] ring-1 ring-black/5">
      {sky}
      <div ref={box} className="relative z-10 min-h-0 flex-1 touch-none select-none [-webkit-touch-callout:none]">
        <canvas ref={cvs} aria-label="별 거품 놀이판" className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1 px-2 pt-[max(.5rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-1 whitespace-nowrap">
            <span aria-label="점수" className="flex h-11 w-[7.6rem] items-center pl-[2.9rem] text-sm font-black drop-shadow" style={pill('starchase/pill_star.webp')}>{hud.score}</span>
            <span aria-label="단계와 목숨" className="flex h-9 items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-black shadow ring-2 ring-[#cdb8f2]">{place.ico} {hud.level}/{LEVELS.length}단계 · <span className="text-[#e0567a]">♥</span>{hud.lives}</span>
          </div>
          <div className="pointer-events-auto flex gap-1.5">
            <button aria-label={paused ? '계속하기' : '잠깐 멈춤'} onClick={() => { playTap(); setPaused((v) => !v) }} className="h-11 w-11 rounded-full bg-white/95 text-lg font-black shadow ring-2 ring-[#cdb8f2]">{paused ? '▶' : 'Ⅱ'}</button>
            <button aria-label="닫기" onClick={() => { playTap(); if (!paid.current && game.current.stars > 0) { paid.current = true; earnStars(game.current.stars) } onClose() }} className="h-11 w-11 rounded-full bg-white/95 text-lg font-bold shadow ring-2 ring-[#cdb8f2]">✕</button>
          </div>
        </div>
        {state === 'play' && <>
          <button aria-label="왼쪽으로" {...hold('left')} className={`${btn} left-3 h-[4.6rem] w-[4.6rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('race/btn_left.webp')})` }} />
          <button aria-label="오른쪽으로" {...hold('right')} className={`${btn} left-[6.2rem] h-[4.6rem] w-[4.6rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('race/btn_right.webp')})` }} />
          <button aria-label="점프" {...hold('jump')} className={`${btn} right-[6.4rem] h-[4.6rem] w-[4.6rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('starchase/btn_up.webp')})` }} />
          <button aria-label="거품 쏘기" {...hold('shoot')} className={`${btn} right-3 h-[5.4rem] w-[5.4rem]`} style={{ bottom, backgroundImage: `url(${assetUrl('starchase/catch.webp')})` }} />
        </>}
        {paused && state === 'play' && <p role="status" className="pointer-events-none absolute inset-x-0 top-1/2 m-0 -translate-y-1/2 text-center text-3xl font-black text-white [text-shadow:0_3px_0_#7a5cc0]">잠깐 멈춤</p>}
      </div>
      {state === 'intro' && (
        <div role="dialog" aria-label="놀이 방법" className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 p-3">
          <div className="flex max-h-full w-full max-w-xs flex-col items-center gap-2 overflow-y-auto rounded-3xl bg-[#fff8ec] p-4 text-center shadow-xl ring-2 ring-[#cdb8f2]">
            <p className="m-0 text-xl font-black">🫧 별 거품</p>
            <p className="m-0 text-sm font-black text-[#7a5cc0]">단계마다 별 나라 → 할로윈 → 몬스터 마을이 돌아가요!</p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-left text-sm font-bold text-[#6b5a99]">
              <li>◀ ▶ <b>걷기</b> · ▲ <b>점프</b> (키보드: 화살표, 스페이스)</li>
              <li>🫧 <b>거품</b>을 쏴서 친구들을 가둬요</li>
              <li>👣 갇힌 거품을 <b>몸으로 톡</b> 터뜨리면 과일이 나와요</li>
              <li>🍓 과일을 먹으면 점수! 별 친구에게 닿으면 ♥가 줄어요</li>
            </ul>
            <button onClick={() => { setKey(INTRO_KEY); begin(false) }} className="min-h-12 w-full rounded-full bg-gradient-to-b from-[#ffe27a] to-[#ffc94a] text-base font-black text-[#6b4a00] shadow-md">시작!</button>
            <button onClick={onClose} className="min-h-11 w-full rounded-full bg-white text-sm font-black text-[#6b5a99] ring-2 ring-[#cdb8f2]">🏡 마을로</button>
          </div>
        </div>
      )}
      {(state === 'over' || state === 'won') && (
        <div role="dialog" aria-label="결과" className="absolute inset-0 z-40 flex items-center justify-center bg-[#2a1a5e]/45 p-3">
          <div className="flex w-full max-w-xs flex-col items-center gap-2 rounded-3xl bg-[#fff8ec] p-4 text-center shadow-xl ring-2 ring-[#cdb8f2]">
            <p className="m-0 text-2xl font-black">{state === 'won' ? '모두 해냈어! 🎉' : '다음에는 더 해봐요!'}</p>
            <p className="m-0 text-sm font-bold text-[#6b5a99]">점수 {hud.score}점 · {state === 'won' ? `${LEVELS.length}단계 모두 끝!` : `${hud.level}단계까지 갔어요`}</p>
            {hud.stars > 0 && <p className="m-0 text-xs font-bold text-[#7a5cc0]">⭐ {hud.stars}개 받았어요</p>}
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => { begin(true); force((n) => n + 1) }} className="min-h-12 rounded-full bg-gradient-to-b from-[#ffe27a] to-[#ffc94a] px-5 text-base font-black text-[#6b4a00] shadow-md">한 번 더</button>
              <button onClick={onClose} className="min-h-12 rounded-full bg-white px-5 text-base font-black text-[#6b5a99] ring-2 ring-[#cdb8f2]">🏡 마을로</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ───── 그리기 ───── */
type Imgs = { sets: { theme: Theme; foes: FoeImgs; fruit: HTMLImageElement[] }[]; burst: HTMLImageElement; me: HTMLCanvasElement | null; deco: HTMLImageElement[][] }
const ready = (i: HTMLImageElement | HTMLCanvasElement | null): i is HTMLImageElement | HTMLCanvasElement => !!i && (i instanceof HTMLCanvasElement || (i.complete && i.naturalWidth > 0))
function block(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top: string, bot: string, r = 0.22) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bot)
  g.fillStyle = gr; g.beginPath(); g.roundRect(x + 0.03, y + 0.03, w - 0.06, h - 0.06, r); g.fill()
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.05; g.stroke()
}
/** 세로 화면에서 놀이판을 위아래로 늘려도 그림이 찌그러지지 않게: 놓는 자리만 늘리고(K) 그림 크기는 그대로(S 배) */
function at(g: CanvasRenderingContext2D, x: number, y: number, K: number, S: number, fn: () => void) { g.save(); g.translate(x, y); g.scale(S, S / K); fn(); g.restore() }
function draw(g: CanvasRenderingContext2D, s: State, im: Imgs, t: number, fx: { k: string; x: number; y: number; t: number; text?: string }[], K = 1, S = 1) {
  const set = im.sets[s.level % 3]; if (!set) return
  const foesIm = set.foes, pl = PLACES[s.level % PLACES.length]
  // 그 장소의 구경거리를 바닥 위 뒤쪽에 세운다(놀이판 가운데 빈 곳)
  for (let k = 0; k < 3; k++) { const [, h] = pl.deco[k % pl.deco.length], i = im.deco[s.level % PLACES.length][k % pl.deco.length]; if (!ready(i)) continue
    const w = h * 0.8 * i.naturalWidth / i.naturalHeight, x = 3.5 + k * 4.6 + ((k + s.level) % 2) * 0.8; g.globalAlpha = 0.9; g.drawImage(i, x - w / 2, ROWS - 1 - h * 0.8, w, h * 0.8); g.globalAlpha = 1 }
  // 벽과 바닥, 발판(둥근 판): 위아래로 K 배 늘어난 칸
  for (let r = 0; r < ROWS; r++) { block(g, 0, r, 1, 1, pl.ground[0], pl.ground[1]); block(g, COLS - 1, r, 1, 1, pl.ground[0], pl.ground[1]) }
  for (let c = 1; c < COLS - 1; c++) block(g, c, ROWS - 1, 1, 1, pl.ground[0], pl.ground[1])
  for (let r = 0; r < ROWS - 1; r++) { let c = 1; while (c < COLS - 1) { if (!s.grid[r][c]) { c++; continue } let e = c; while (e + 1 < COLS - 1 && s.grid[r][e + 1]) e++; block(g, c, r, e - c + 1, 0.62, pl.pipe[0], pl.pipe[1], 0.3); c = e + 1 } }
  // 과일
  for (const f of s.fruits) { const i = set.fruit[f.kind]; if (ready(i)) at(g, f.x, f.y, K, S, () => {
    const h = 1.15, w = h * i.naturalWidth / i.naturalHeight; g.globalAlpha = f.t > 9 && Math.floor(t * 8) % 2 ? 0.4 : 1
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(0, -h / 2, h * 0.62, 0, 7); g.fill() // 눈에 띄게 하얀 빛 동그라미
    g.drawImage(i, -w / 2, -h + Math.sin(t * 6 + f.id) * 0.06, w, h); g.globalAlpha = 1 }) }
  // 친구들
  for (const f of s.foes) { const v = foesIm[f.id % Math.max(1, foesIm.length)]; const i = v ? (f.mad ? v.mad : v.walk) : null; if (ready(i)) at(g, f.x, f.y, K, S, () => {
    const h = v.h * (f.mad ? 1.1 : 1), w = h * i.naturalWidth / i.naturalHeight, bob = f.on ? Math.abs(Math.sin(t * 8 + f.id)) * 0.12 : 0
    g.translate(0, -bob); g.scale(f.dir > 0 ? -1 : 1, 1); g.drawImage(i, -w / 2, -h, w, h) }) }
  // 거품(갇힌 친구는 안에서 놀란 얼굴)
  for (const b of s.bubbles) at(g, b.x, b.y, K, S, () => {
    const r = b.foe ? 0.85 : 0.5, wob = 1 + Math.sin(t * 6 + b.id) * 0.04
    if (b.foe) { const v = foesIm[b.foe.id % Math.max(1, foesIm.length)]; const i = v ? v.trapped : null; if (ready(i)) { const h = Math.min(1.1, v.h * 0.85), w = h * i.naturalWidth / i.naturalHeight; g.globalAlpha = b.life < 2 && Math.floor(t * 8) % 2 ? 0.5 : 1; g.drawImage(i, -w / 2, -h * 0.55, w, h); g.globalAlpha = 1 } }
    const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(0.7, 'rgba(190,230,255,.22)'); gr.addColorStop(1, 'rgba(200,170,255,.55)')
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * wob, r / wob, 0, 0, 7); g.fill()
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 0.05; g.stroke() })
  // 나(내 아바타)
  const p = s.p, me = im.me
  if (!(p.inv > 0 && Math.floor(t * 10) % 2)) at(g, p.x, p.y, K, S, () => {
    const H = 1.95, W = H * 1024 / 1536
    g.fillStyle = 'rgba(60,30,100,.25)'; g.beginPath(); g.ellipse(0, 0, 0.5, 0.14, 0, 0, 7); g.fill()
    if (ready(me)) { const bob = p.on && Math.abs(p.vx) > 0.1 ? Math.abs(Math.sin(t * 14)) * 0.1 : 0; g.translate(0, -bob); g.scale(p.dir > 0 ? 1 : -1, 1); g.drawImage(me, -W / 2, -H * (1504 / 1536), W, H) }
    else { g.fillStyle = '#ff8fab'; g.beginPath(); g.ellipse(0, -0.65, 0.35, 0.65, 0, 0, 7); g.fill() } })
  // 효과
  for (const f of fx) at(g, f.x, f.y, K, S, () => {
    if (f.k === 'pts') { const u2 = f.t / 1.1; g.globalAlpha = 1 - u2 * u2; g.font = '900 0.7px sans-serif'; g.textAlign = 'center'; g.lineWidth = 0.14; g.strokeStyle = '#7a5cc0'; g.fillStyle = '#fff'; g.strokeText(f.text ?? '', 0, -u2 * 1.2); g.fillText(f.text ?? '', 0, -u2 * 1.2); g.globalAlpha = 1; return }
    const u = f.t / 0.6
    if (f.k === 'burst' && ready(im.burst)) { const h = 1.5 + u * 1.5; g.globalAlpha = 1 - u; g.drawImage(im.burst, -h / 2, -h / 2, h, h); g.globalAlpha = 1 }
    else { g.strokeStyle = `rgba(255,255,255,${1 - u})`; g.lineWidth = 0.08; g.beginPath(); g.arc(0, 0, 0.4 + u * 0.9, 0, 7); g.stroke() }
  })
}
