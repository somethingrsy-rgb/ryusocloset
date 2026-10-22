import { playCloud, playGold, playStar } from '../lib/sound'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { isRestoring } from '../lib/restoreGuard'
import { newRain, readRainRecord, RAIN_DURATION, stepRain } from '../lib/starRain'
import type { Outfit, Tweaks } from '../lib/types'
import { FigureLayers } from './FigureLayers'
import { VillageHouse, VillageScenery } from './VillageScenery'
import { StarIcon } from './Icons'

export function StarRainWalk({ outfit, tweaks, onExit }: { outfit: Outfit; tweaks: Tweaks; onExit: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro')
  const [paused, setPaused] = useState(false)
  const [rain, setRain] = useState(newRain)
  const live = useRef(rain)
  const [record, setRecord] = useState(readRainRecord)
  const [saveError, setSaveError] = useState(false)
  const keys = useRef(new Set<string>())
  const host = useRef<HTMLElement>(null)
  const [size, setSize] = useState({ w: 390, h: 500 })
  const saved = useRef(false)
  useEffect(() => {
    const measure = () => { if (host.current) setSize({ w: host.current.clientWidth, h: host.current.clientHeight }) }
    const observer = new ResizeObserver(measure)
    if (host.current) observer.observe(host.current)
    measure(); return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const stop = () => { keys.current.clear(); setPaused(true) }
    const hidden = () => { if (document.hidden) stop() }
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', hidden) }
  }, [])
  useEffect(() => {
    if (phase !== 'playing' || paused) return
    let frame = 0, previous = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now
      let current = live.current
      const direction = (keys.current.has('ArrowRight') || keys.current.has('d') ? 1 : 0) - (keys.current.has('ArrowLeft') || keys.current.has('a') ? 1 : 0)
      if (direction) current = { ...current, targetX: current.playerX + direction * 8 }
      const next = stepRain(current, dt)
      if (next.score > current.score) (next.score - current.score >= 5 ? playGold : playStar)()
      if (next.clouds > current.clouds) playCloud()
      live.current = next; setRain(next)
      if (next.elapsed >= RAIN_DURATION) { setPhase('done'); return }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase, paused])
  useEffect(() => {
    if (phase !== 'done' || saved.current) return
    saved.current = true
    const old = readRainRecord()
    const next = { best: Math.max(old.best, live.current.score), total: old.total + live.current.score, rounds: old.rounds + 1, spent: old.spent }
    try {
      if (isRestoring()) throw Error('restore')
      localStorage.setItem('ryuso.starRain.v1', JSON.stringify(next)); setRecord(next)
    } catch { setSaveError(true) }
  }, [phase])
  const start = () => {
    const fresh = newRain(); live.current = fresh; setRain(fresh)
    saved.current = false; keys.current.clear(); setPaused(false); setSaveError(false); setPhase('playing')
    host.current?.focus({ preventScroll: true })
  }
  const point = (e: PointerEvent<HTMLElement>) => {
    if (phase !== 'playing' || paused || (e.target as HTMLElement).closest('button')) return
    const rect = e.currentTarget.getBoundingClientRect()
    live.current = { ...live.current, targetX: (e.clientX - rect.left) / rect.width * 100 }
  }
  const scale = size.h / 800
  const camera = 450 + rain.elapsed * 120
  const first = Math.floor(camera / 1500)
  const count = Math.ceil(size.w / Math.max(.1, scale) / 1500) + 2
  // 배경(수천 개의 SVG 조각)은 구간이 바뀔 때만 다시 만든다. 매 프레임 바뀌는 건 움직이는 바깥 상자의 위치뿐.
  const strip = useMemo(() => Array.from({ length: count }, (_, i) => {
    const chunk = first + i
    return <div key={chunk} className="absolute top-0 h-full" style={{ left: chunk * 1500, width: 1502 }}>
      <VillageScenery zone={chunk % 10} /><div className="absolute" style={{ left: 560, top: 340 }}><VillageHouse zone={chunk % 10} icon="🌟" /></div>
    </div>
  }), [first, count])
  const slow = phase === 'playing' && rain.elapsed < rain.slowUntil
  const btn = 'min-h-11 rounded-full bg-white/95 px-3 text-sm font-bold shadow-sm'
  return <section ref={host} tabIndex={0} aria-label="별비 산책" className="relative h-full touch-none select-none overflow-hidden rounded-3xl bg-[#d9eddf] outline-none ring-1 ring-black/5"
    onPointerDown={e => { if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return; e.currentTarget.focus({preventScroll:true}); e.currentTarget.setPointerCapture(e.pointerId); point(e) }}
    onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) point(e) }}
    onKeyDown={e => { if ((e.target as HTMLElement).closest('button')) return; const key = e.key.length===1?e.key.toLowerCase():e.key; if (['ArrowLeft','ArrowRight','a','d'].includes(key)) { e.preventDefault(); keys.current.add(key) } }}
    onKeyUp={e => { keys.current.delete(e.key.length===1?e.key.toLowerCase():e.key) }} onBlur={() => keys.current.clear()}>
    <div aria-hidden className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{width:(first+count)*1500,height:800,transform:`scale(${scale}) translateX(${-camera}px)`,willChange:'transform'}}>
      {strip}
    </div>
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#7770aa]/20 via-transparent to-transparent"/>
    {rain.drops.map(drop=><span key={drop.id} aria-hidden className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 drop-shadow-md" style={{left:`${drop.x}%`,top:`${drop.y}%`,fontSize:drop.kind==='gold'?44:drop.kind==='cloud'?38:30}}>{drop.kind==='cloud'?'🌧️':<StarIcon className={drop.kind==='gold'?'drop-shadow-[0_0_8px_#ffd54a]':''} />}</span>)}
    {rain.bursts.map(burst => {
      const progress = Math.min(1, (rain.elapsed - burst.at) / .7)
      return <div key={`burst-${burst.id}`} aria-hidden className="pointer-events-none absolute z-10" style={{ left: `${burst.x}%`, top: '80%', opacity: 1 - progress }}>
        <span className="absolute -translate-x-1/2 whitespace-nowrap text-2xl font-extrabold text-amber-500 drop-shadow-md" style={{ transform: `translate(-50%, ${-30 - progress * 42}px)` }}>+{burst.points} <StarIcon /></span>
        {Array.from({ length: 6 }, (_, i) => { const angle = i * Math.PI / 3; const distance = 12 + progress * 42; return <span key={i} className="absolute text-xl text-yellow-300 drop-shadow" style={{ transform: `translate(${Math.cos(angle) * distance - 10}px, ${Math.sin(angle) * distance - 10}px) scale(${1 - progress * .5})` }}>✦</span> })}
      </div>
    })}
    <div aria-hidden className="pointer-events-none absolute -translate-x-1/2 -translate-y-full" style={{left:`${rain.playerX}%`,top:'90%',width:'clamp(76px, 24%, 130px)',aspectRatio:'1024 / 1536',opacity:slow?.7:1}}>
      <div className={phase==='playing'&&!paused?'walk-bob h-full w-full':'h-full w-full'}><FigureLayers outfit={outfit} tweaks={tweaks} animate={false}/></div>
    </div>
    <span aria-hidden className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-4xl" style={{left:`${rain.playerX}%`,top:'80%',transform:`translate(-50%, -50%) scale(${rain.bursts.some(b => rain.elapsed - b.at < .25) ? 1.2 : 1})`}}>🧺</span>
    <header className="absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-1">
      <span className="rounded-full bg-white/95 px-3 py-2 text-sm font-bold">⏱ {Math.ceil(RAIN_DURATION-rain.elapsed)}초 · <StarIcon /> {rain.score}</span>
      <div className="flex gap-1">{phase==='playing'&&<button className={btn} aria-label={paused?'계속하기':'일시정지'} onClick={()=>{keys.current.clear();setPaused(!paused)}}>{paused?'▶':'Ⅱ'}</button>}<button className={btn} onClick={onExit}>지도</button></div>
    </header>
    {phase==='playing'&&!paused&&<p className="pointer-events-none absolute inset-x-2 bottom-1 m-0 text-center text-[11px] font-bold text-[#4c493e]">{slow?'먹구름! 잠깐 느려졌어요 ☁️':'손가락으로 좌우 이동 · 별은 받고 먹구름은 피하세요'}</p>}
    {(phase!=='playing'||paused)&&<div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white/95 p-5 text-center shadow-xl">
        <p className="my-1 text-4xl">{phase==='done'?'🌟':'🌠'}</p><h2 className="my-2 text-xl font-bold">{phase==='intro'?'별비 산책':phase==='done'?'산책 완료!':'잠깐 쉬어가요'}</h2>
        {phase==='intro'?<><p className="text-sm leading-relaxed">60초 동안 길을 걸으며 떨어지는 별을 받아요.<br/><StarIcon /> 1점 · <StarIcon className="drop-shadow-[0_0_4px_#ffd54a]" /><StarIcon className="drop-shadow-[0_0_4px_#ffd54a]" /> 5점<br/>먹구름에 닿으면 잠깐 느려져요.<br/>별을 놓쳐도 점수는 줄지 않아요.</p><p className="text-xs">화면을 누르거나 좌우로 밀어서 이동해요.<br/>키보드는 ← → 또는 A / D</p><p className="text-sm">최고 기록 <StarIcon /> {record.best} · 모은 별 {record.total}</p></>:phase==='done'?<><p className="text-lg font-bold"><StarIcon /> {rain.score}점 · 별 {rain.caught}개</p><p className="text-sm">최고 기록 {record.best}점 · 누적 별 {record.total}</p>{saveError&&<p role="alert" className="text-xs text-red-700">기록을 저장하지 못했어요. 이번 점수는 위에서 확인할 수 있어요.</p>}<p className="text-xs">모은 별과 최고 기록은 이 기기에 저장돼요. 별은 여행의 🛍 상점에서 쓸 수 있어요.</p></>:<p className="text-sm">쉬는 동안 시간과 별은 멈춰 있어요.</p>}
        <button className="min-h-12 w-full rounded-full bg-blush px-4 font-bold text-white" onClick={()=>phase==='playing'?(setPaused(false),host.current?.focus({preventScroll:true})):start()}>{phase==='intro'?'산책 시작':phase==='done'?'다시 산책하기':'계속 걷기'}</button>
        <button className="mt-2 min-h-11 w-full rounded-full bg-petal font-bold" onClick={onExit}>산책으로 돌아가기</button>
      </div>
    </div>}
  </section>
}
