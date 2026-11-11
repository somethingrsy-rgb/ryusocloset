import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { assetUrl } from '../lib/items'
import { isRestoring } from '../lib/restoreGuard'
import { LAPS, MAX_RIVALS, TIME_LIMIT, lapOf, newRace, rankNow, rewardStars, setBrake, setHold, steer, stepRace, timeLeft, type Race } from '../lib/race'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { earnStars } from '../lib/shop'
import { playCloud, playGold, playHop, playStar, playTap, playWin, startBgm, stopBgm } from '../lib/sound'

// three.js 가 커서 레이스를 열 때만 받는다
const Race3D = lazy(() => import('./Race3D').then((m) => ({ default: m.Race3D })))
import type { RaceCar, RaceTheme } from './Race3D'

const RIVAL_KEY = 'ryuso.race.rivals'
const readRivals = (): number => { try { const n = Number(localStorage.getItem(RIVAL_KEY) ?? MAX_RIVALS); return Number.isInteger(n) && n >= 0 && n <= MAX_RIVALS ? n : MAX_RIVALS } catch { return MAX_RIVALS } }
/** 같이 달릴 동물 친구를 무작위로 n마리 */
const pickAnimals = (n: number) => [...CALL_ANIMALS.keys()].sort(() => Math.random() - 0.5).slice(0, n)
const THEME_KEY = 'ryuso.race.theme'
const THEMES: { id: RaceTheme; ico: string; name: string }[] = [
  { id: 'meadow', ico: '🌳', name: '초원' },
  { id: 'snow', ico: '❄️', name: '눈 나라' },
  { id: 'candy', ico: '🍭', name: '사탕 나라' },
]
const CAR_KEY = 'ryuso.race.car'
const CARS: { id: RaceCar; name: string }[] = [{ id: 'heart', name: '하트' }, { id: 'cloud', name: '구름' }, { id: 'pumpkin', name: '마차' }, { id: 'bunny', name: '토끼' }, { id: 'star', name: '별' }]
const readCar = (): RaceCar => { try { const v = localStorage.getItem(CAR_KEY); return v === 'cloud' || v === 'pumpkin' || v === 'bunny' || v === 'star' ? v : 'heart' } catch { return 'heart' } }
const readTheme = (): RaceTheme => { try { const v = localStorage.getItem(THEME_KEY); return v === 'snow' || v === 'candy' ? v : 'meadow' } catch { return 'meadow' } }

const img = (name: string) => assetUrl(`race/${name}.webp`)
const roundBtn = 'pointer-events-auto h-24 w-24 active:scale-90 drop-shadow-lg'

/** 자동차 레이스(혼자 달리기): 차는 저절로 달리고, ◀ ▶ 로 옆 칸으로 옮긴다. 별을 모으고 부스터로 빨라지며, 바나나·물웅덩이는 잠깐 느려질 뿐 혼나지 않는다 */
export function RaceGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro')
  const [race, setRace] = useState<Race>(() => newRace())
  const live = useRef(race)
  const [oops, setOops] = useState(0)
  const [paid, setPaid] = useState(0)
  const [paused, setPaused] = useState(false)
  const [theme, setTheme] = useState<RaceTheme>(readTheme)
  const [car, setCar] = useState<RaceCar>(readCar)
  const [friends, setFriends] = useState<number>(readRivals)
  const pickFriends = (n: number) => { setFriends(n); playTap(); try { localStorage.setItem(RIVAL_KEY, String(n)) } catch { /* 저장 못 해도 이번 판은 그대로 */ } }
  const pickCar = (c: RaceCar) => { setCar(c); playTap(); try { localStorage.setItem(CAR_KEY, c) } catch { /* 저장 못 해도 이번 판은 그 차 */ } }
  const pickTheme = (t: RaceTheme) => { setTheme(t); playTap(); try { localStorage.setItem(THEME_KEY, t) } catch { /* 저장 못 해도 이번 판은 그 장소 */ } }
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

  const start = () => { const fresh = newRace(undefined, pickAnimals(friends)); live.current = fresh; setRace(fresh); saved.current = false; setPaid(0); setOops(0); setPaused(false); setPhase('playing'); playTap() }
  const go = (dir: -1 | 1) => { if (phase !== 'playing' || paused) return; live.current = steer(live.current, dir); playHop() }
  /** 단추를 누르고 있는 동안은 칸에 걸리지 않고 쭉 미끄러진다(손을 떼면 그 자리에서 멈춘다) */
  const holdOn = (dir: -1 | 1) => { go(dir); if (phase === 'playing' && !paused) live.current = setHold(live.current, dir) }
  const holdOff = (dir?: -1 | 1) => { if (dir === undefined || live.current.hold === dir) live.current = setHold(live.current, 0) }
  useEffect(() => { if (phase !== 'playing' || paused) holdOff() })
  const brake = (on: boolean) => { live.current = setBrake(live.current, on) }
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.repeat) return; if (e.key === 'ArrowLeft' || e.key === 'a') holdOn(-1); else if (e.key === 'ArrowRight' || e.key === 'd') holdOn(1); else if (e.key === 'ArrowDown' || e.key === 's') brake(true) }
    const up = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'a') holdOff(-1); else if (e.key === 'ArrowRight' || e.key === 'd') holdOff(1); else if (e.key === 'ArrowDown' || e.key === 's') brake(false) }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  })

  const counting = phase === 'playing' && race.phase === 'count'
  const oopsOn = useOops(oops)
  return (
    <section aria-label="자동차 레이스" onContextMenu={(e) => e.preventDefault()} className="relative h-full overflow-hidden rounded-3xl bg-[#bfe6ff] select-none [-webkit-touch-callout:none] [&_img]:pointer-events-none [&_img]:select-none [&_img]:[-webkit-touch-callout:none] [&_button]:[-webkit-touch-callout:none] [&_button]:touch-manipulation">
      {phase !== 'intro' && <Suspense fallback={null}><Race3D live={live} theme={theme} car={car} /></Suspense>}
      <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#c0587a] shadow">🏎️ 자동차 레이스</span>
          {phase === 'playing' && <>
            <span aria-label="모은 별" className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#b8860b] shadow">⭐ {race.stars}</span>
            <span aria-label="바퀴" className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#7a3d8f] shadow">🏁 {lapOf(race)}/{LAPS}</span>
            {race.rivals.length > 0 && <span aria-label="내 순위" className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#d0587a] shadow">🏅 {(race.finish && race.rank) || rankNow(race)}등</span>}
            <span aria-label="남은 시간" className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-black text-[#3d6b9b] shadow">⏱ {timeLeft(race)}</span>
          </>}
        </div>
        <button aria-label="닫기" onClick={() => { playTap(); onExit() }} className="pointer-events-auto h-10 w-10 rounded-full bg-white/95 text-lg font-bold shadow">✕</button>
      </div>

      {counting && (
        <div aria-live="assertive" className="pointer-events-none absolute inset-x-0 top-[14%] z-20 flex flex-col items-center gap-1">
          <img src={img(race.count > 2 ? 'light_red' : race.count > 1 ? 'light_yellow' : 'light_yellow')} alt="" className="h-24 drop-shadow-lg" />
          <p className="m-0 text-7xl font-black text-white [text-shadow:0_4px_12px_rgba(192,88,122,0.7)]">{Math.ceil(race.count)}</p>
        </div>
      )}
      {phase === 'playing' && race.phase === 'run' && race.t < 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-[14%] z-20 flex flex-col items-center gap-1">
          <img src={img('light_green')} alt="" className="h-24 drop-shadow-lg" />
          <p className="m-0 text-5xl font-black text-white [text-shadow:0_4px_12px_rgba(192,88,122,0.7)]">출발!</p>
        </div>
      )}
      {phase === 'playing' && race.finish === 'laps' && (
        <div className="pointer-events-none absolute inset-x-0 top-[14%] z-20 flex flex-col items-center gap-1">
          <img src={img('trophy')} alt="" className="h-20 drop-shadow-lg" />
          <p className="m-0 text-5xl font-black text-white [text-shadow:0_4px_12px_rgba(192,88,122,0.7)]">결승선 통과!</p>
        </div>
      )}
      {oopsOn && <p role="status" className="pointer-events-none absolute inset-x-0 top-[28%] z-20 m-0 text-center text-5xl font-black text-white [text-shadow:0_3px_10px_rgba(80,60,120,0.7)]">앗! 😮 다시 달려요!</p>}
      {phase === 'playing' && race.boost > 0 && <div className="pointer-events-none absolute inset-x-0 top-[26%] z-20 flex items-center justify-center gap-2"><img src={img('fx_boost')} alt="" className="h-16 drop-shadow-lg" /><p className="m-0 text-4xl font-black text-[#ffe45c] [text-shadow:0_3px_10px_rgba(192,88,122,0.8)]">부우웅!</p></div>}

      {phase === 'playing' && (
        <div className="pointer-events-none absolute inset-x-3 bottom-4 z-20 flex items-end justify-between">
          <button aria-label="왼쪽으로" onPointerDown={() => holdOn(-1)} onPointerUp={() => holdOff(-1)} onPointerCancel={() => holdOff(-1)} onPointerLeave={() => holdOff(-1)} className={roundBtn}><img src={img('btn_left')} alt="" draggable={false} className="h-full w-full" /></button>
          <div className="flex flex-col items-center gap-3">
            <button aria-label="브레이크(누르고 있는 동안)" onPointerDown={() => brake(true)} onPointerUp={() => brake(false)} onPointerCancel={() => brake(false)} onPointerLeave={() => brake(false)}
              className="pointer-events-auto h-16 w-16 active:scale-90 drop-shadow-lg"><img src={img('btn_brake')} alt="" draggable={false} className="h-full w-full" /></button>
            <button aria-label="오른쪽으로" onPointerDown={() => holdOn(1)} onPointerUp={() => holdOff(1)} onPointerCancel={() => holdOff(1)} onPointerLeave={() => holdOff(1)} className={roundBtn}><img src={img('btn_right')} alt="" draggable={false} className="h-full w-full" /></button>
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-[#fdf3f6] p-3">
          <div className="my-auto flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl bg-white p-4 text-center shadow-xl">
            <p className="m-0 text-xl font-black text-[#c0587a]">🏎️ 자동차 레이스</p>
            <p className="m-0 text-sm leading-snug font-bold text-[#6b4b52]">◀ ▶ 로 옆 칸에 가요. ⭐ 별은 모으고 🚀 부스터는 빨라져요.<br />🍌 바나나와 💧 물웅덩이는 살짝 느려져요. {LAPS}바퀴 또는 {TIME_LIMIT}초면 끝!</p>
            <div role="radiogroup" aria-label="같이 달릴 친구" className="flex w-full items-center gap-1.5">
              <span className="shrink-0 text-xs font-black text-[#7a3d8f]">🐾 친구 차</span>
              {[0, 1, 2, 3].map((n) => (
                <button key={n} role="radio" aria-checked={friends === n} onClick={() => pickFriends(n)}
                  className={`h-8 flex-1 rounded-full border-2 text-xs font-black ${friends === n ? 'border-[#ff8fab] bg-[#fff0f5] text-[#c0587a]' : 'border-transparent bg-[#f6eef8] text-[#7a3d8f]'}`}>{n === 0 ? '혼자' : `${n}명`}</button>
              ))}
            </div>
            <div role="radiogroup" aria-label="내 차" className="flex w-full gap-2">
              {CARS.map((c) => (
                <button key={c.id} role="radio" aria-checked={car === c.id} onClick={() => pickCar(c.id)}
                  className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border-2 py-1 text-[11px] font-black whitespace-nowrap ${car === c.id ? 'border-[#ff8fab] bg-[#fff0f5] text-[#c0587a]' : 'border-transparent bg-[#f6eef8] text-[#7a3d8f]'}`}>
                  <img src={img(`car_${c.id}_straight`)} alt="" className="h-9 w-auto" />{c.name}
                </button>
              ))}
            </div>
            <div role="radiogroup" aria-label="달릴 곳" className="flex w-full gap-2">
              {THEMES.map((t) => (
                <button key={t.id} role="radio" aria-checked={theme === t.id} onClick={() => pickTheme(t.id)}
                  className={`flex flex-1 flex-col items-center rounded-2xl border-2 py-1.5 text-xs font-black ${theme === t.id ? 'border-[#ff8fab] bg-[#fff0f5] text-[#c0587a]' : 'border-transparent bg-[#f6eef8] text-[#7a3d8f]'}`}>
                  <span className="text-2xl leading-none">{t.ico}</span>{t.name}
                </button>
              ))}
            </div>
            <button onClick={start} className="min-h-12 w-full rounded-full bg-gradient-to-r from-[#ff8fab] to-[#c58bff] text-lg font-black text-white shadow-lg active:scale-95">출발하기!</button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div role="dialog" aria-label="레이스 끝" className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 p-4">
          <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl bg-white p-5 text-center shadow-xl">
            <img src={img(race.rivals.length ? `medal_${Math.min(4, Math.max(1, race.rank))}` : race.finish === 'laps' ? 'trophy' : 'medal_4')} alt="" className="h-28 drop-shadow-lg" />
            <p className="m-0 text-xl font-black text-[#c0587a]">{race.rivals.length ? `${race.rank}등! ${race.rank === 1 ? '최고예요 🎉' : '잘 달렸어요'}` : race.finish === 'laps' ? '결승선 통과!' : '시간 끝! 잘 달렸어요'}</p>
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
