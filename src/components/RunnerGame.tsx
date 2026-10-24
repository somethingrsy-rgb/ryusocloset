import { useEffect, useRef, useState } from 'react'
import { isRestoring } from '../lib/restoreGuard'
import { BG_PER_RUN, BG_START, GIFT_Y, MAX_RISE, GROUND_Y, PLAYER_H, PLAYER_SCREEN_X, PLAYER_W, LEVELS, LEVEL_IDS, RUN_H, runDuration, readRunLevel, writeRunLevel, type LevelId, START_HEARTS, jump, newRun, readRunRecord, rewardStars, stepRun, visible, writeRunRecord } from '../lib/runner'
import { earnStars } from '../lib/shop'
import { currentAssignment, findItem, getGame, pickReward, travelItem } from '../lib/game'
import { playCloud, playGold, playHop, playStar, playWin, startBgm, stopBgm } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import { FigureLayers } from './FigureLayers'
import { StarIcon } from './Icons'
import { assetUrl } from '../lib/items'
import { ROAD_PART, ROAD_PARTS, TILE_W } from '../lib/world'

/** 보물찾기(마을 길) 배경 그림: 마을 걷기와 똑같이 화면 높이를 꽉 채우고(그림 단위 800), 달리는 길(발 닿는 곳)은 그림 속 길 높이에 맞춘다. 그림은 한 바퀴 돌아 이어진다 */
const BG_UNITS = 800
const BG_ROAD_Y = 650

/** 달려라 아바타: 자동으로 달리고, 화면을 터치(또는 스페이스·↑)하면 점프. 장애물은 피하고 코인은 먹는다 */
export function RunnerGame({ outfit, tweaks, onExit }: { outfit: Outfit; tweaks: Tweaks; onExit: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'playing' | 'done'>('intro')
  const [paused, setPaused] = useState(false)
  const [level, setLevel] = useState<LevelId>(readRunLevel)
  const [run, setRun] = useState(() => newRun(undefined, readRunLevel()))
  const live = useRef(run)
  const [record, setRecord] = useState(readRunRecord)
  const [paid, setPaid] = useState(0)
  /** 선물 상자로 받은 아이템(없으면 null) */
  const [giftItem, setGiftItem] = useState<string | null>(null)
  const [giftStars, setGiftStars] = useState(0)
  // 달리는 동안 노래(일시정지·시작 전·끝난 뒤에는 멈춘다)
  useEffect(() => { if (phase !== 'playing' || paused) return; startBgm('run'); return stopBgm }, [phase, paused])
  const host = useRef<HTMLElement>(null)
  const speedKRef = useRef(1)
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
      for (const e of next.events) { if (e === 'coin') playStar(); else if (e === 'hit') playCloud(); else if (e === 'gift') playGold(); else playHop() }
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
    // 선물 상자: 첫 상자는 여행(보물찾기)에서 아직 못 찾은 아이템을 하나 주고, 더 모은 상자는 상자마다 별 5개
    const boxes = live.current.gifts
    if (boxes > 0 && !isRestoring()) {
      const id = pickReward(currentAssignment(), getGame().found, getGame().at, 'any')
      let extra = boxes - 1
      if (id && findItem(id)) setGiftItem(id)
      else extra = boxes // 아이템을 다 찾았으면 상자마다 별로
      if (extra > 0) { earnStars(extra * 5); setGiftStars(extra * 5) }
    }
    setRecord(writeRunRecord(stars, live.current.level))
  }, [phase])

  const start = () => {
    const fresh = newRun(undefined, level, speedKRef.current); live.current = fresh; setRun(fresh)
    saved.current = false; setPaid(0); setGiftItem(null); setGiftStars(0); setPaused(false); setPhase('playing')
    host.current?.focus({ preventScroll: true })
  }
  const tapJump = () => {
    if (phase !== 'playing' || paused) return
    const next = jump(live.current)
    if (next !== live.current) { live.current = next; playHop() }
  }

  // 세로로 긴 화면에서도 가로로 충분히(400) 보이게 하고, 위가 남으면 하늘색으로 채운다(그림 맨 위가 하늘색)
  const bgScaleForFit = size.h / BG_UNITS
  // 크기는 화면 높이·너비에 맞추되, 가로 화면에서 높이 뜬 선물 상자와 높은 점프가 위에서 잘리지 않게(길 위 높이가 모자라면 줄인다)
  const scale = Math.max(0.5, Math.min(size.h / RUN_H, size.w / 400, (BG_ROAD_Y * bgScaleForFit - 70) / Math.max(GIFT_Y + 52, 372)))
  // 아바타 그림 크기(부딪히는 크기는 그대로): 두 번 점프 꼭대기에서 머리가 위로 잘리지 않는 한도까지 키운다(가로 화면은 4/3배 이상, 세로 화면은 최대 2배)
  const growFit = ((BG_ROAD_Y * bgScaleForFit - 70) / scale + 6 - MAX_RISE) / PLAYER_H
  const grow = size.w > size.h ? Math.max(4 / 3, growFit) : Math.min(2, Math.max(1, growFit))
  // 배경은 화면 높이를 꽉 채우고, 캐릭터·장애물은 그보다 작게 그 위 길에서 달린다
  const bgScale = size.h / BG_UNITS
  const offsetY = Math.max(0, BG_ROAD_Y * bgScale - GROUND_Y * scale)
  const viewW = size.w / Math.max(0.1, scale)
  // 두 번 점프해도 아바타 머리가 위 버튼 줄 밑으로 들어가지 않게 그림만 눌러 준다(부딪힘은 그대로)
  const visY = Math.min(run.y, Math.max(0, (BG_ROAD_Y * bgScale - 70) / scale - PLAYER_H * grow + 6))
  // 넓은 화면일수록 빨리 달려, 화면을 가로지르는 시간이 폰과 비슷하게(가로 화면이 느리게 느껴지던 문제)
  speedKRef.current = Math.min(2.2, Math.max(1, Math.round((viewW / 400) * 10) / 10))
  const cam = run.x
  const { obstacles, coins, gifts } = visible(run.seed, cam, cam + viewW, run.level, run.k)
  // 배경은 달린 거리에 맞춰 흐른다(장애물 그림 구간과 배경 구간이 기기 크기와 상관없이 맞도록)
  const scrollPx = (cam * BG_PER_RUN + BG_START) * bgScale
  const bgTileW = TILE_W * bgScale
  const bgTiles = Array.from({ length: Math.floor((scrollPx + size.w) / bgTileW) - Math.floor(scrollPx / bgTileW) + 1 }, (_, i) => Math.floor(scrollPx / bgTileW) + i)
  const px = PLAYER_SCREEN_X
  const blink = run.invuln > 0 && Math.floor(run.invuln * 10) % 2 === 0
  const btn = 'min-h-11 rounded-full bg-white/95 px-3 text-sm font-bold shadow-sm'
  const progress = Math.min(1, run.elapsed / runDuration(run.level))

  return <section ref={host} tabIndex={0} aria-label="달려라 아바타" className="relative h-full touch-none select-none overflow-hidden rounded-3xl bg-[#82c6fd] outline-none ring-1 ring-black/5"
    onPointerDown={(e) => { if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return; e.currentTarget.focus({ preventScroll: true }); tapJump() }}
    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); tapJump() } }}>
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {bgTiles.map((t) => Array.from({ length: ROAD_PARTS }, (_, k) => {
        const x0 = Math.round(k * ROAD_PART * 1.3)
        const x1 = k === ROAD_PARTS - 1 ? TILE_W : Math.round((k + 1) * ROAD_PART * 1.3)
        return <img key={`${t}-${k}`} src={assetUrl(`assets/farm/travel_road10_${k}.webp`)} alt="" draggable={false} className="absolute select-none" style={{ left: (t * TILE_W + x0) * bgScale - scrollPx, top: -26 * bgScale, width: (x1 - x0 + 1) * bgScale, height: 867 * bgScale, maxWidth: 'none' }} />
      }))}
    </div>
    <div aria-hidden className="pointer-events-none absolute left-0 origin-top-left" style={{ width: viewW, height: RUN_H, top: offsetY, transform: `scale(${scale})` }}>
      {obstacles.map((o) => <img key={o.id} src={assetUrl(`assets/runner/${o.img}.webp`)} alt="" draggable={false} className="absolute select-none" style={{ left: o.x - cam - o.dw / 2, top: GROUND_Y - o.h + 8, width: o.dw, height: o.h, maxWidth: 'none' }} />)}
      {gifts.filter((g) => !run.taken.includes(g.id)).map((g) => <img key={g.id} src={assetUrl('assets/runner/gift.webp')} alt="" draggable={false} className="absolute -translate-x-1/2 -translate-y-1/2 animate-bounce select-none drop-shadow-[0_0_8px_#ffd54a]" style={{ left: g.x - cam, top: GROUND_Y - g.y, width: 64, height: 64, objectFit: 'contain', maxWidth: 'none' }} />)}
      {coins.filter((c) => !run.taken.includes(c.id)).map((c) => <span key={c.id} className="absolute -translate-x-1/2 -translate-y-1/2 text-[50px] leading-none drop-shadow-[0_0_6px_#ffd54a]" style={{ left: c.x - cam, top: GROUND_Y - c.y }}><StarIcon /></span>)}
      <div className="absolute" style={{ left: px - PLAYER_W * grow / 2, top: GROUND_Y - visY - PLAYER_H * grow + 6, width: PLAYER_W * grow, height: PLAYER_H * grow, opacity: blink ? 0.35 : 1 }}>
        <div className={phase === 'playing' && !paused && run.y === 0 ? 'walk-bob h-full w-full' : 'h-full w-full'} style={run.y > 0 ? { transform: `rotate(${Math.max(-5, Math.min(5, run.vy / 160))}deg)` } : undefined}>
          <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
        </div>
      </div>
    </div>
    <header className="absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-1">
      <span className="rounded-full bg-white/95 px-3 py-2 text-sm font-bold">{'❤️'.repeat(Math.max(0, run.hearts))}{'🤍'.repeat(Math.max(0, START_HEARTS - run.hearts))} · <StarIcon /> {run.coins}{run.gifts > 0 && <> · 🎁 {run.gifts}</>}</span>
      <div className="flex gap-1">
        {phase === 'playing' && <button className={btn} aria-label={paused ? '계속하기' : '일시정지'} onClick={() => setPaused(!paused)}>{paused ? '▶' : 'Ⅱ'}</button>}
        <button className={btn} aria-label="닫기" onClick={onExit}>✕</button>
      </div>
    </header>
    <div aria-hidden className="pointer-events-none absolute inset-x-3 bottom-2.5 z-10 h-2 overflow-hidden rounded-full bg-white/80 shadow-sm ring-1 ring-black/10"><div className="h-full rounded-full bg-[#ff8fab]" style={{ width: `${progress * 100}%` }} /></div>
    {phase === 'playing' && !paused && run.elapsed < 4 && <p className="pointer-events-none absolute inset-x-2 bottom-7 m-0 text-center text-sm font-bold text-[#4c6f3a]">화면을 누르면 점프! 🦘</p>}
    {(phase !== 'playing' || paused) && <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 p-4">
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-3xl bg-white/95 p-4 text-center shadow-xl">
        <p className="my-1 text-4xl">{phase === 'done' ? (run.over === 'done' ? '🏁' : '💤') : '🏃'}</p>
        <h2 className="my-2 text-xl font-bold">{phase === 'intro' ? '달려라 아바타' : phase === 'done' ? (run.over === 'done' ? '끝까지 달렸어요!' : '하트를 다 썼어요') : '잠깐 쉬어가요'}</h2>
        {phase === 'intro' && <p className="text-sm leading-relaxed">자동으로 달려요. 화면을 누르면 점프, 공중에서 한 번 더 누르면 높이 뛰어요!<br />높이 뜬 🎁 선물 상자는 두 번 뛰어서 받아요.<br />장애물은 뛰어넘고 별 <StarIcon /> 은 먹어요.<br />{LEVELS[level].duration}초 동안 달리면 별 보너스 {LEVELS[level].bonus}개 <StarIcon /></p>}
        {phase === 'done' && run.gifts > 0 && <div className="my-2 flex items-center justify-center gap-2 rounded-2xl bg-[#fff3c4] p-2">
          <span className="text-2xl">🎁</span>
          {giftItem && travelItem(giftItem) ? <><img src={assetUrl(travelItem(giftItem)!.thumb)} alt="" className="h-12 w-12 object-contain" /><span className="text-sm font-bold">선물! {travelItem(giftItem)!.name.ko}{giftStars > 0 && <> +{giftStars} <StarIcon /></>}</span></> : <span className="text-sm font-bold">선물 {run.gifts}개 · +{giftStars} <StarIcon /></span>}
        </div>}
        {phase === 'done' && <><p className="text-sm"><StarIcon /> {run.coins}개를 모았어요</p><p className="my-2 text-3xl font-black text-[#b8610a]">+{paid} <StarIcon /></p></>}
        {phase !== 'playing' && <div role="radiogroup" aria-label="단계" className="my-2 flex justify-center gap-1">
          {LEVEL_IDS.map((l) => <button key={l} role="radio" aria-checked={level === l} onClick={() => { setLevel(l); writeRunLevel(l) }} className={`min-h-10 flex-1 rounded-full border px-2 text-sm font-bold ${level === l ? 'border-blush bg-blush text-white' : 'border-black/10 bg-white'}`}>{{ easy: '초급', normal: '중급', hard: '고급' }[l]}</button>)}
        </div>}
        {phase !== 'intro' && <p className="text-xs text-black/50">최고 기록 별 {record.best[level]}개</p>}
        <button className="mt-2 min-h-12 w-full rounded-full bg-blush px-4 font-bold text-white" onClick={() => phase === 'playing' ? (setPaused(false), host.current?.focus({ preventScroll: true })) : start()}>{phase === 'intro' ? '달리기 시작' : phase === 'done' ? '한 번 더' : '계속하기'}</button>
        <button className="mt-2 min-h-11 w-full rounded-full bg-petal font-bold" onClick={onExit}>산책으로 돌아가기</button>
      </div>
    </div>}
  </section>
}
