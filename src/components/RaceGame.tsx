import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { isRestoring } from '../lib/restoreGuard'
import { LAPS, TIME_LIMIT, lapOf, newRace, rewardStars, setBrake, steer, stepRace, timeLeft, type Race } from '../lib/race'
import { earnStars } from '../lib/shop'
import { playCloud, playGold, playHop, playStar, playTap, playWin, startBgm, stopBgm } from '../lib/sound'

// three.js 가 커서 레이스를 열 때만 받는다
const Race3D = lazy(() => import('./Race3D').then((m) => ({ default: m.Race3D })))

const roundBtn = 'pointer-events-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/90 bg-[#ff8fab] text-4xl font-black text-white shadow-xl active:scale-90'

/** 자동차 레이스(혼자 달리기): 차는 저절로 달리고, ◀ ▶ 로 옆 칸으로 옮긴다. 별을 모으고 부스터로 빨라지며, 바나나·물웅덩이는 잠깐 느려질 뿐 혼나지 않는다 */
export function RaceGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro')
  const [race, setRace] = useState<Race>(() => newRace())
  const live = useRef(race)
  const [oops, setOops] = useState(0)
  const [paid, setPaid] = useState(0)
  const [paused, setPaused] = useState(false)
  const saved = useRef(false)

  // 달리는 동안 노래
  useEffect(() => { if (phase !== 'playing' || paused) return; startBgm('run'); return stopBgm }, [phase, paused])
  // 다른 화면으로 가면 멈춘다
  useEffect(() => {
    const stop = () => setPaused(true)
    const hidden = () => { if (document.hidden) stop() }
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', hidden) }
  }, [])
  useEffect(() => {
    if (phase !== 'playing' || paused) return
    let frame = 0, prev = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000)); prev = now
      const next = stepRace(live.current, dt)
      for (const e of next.events) { if (e === 'star') playStar(); else if (e === 'boost') playGold(); else { playCloud(); setOops((n) => n + 1) } }
      live.current = { ...next, events: [] }
      setRace(live.current)
      if (next.phase === 'done') { setPhase('done'); return }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase, paused])
  // 끝나면 별을 한 번만 준다(꼴등이어도 받는다)
  useEffect(() => {
    if (phase !== 'done' || saved.current) return
    saved.current = true
    const stars = rewardStars(live.current)
    if (live.current.finish === 'laps') playWin()
    if (stars > 0 && !isRestoring() && earnStars(stars)) setPaid(stars)
  }, [phase])

  const start = () => { const fresh = newRace(); live.current = fresh; setRace(fresh); saved.current = false; setPaid(0); setOops(0); setPaused(false); setPhase('playing'); playTap() }
  const go = (dir: -1 | 1) => { if (phase !== 'playing' || paused) return; live.current = steer(live.current, dir); playHop() }
  const brake = (on: boolean) => { live.current = setBrake(live.current, on) }
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'a') go(-1); else if (e.key === 'ArrowRight' || e.key === 'd') go(1); else if (e.key === 'ArrowDown' || e.key === 's') brake(true) }
    const up = (e: KeyboardEvent) => { if (e.key === 'ArrowDown' || e.key === 's') brake(false) }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  })

  const counting = phase === 'playing' && race.phase === 'count'
  const oopsOn = useOops(oops)
  return (
    <section aria-label="자동차 레이스" className="relative h-full overflow-hidden rounded-3xl bg-[#bfe6ff] select-none">
      {phase !== 'intro' && <Suspense fallback={null}><Race3D live={live} /></Suspense>}
      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#c0587a] shadow">🏎️ 자동차 레이스</span>
          {phase === 'playing' && <>
            <span aria-label="모은 별" className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#b8860b] shadow">⭐ {race.stars}</span>
            <span aria-label="바퀴" className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#7a3d8f] shadow">🏁 {lapOf(race)}/{LAPS}</span>
            <span aria-label="남은 시간" className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#3d6b9b] shadow">⏱ {timeLeft(race)}</span>
          </>}
        </div>
        <button aria-label="닫기" onClick={() => { playTap(); onExit() }} className="pointer-events-auto h-10 w-10 rounded-full bg-white/95 text-lg font-bold shadow">✕</button>
      </div>

      {counting && <p aria-live="assertive" className="pointer-events-none absolute inset-x-0 top-1/3 z-20 m-0 text-center text-8xl font-black text-white [text-shadow:0_4px_12px_rgba(192,88,122,0.7)]">{Math.ceil(race.count)}</p>}
      {phase === 'playing' && race.phase === 'run' && race.t < 1 && <p className="pointer-events-none absolute inset-x-0 top-1/3 z-20 m-0 text-center text-6xl font-black text-white [text-shadow:0_4px_12px_rgba(192,88,122,0.7)]">출발! 🚦</p>}
      {oopsOn && <p role="status" className="pointer-events-none absolute inset-x-0 top-[28%] z-20 m-0 text-center text-5xl font-black text-white [text-shadow:0_3px_10px_rgba(80,60,120,0.7)]">앗! 😮 다시 달려요!</p>}
      {phase === 'playing' && race.boost > 0 && <p className="pointer-events-none absolute inset-x-0 top-[28%] z-20 m-0 text-center text-4xl font-black text-[#ffe45c] [text-shadow:0_3px_10px_rgba(192,88,122,0.8)]">🚀 부우웅!</p>}

      {phase === 'playing' && (
        <div className="pointer-events-none absolute inset-x-3 bottom-4 z-20 flex items-end justify-between">
          <button aria-label="왼쪽으로" onPointerDown={() => go(-1)} className={roundBtn}>◀</button>
          <div className="flex flex-col items-center gap-3">
            <button aria-label="브레이크(누르고 있는 동안)" onPointerDown={() => brake(true)} onPointerUp={() => brake(false)} onPointerCancel={() => brake(false)} onPointerLeave={() => brake(false)}
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border-4 border-white/90 bg-[#b9a6f0] text-xl text-white shadow-lg active:scale-90">✋</button>
            <button aria-label="오른쪽으로" onPointerDown={() => go(1)} className={roundBtn}>▶</button>
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#fdf3f6] p-4">
          <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl bg-white p-5 text-center shadow-xl">
            <p className="m-0 text-5xl">🏎️</p>
            <p className="m-0 text-xl font-black text-[#c0587a]">자동차 레이스</p>
            <p className="m-0 text-sm leading-snug font-bold text-[#6b4b52]">◀ ▶ 를 눌러서 옆 칸으로 가요.<br />⭐ 별은 모으고, 🚀 부스터는 빨라져요.<br />🍌 바나나와 💧 물웅덩이는 살짝 느려져요.<br />{LAPS}바퀴를 달리거나 {TIME_LIMIT}초가 되면 끝이에요!</p>
            <button onClick={start} className="min-h-12 w-full rounded-full bg-gradient-to-r from-[#ff8fab] to-[#c58bff] text-lg font-black text-white shadow-lg active:scale-95">출발하기!</button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div role="dialog" aria-label="레이스 끝" className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 p-4">
          <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl bg-white p-5 text-center shadow-xl">
            <p className="m-0 text-5xl">{race.finish === 'laps' ? '🏆' : '🌟'}</p>
            <p className="m-0 text-xl font-black text-[#c0587a]">{race.finish === 'laps' ? '결승선 통과!' : '시간 끝! 잘 달렸어요'}</p>
            <p className="m-0 text-sm font-bold text-[#6b4b52]">모은 별 ⭐ {race.stars}개 · 받은 별 ⭐ {paid || rewardStars(race)}개</p>
            <div className="mt-1 flex w-full gap-2">
              <button onClick={start} className="min-h-12 flex-1 rounded-full bg-[#ff8fab] text-base font-black text-white shadow active:scale-95">한 번 더!</button>
              <button onClick={() => { playTap(); onExit() }} className="min-h-12 flex-1 rounded-full bg-[#f3e6ea] text-base font-bold text-[#6b4b52] active:scale-95">나가기</button>
            </div>
          </div>
        </div>
      )}
      {paused && phase === 'playing' && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/25">
          <button onClick={() => setPaused(false)} className="min-h-14 rounded-full bg-white px-8 text-lg font-black text-[#c0587a] shadow-xl">▶ 계속하기</button>
        </div>
      )}
    </section>
  )
}

/** 「앗!」은 1.2초만 보인다 */
function useOops(n: number) {
  const [on, setOn] = useState(false)
  useEffect(() => { if (!n) return; setOn(true); const t = setTimeout(() => setOn(false), 1200); return () => clearTimeout(t) }, [n])
  return on
}
