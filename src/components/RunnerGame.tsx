import { useEffect, useRef, useState } from 'react'
import { isRestoring } from '../lib/restoreGuard'
import { GROUND_Y, PLAYER_H, PLAYER_SCREEN_X, PLAYER_W, RUN_DURATION, RUN_H, START_HEARTS, jump, newRun, readRunRecord, rewardStars, stepRun, visible, writeRunRecord } from '../lib/runner'
import { earnStars } from '../lib/shop'
import { playCloud, playHop, playStar, playWin } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import { FigureLayers } from './FigureLayers'
import { StarIcon } from './Icons'

const CLOUDS = [60, 380, 700, 1010, 1330, 1650]

/** 달려라 아바타: 자동으로 달리고, 화면을 터치(또는 스페이스·↑)하면 점프. 장애물은 피하고 코인은 먹는다 */
export function RunnerGame({ outfit, tweaks, onExit }: { outfit: Outfit; tweaks: Tweaks; onExit: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro')
  const [paused, setPaused] = useState(false)
  const [run, setRun] = useState(() => newRun())
  const live = useRef(run)
  const [record, setRecord] = useState(readRunRecord)
  const [paid, setPaid] = useState(0)
  const host = useRef<HTMLElement>(null)
  const [size, setSize] = useState({ w: 390, h: 500 })
  const saved = useRef(false)

  useEffect(() => {
    const measure = () => { if (host.current) setSize({ w: host.current.clientWidth, h: host.current.clientHeight }) }
    const observer = new ResizeObserver(measure)
    if (host.current) observer.observe(host.current)
    measure()
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const stop = () => setPaused(true)
    const hidden = () => { if (document.hidden) stop() }
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', hidden) }
  }, [])
  useEffect(() => {
    if (phase !== 'playing' || paused) return
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000)); previous = now
      const next = stepRun(live.current, dt)
      for (const e of next.events) { if (e === 'coin') playStar(); else if (e === 'hit') playCloud(); else playHop() }
      live.current = { ...next, events: [] }
      setRun(live.current)
      if (next.over) { setPhase('done'); return }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase, paused])
  // 끝나면 별을 한 번만 준다
  useEffect(() => {
    if (phase !== 'done' || saved.current) return
    saved.current = true
    const stars = rewardStars(live.current)
    if (live.current.over === 'done') playWin()
    if (stars > 0 && !isRestoring()) { earnStars(stars); setPaid(stars) }
    setRecord(writeRunRecord(stars))
  }, [phase])

  const start = () => {
    const fresh = newRun(); live.current = fresh; setRun(fresh)
    saved.current = false; setPaid(0); setPaused(false); setPhase('playing')
    host.current?.focus({ preventScroll: true })
  }
  const tapJump = () => {
    if (phase !== 'playing' || paused) return
    const next = jump(live.current)
    if (next !== live.current) { live.current = next; playHop() }
  }

  const scale = size.h / RUN_H
  const viewW = size.w / Math.max(0.1, scale)
  const cam = run.x
  const { obstacles, coins } = visible(run.seed, cam, cam + viewW)
  const px = PLAYER_SCREEN_X
  const blink = run.invuln > 0 && Math.floor(run.invuln * 10) % 2 === 0
  const btn = 'min-h-11 rounded-full bg-white/95 px-3 text-sm font-bold shadow-sm'
  const progress = Math.min(1, run.elapsed / RUN_DURATION)

  return <section ref={host} tabIndex={0} aria-label="달려라 아바타" className="relative h-full touch-none select-none overflow-hidden rounded-3xl bg-gradient-to-b from-[#bfe6ff] to-[#e6f6ff] outline-none ring-1 ring-black/5"
    onPointerDown={(e) => { if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return; e.currentTarget.focus({ preventScroll: true }); tapJump() }}
    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); tapJump() } }}>
    <div aria-hidden className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width: viewW, height: RUN_H, transform: `scale(${scale})` }}>
      {CLOUDS.map((c, i) => {
        const x = ((c - cam * 0.25) % 2000 + 2000) % 2000 - 100
        return <span key={i} className="absolute text-5xl opacity-90" style={{ left: x, top: 40 + (i % 3) * 38 }}>☁️</span>
      })}
      <div className="absolute inset-x-0 bg-[#b9e08a]" style={{ top: GROUND_Y, height: RUN_H - GROUND_Y }} />
      <div className="absolute inset-x-0 bg-[#8fc760]" style={{ top: GROUND_Y, height: 8 }} />
      {obstacles.map((o) => <span key={o.id} className="absolute -translate-x-1/2 leading-none" style={{ left: o.x - cam, top: GROUND_Y - o.h + 6, fontSize: o.h }}>{o.kind}</span>)}
      {coins.filter((c) => !run.taken.includes(c.id)).map((c) => <span key={c.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-[34px] leading-none drop-shadow" style={{ left: c.x - cam, top: GROUND_Y - c.y }}>🪙</span>)}
      <div className="absolute" style={{ left: px - PLAYER_W / 2, top: GROUND_Y - run.y - PLAYER_H + 6, width: PLAYER_W, height: PLAYER_H, opacity: blink ? 0.35 : 1 }}>
        <div className={phase === 'playing' && !paused && run.y === 0 ? 'walk-bob h-full w-full' : 'h-full w-full'} style={run.y > 0 ? { transform: `rotate(${Math.max(-12, Math.min(12, run.vy / 60))}deg)` } : undefined}>
          <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
        </div>
      </div>
    </div>
    <header className="absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-1">
      <span className="rounded-full bg-white/95 px-3 py-2 text-sm font-bold">{'❤️'.repeat(Math.max(0, run.hearts))}{'🤍'.repeat(Math.max(0, START_HEARTS - run.hearts))} · 🪙 {run.coins}</span>
      <div className="flex gap-1">
        {phase === 'playing' && <button className={btn} aria-label={paused ? '계속하기' : '일시정지'} onClick={() => setPaused(!paused)}>{paused ? '▶' : 'Ⅱ'}</button>}
        <button className={btn} aria-label="닫기" onClick={onExit}>✕</button>
      </div>
    </header>
    <div aria-hidden className="pointer-events-none absolute inset-x-3 top-14 z-10 h-1.5 overflow-hidden rounded-full bg-white/60"><div className="h-full rounded-full bg-[#ff8fab]" style={{ width: `${progress * 100}%` }} /></div>
    {phase === 'playing' && !paused && run.elapsed < 4 && <p className="pointer-events-none absolute inset-x-2 bottom-3 m-0 text-center text-sm font-bold text-[#4c6f3a]">화면을 누르면 점프! 🦘</p>}
    {(phase !== 'playing' || paused) && <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white/95 p-5 text-center shadow-xl">
        <p className="my-1 text-4xl">{phase === 'done' ? (run.over === 'done' ? '🏁' : '💤') : '🏃'}</p>
        <h2 className="my-2 text-xl font-bold">{phase === 'intro' ? '달려라 아바타' : phase === 'done' ? (run.over === 'done' ? '끝까지 달렸어요!' : '하트를 다 썼어요') : '잠깐 쉬어가요'}</h2>
        {phase === 'intro' && <p className="text-sm leading-relaxed">자동으로 달려요. 화면을 누르면 점프!<br />🪨🌵🐌 는 뛰어넘고 🪙 은 먹어요.<br />{RUN_DURATION}초 동안 달리면 별 보너스 {10}개 <StarIcon /></p>}
        {phase === 'done' && <><p className="text-sm">🪙 {run.coins}개를 모았어요</p><p className="my-2 text-3xl font-black text-[#b8610a]">+{paid} <StarIcon /></p></>}
        {phase !== 'intro' && <p className="text-xs text-black/50">최고 기록 별 {record.best}개</p>}
        <button className="mt-2 min-h-12 w-full rounded-full bg-blush px-4 font-bold text-white" onClick={() => phase === 'playing' ? (setPaused(false), host.current?.focus({ preventScroll: true })) : start()}>{phase === 'intro' ? '달리기 시작' : phase === 'done' ? '한 번 더' : '계속하기'}</button>
        <button className="mt-2 min-h-11 w-full rounded-full bg-petal font-bold" onClick={onExit}>산책으로 돌아가기</button>
      </div>
    </div>}
  </section>
}
