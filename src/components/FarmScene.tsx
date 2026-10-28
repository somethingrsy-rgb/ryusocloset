import { playCoin, playHarvest, playPlant, playWater, startBgm, stopBgm } from '../lib/sound'
import { actKitchen } from '../lib/kitchen'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { actFarm, CROPS, getFarm, growth, orderCrop, PLOT_COUNT, plotPrice, subscribeFarm, type CropId, type FarmAction, animalWait, ANIMAL_SECONDS, type AnimalGood } from '../lib/farm'
import { assetUrl } from '../lib/items'
import type { Outfit, Tweaks } from '../lib/types'
import { FarmFx } from './FarmFx'
import { FigureLayers } from './FigureLayers'
import { Modal } from './Modal'
import { PILL, PillText } from './pill'
import { CoinIcon } from './Icons'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { GUEST_PER_AVATAR_W, PartyInvite } from './PartyGuests'
import { MAX_FARM_FRIENDS, WALK_MS, claimed, getFarmFriends, getFriendJobs, harvestAll, setFarmFriends, setOnWatered, subscribeFarmFriends, waterNow } from '../lib/farmFriends'

type Tool = 'seed' | 'water' | 'harvest'

/**
 * 농장 그림은 두 장: 가로 화면용(1586×992)과 폰 세로용(1024×1536). 둘 다 가운데부터 아래까지 하나로 이어진 넓은 풀밭이 있고
 * 거기에 밭 20칸(앞 9칸은 무료, 나머지는 코인으로 구매)을 놓는다. 좌표는 모두 그림 안의 px.
 * 밭 칸은 오른쪽으로 기운 평행사변형 그림(1433×646)이고, 풀밭 크기에 맞춰 칸 폭(tw)과 밭 덩어리 가운데(cx, cy)를 정한다.
 */
const LAYOUT = {
  portrait: { img: 'farm_portrait3', w: 1024, h: 1536, cols: 4, rows: 5, cx: 512, cy: 885, tw: 215, rowGap: 21, avatarH: 19, home: { x: 44, y: 12 }, stall: { left: '68%', top: '17%', width: '20%', height: '17%' },
    // 우리 안 젖소·닭 자리(그림 크기에 대한 %): 눌러서 우유·달걀을 받는다
    barn: { milk: { x: 14, y: 24, w: 12, h: 6 }, egg: { x: 17, y: 28.3, w: 6, h: 4 } },
    // 우유·달걀 표시 자리(동물 머리보다 위, 동물을 가리지 않게): 가운데 x, 아래 끝 y
    tag: { milk: { x: 10, y: 19.5 }, egg: { x: 21, y: 19.5 } } },
  wide: { img: 'farm_wide2', w: 1672, h: 941, cols: 5, rows: 4, cx: 690, cy: 560, tw: 160, rowGap: 3, avatarH: 22, home: { x: 41, y: 12 }, stall: { left: '63%', top: '17%', width: '12%', height: '20%' },
    barn: { milk: { x: 11.4, y: 28, w: 7.5, h: 8 }, egg: { x: 13.3, y: 35.6, w: 3.6, h: 6 } },
    tag: { milk: { x: 9, y: 23 }, egg: { x: 16.5, y: 23 } } },
} as const
type Layout = (typeof LAYOUT)[keyof typeof LAYOUT]
/** 밭 한 칸의 가운데 위치(그림 가로·세로 %)와 칸 크기(%) */
function plotBox(i: number, L: Layout) {
  const r = Math.floor(i / L.cols)
  const c = i % L.cols
  const th = (L.tw * 646) / 1433
  const rowPitch = th + L.rowGap
  const shear = (281 / 1433) * L.tw * (rowPitch / th)
  const pitch = (1152 / 1433) * L.tw + 4
  const x = L.cx + (c - (L.cols - 1) / 2) * pitch + ((L.rows - 1) / 2 - r) * shear
  const y = L.cy + (r - (L.rows - 1) / 2) * rowPitch
  return { x: (x / L.w) * 100, y: (y / L.h) * 100, w: (L.tw / L.w) * 100, h: (th / L.h) * 100, row: r }
}
/** 아바타 크기: 높이가 그림 높이의 avatarH% 가 되도록 가로 %를 구한다 */
const avatarWidth = (L: Layout) => (L.avatarH * (1024 / 1536)) / (L.w / L.h)
/** 작물 그림 한 장의 크기(px). 가로 500 = 칸 폭의 48% */
const CROP_BOX: Record<string, [number, number]> = { carrot: [568, 499], strawberry: [578, 453], corn: [505, 619] }

/** 그림 파일이 없으면 이모지로 대신 보여 준다 (그림을 나중에 채워도 코드는 그대로) */
function FarmImg({ name, emoji, className, style, alt = '' }: { name: string; emoji: string; className?: string; style?: React.CSSProperties; alt?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span aria-hidden className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem', lineHeight: 1 }}>{emoji}</span>
  return <img src={assetUrl(`assets/farm/${name}.webp`)} alt={alt} className={className} style={style} draggable={false} onError={() => setFailed(true)} />
}

/** 친구 그림 칸 너비 ÷ 아바타 너비(파티·주방과 같은 크기) */
const FRIEND_PER_AVATAR_W = GUEST_PER_AVATAR_W * 0.8
/** 쉬는 친구가 밭 둘레를 거니는 빠르기(그림 너비 %/초)와 멈춰 서 있는 시간(초) */
const WANDER_SPEED = 7, WANDER_REST: [number, number] = [1.2, 3.2]
/** 쉬는 친구가 걸어 다니는 곳: 밭 덩어리 둘레(조금 넓게), 그림 % */
function wanderArea(L: Layout) {
  const boxes = Array.from({ length: PLOT_COUNT }, (_, i) => plotBox(i, L))
  return {
    minX: Math.max(4, Math.min(...boxes.map((b) => b.x - b.w / 2)) - 2), maxX: Math.min(96, Math.max(...boxes.map((b) => b.x + b.w / 2)) + 2),
    minY: Math.min(...boxes.map((b) => b.y - b.h / 2)) - 4, maxY: Math.max(...boxes.map((b) => b.y + b.h / 2)) + 2,
  }
}
/** 쉬는 친구 한 명이 지금 가고 있는 곳(발 위치)과 걷는 시간. until 은 걷기가 끝나는 때(0 이면 멈춰 서 있다) */
interface Stroll { x: number; y: number; ms: number; dir: 1 | -1; until: number }

const stageOf = (wateredAt: number | null, progress: number) => (wateredAt === null ? 1 : progress >= 1 ? 4 : progress < 0.4 ? 2 : 3)

export function FarmScene({ outfit, tweaks, onKitchen }: { outfit: Outfit; tweaks: Tweaks; onKitchen: () => void }) {
  const { lang } = useI18n()
  const ko = lang === 'ko'
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const [selected, setSelected] = useState<CropId>('strawberry')
  const [tool, setTool] = useState<Tool | null>(null)
  const [picker, setPicker] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [notice, setNotice] = useState('')
  const [stall, setStall] = useState(false)
  const [buying, setBuying] = useState<number | null>(null)
  const [homeKey, setHomeKey] = useState<'portrait' | 'wide'>('portrait')
  const [pos, setPos] = useState<{ x: number; y: number; z: number } | null>(null)
  const [walking, setWalking] = useState(false)
  const [watering, setWatering] = useState(false)
  const [hold, setHold] = useState<'can' | 'basket' | 'seed'>('can')
  // 같이 농사짓는 친구들과 그 친구들이 하는 일(물 주기는 lib/farmFriends 가 맡아서, 다른 탭에 가도 하던 일을 마친다)
  const friends = useSyncExternalStore(subscribeFarmFriends, getFarmFriends)
  const jobs = useSyncExternalStore(subscribeFarmFriends, getFriendJobs)
  const [picking, setPicking] = useState(false)
  // 쉬는 친구는 멀뚱히 서 있지 않고 밭 둘레를 천천히 거닐다 멈췄다 한다(친구마다 따로)
  const [strolls, setStrolls] = useState<Record<number, Stroll>>({})
  useEffect(() => { setOnWatered((kind) => { if (kind === 'water') playWater(); else playHarvest(); setNow(Date.now()) }); return () => setOnWatered(null) }, [])
  const pending = useRef(new Set<number>()) // 지금 처리 중인 밭 (같은 밭을 두 번 누르는 것만 막는다. 걷는 중에 다른 밭은 바로 누를 수 있다)
  const walkToken = useRef(0)
  const secRef = useRef<HTMLElement>(null)
  /** 폰 가로처럼 그림 오른쪽에 빈 자리가 넉넉하면 도구 버튼을 그림 위가 아니라 그 빈 자리에 둔다 */
  const [side, setSide] = useState(false)
  const [wide, setWide] = useState(false) // 가로로 넓은 화면(패드 가로 등): 가로 그림을 쓰고 도구 버튼을 오른쪽에 세로로 얹는다
  useEffect(() => {
    const el = secRef.current
    if (!el) return
    const ro = new ResizeObserver(() => { setWide(el.clientWidth > el.clientHeight * 1.2); setSide(el.clientWidth - Math.min(el.clientWidth, el.clientHeight * 1.6) >= 170) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const timers = useRef<number[]>([])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])
  // 농장에 있는 동안 새소리와 카페 노래를 같이 튼다
  useEffect(() => { startBgm('birds+cafe'); return stopBgm }, [])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(t) }, [notice])

  /** 젖소·닭에게서 우유·달걀 받기: 주방 냉장고(마트 재료 칸)에 하나 들어간다 */
  const collect = (g: AnimalGood) => {
    const wait = animalWait(getFarm(), g, Date.now())
    if (wait > 0) { setNotice(ko ? `${wait}초 뒤에 다시 받을 수 있어요` : `Ready again in ${wait}s`); return }
    if (actFarm({ type: 'collect', good: g }) !== 'saved') return
    actKitchen({ type: 'add', id: g, n: 1 })
    playHarvest(); setNow(Date.now())
    setNotice(g === 'milk' ? (ko ? '🥛 우유를 받았어요! 주방 냉장고에 넣었어요' : '🥛 Got milk! It went to the kitchen') : (ko ? '🥚 달걀을 받았어요! 주방 냉장고에 넣었어요' : '🥚 Got an egg! It went to the kitchen'))
  }
  const apply = (action: FarmAction) => {
    const result = actFarm(action)
    if (result === 'saved') {
      if (action.type === 'plant') playPlant()
      else if (action.type === 'water') playWater()
      else if (action.type === 'harvest') playHarvest()
      else playCoin() // 밭 사기·납품·팔기
    }
    setNow(Date.now())
    if (result === 'failed') setNotice(ko ? '저장하지 못했어요. 저장 공간을 확인해주세요.' : 'Could not save. Check storage.')
    else if (result === 'invalid') setNotice(ko ? '아직 할 수 없는 동작이에요.' : 'Not possible yet.')
    return result === 'saved'
  }

  const L = wide ? LAYOUT.wide : LAYOUT.portrait
  const aw = avatarWidth(L)
  /** 아바타는 처음에는 건물 사이 빈 자리에 서 있고, 화면 방향(가로/세로)이 바뀌면 그 그림의 처음 자리로 돌아간다 */
  const here = pos && homeKey === (wide ? 'wide' : 'portrait') ? pos : { x: L.home.x, y: L.home.y, z: 3 }
  useEffect(() => { const k = wide ? 'wide' : 'portrait'; if (k !== homeKey) { setHomeKey(k); setPos(null) } }, [wide, homeKey])

  useEffect(() => {
    const area = wanderArea(L)
    const ids: number[] = []
    const step = (f: number, from?: { x: number; y: number }) => {
      const x = area.minX + Math.random() * (area.maxX - area.minX), y = area.minY + Math.random() * (area.maxY - area.minY)
      const d = from ? Math.hypot(x - from.x, (y - from.y) * (L.h / L.w)) : 0
      const ms = from ? Math.max(600, (d / WANDER_SPEED) * 1000) : 0
      setStrolls((st) => ({ ...st, [f]: { x, y, ms, dir: from && x < from.x ? -1 : 1, until: Date.now() + ms } }))
      if (ms) ids.push(window.setTimeout(() => setStrolls((st) => (st[f] ? { ...st, [f]: { ...st[f], until: 0 } } : st)), ms)) // 도착: 걷는 몸짓을 멈춘다
      ids.push(window.setTimeout(() => step(f, { x, y }), ms + (WANDER_REST[0] + Math.random() * (WANDER_REST[1] - WANDER_REST[0])) * 1000))
    }
    friends.forEach((f) => step(f))
    return () => ids.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends, wide])

  const tapPlot = (i: number) => {
    if (!farm.owned[i]) { setBuying(i); setTool(null); setPicker(false); return }
    setBuying(null)
    const plot = farm.plots[i]
    const ready = growth(plot, now) === 1
    const need = !plot ? 'seed' : plot.wateredAt === null ? 'water' : ready ? 'harvest' : null
    // 어떤 도구를 골라 둬도, 밭이 필요로 하는 일(심기·물주기·수확)을 바로 한다 — 물방울 💧 이 보이는 밭은 눌러서 물을 준다
    if (!need) { setNotice(ko ? '자라는 중이에요' : 'Still growing'); return }
    if (pending.current.has(i)) return
    pending.current.add(i)
    const box = plotBox(i, L)
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
    if (claimed(i)) return // 친구가 지금 그 밭에서 일하는 중
    // 친구가 있으면 물 주기는 친구들이 저절로 한다(누르지 않아도 된다)
    if (need === 'water' && (friends.length || claimed(i))) { pending.current.delete(i); setNotice(ko ? '친구가 곧 물을 줄 거예요 💧' : 'A friend will water it soon 💧'); return }
    const token = ++walkToken.current
    setHold(need === 'harvest' ? 'basket' : need === 'seed' ? 'seed' : 'can')
    setWalking(true)
    setPos({ x: box.x - aw / 2, y: box.y + box.h / 2 - L.avatarH, z: 10 })
    later(() => {
      if (token === walkToken.current) setWalking(false)
      if (need === 'water') setWatering(true)
      later(() => {
        setWatering(false)
        if (need === 'seed') apply({ type: 'plant', plot: i, crop: selected })
        else if (need === 'water') apply({ type: 'water', plot: i })
        else apply({ type: 'harvest', plot: i })
        pending.current.delete(i)
      }, need === 'water' ? 350 : 200)
    }, 800)
  }

  const pick = (t: Tool) => {
    if (t === 'seed') { setPicker((p) => (tool === 'seed' ? !p : true)); setTool('seed'); return }
    // 친구가 있으면 물주기·수확 버튼 한 번에 친구들이 밭을 돌며 알아서 한다
    if (friends.length && t === 'water') {
      setPicker(false)
      const need = farm.plots.some((p, i) => farm.owned[i] && p && p.wateredAt === null)
      if (need) waterNow()
      setNotice(need ? (ko ? '친구들이 물을 주러 가요 💧' : 'Friends are off to water 💧') : (ko ? '물 줄 밭이 없어요' : 'Nothing to water'))
      return
    }
    if (friends.length && t === 'harvest') {
      setPicker(false)
      setNotice(harvestAll(now) ? (ko ? '친구들이 수확하러 가요 🧺' : 'Friends are off to harvest 🧺') : (ko ? '아직 다 자란 작물이 없어요' : 'Nothing is ready yet'))
      return
    }
    setPicker(false)
    setTool((cur) => (cur === t ? null : t))
  }

  const order = orderCrop(farm)
  const btn = 'min-h-11 rounded-2xl px-3 py-2 text-sm font-bold'
  const tools: { id: Tool | 'kitchen'; ko: string; en: string; icon: string; emoji: string }[] = [
    { id: 'seed', ko: '씨앗', en: 'Seeds', icon: 'icon_seed', emoji: '🌱' },
    { id: 'water', ko: '물주기', en: 'Water', icon: 'icon_water', emoji: '💧' },
    { id: 'harvest', ko: '수확', en: 'Harvest', icon: 'icon_basket', emoji: '🧺' },
    { id: 'kitchen', ko: '주방', en: 'Kitchen', icon: 'icon_kitchen', emoji: '🍳' },
  ]

  return (
    <section ref={secRef} aria-label={ko ? '나의 작은 농장' : 'My little farm'} className="relative h-full overflow-hidden rounded-3xl bg-[#b9d77a] ring-1 ring-black/5" style={{ containerType: 'size' }}>
      {/* 그림 아래 남는 자리(폰 세로): 그림 맨 아래 풀밭 색에서 연두색으로 부드럽게 이어지는 그라데이션 */}
      {!wide && <div aria-hidden className="absolute inset-x-0 bottom-0" style={{ top: 'calc(min(150cqw, 100cqh) - 3rem)', background: 'linear-gradient(to bottom, #9bad3f 0%, #aac24f 30%, #b9d77a 100%)' }} />}
      <div className={`absolute overflow-hidden select-none ${wide ? 'top-1/2 left-0 -translate-y-1/2' : 'top-0 left-1/2 -translate-x-1/2'}`} style={wide ? { width: 'min(100cqw, calc(100cqh * 1586 / 992))', aspectRatio: '1586 / 992' } : { width: 'min(100cqw, calc((100cqh - 11rem) / 1.08))', aspectRatio: '1024 / 1536', WebkitMaskImage: 'linear-gradient(to bottom, #000 95%, transparent 100%)', maskImage: 'linear-gradient(to bottom, #000 95%, transparent 100%)' }}>
        <img src={assetUrl(`assets/farm/${L.img}.webp`)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
        <FarmFx roam />
        {/* 노점: 눌러서 주민의 부탁·바구니 팔기 */}
        <button aria-label={ko ? '노점' : 'Market stall'} className="absolute rounded-2xl" style={L.stall} onClick={() => setStall(true)}>
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold shadow">{ko ? '주문' : 'Orders'} · {farm.inventory[order.id]}/2</span>
        </button>
        {/* 우리 안 젖소·닭: 다 되면 우유·달걀이 머리 위에서 통통, 누르면 받아서 주방 냉장고에 넣는다. 기다리는 동안은 남은 시간 */}
        {(['milk', 'egg'] as const).map((g) => {
          const b = L.barn[g]
          return (
            <button key={g} aria-label={g === 'milk' ? (ko ? '젖소: 우유 받기' : 'Cow: get milk') : (ko ? '닭: 달걀 받기' : 'Hen: get an egg')} onClick={() => collect(g)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border-0 bg-transparent p-0" style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, zIndex: 6 }}>
            </button>
          )
        })}
        {/* 우유·달걀 표시: 동물 머리 위쪽에 그림만. 다 되면 통통, 기다리는 동안은 흐린 그림 아래에 진행 바(카페에서 쓰던 것) */}
        {(['milk', 'egg'] as const).map((g) => {
          const t = L.tag[g]
          const wait = animalWait(farm, g, now)
          return (
            <button key={`t-${g}`} aria-hidden tabIndex={-1} onClick={() => collect(g)} className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center border-0 bg-transparent p-0" style={{ left: `${t.x}%`, top: `${t.y}%`, zIndex: 7 }}>
              <img src={assetUrl(`kitchen/ing/${g}.webp`)} alt="" draggable={false} className={`h-11 w-11 object-contain ${wait === 0 ? 'animate-bounce drop-shadow-[0_0_6px_#fff6b0]' : 'drop-shadow-[0_1px_2px_rgba(80,50,30,0.6)]'}`} />
              {wait > 0 && <span className="mt-0.5 block h-2 w-11 overflow-hidden rounded-full bg-[#eee4d3] shadow-sm"><i className="block h-full bg-[#ef8d99]" style={{ width: `${(1 - wait / ANIMAL_SECONDS) * 100}%` }} /></span>}
            </button>
          )
        })}
        {/* 밭 45칸 */}
        {Array.from({ length: PLOT_COUNT }, (_, i) => {
          const box = plotBox(i, L)
          const plot = farm.plots[i]
          const mine = farm.owned[i]
          const progress = growth(plot, now)
          const ready = progress === 1
          const crop = plot ? CROPS.find((cr) => cr.id === plot.crop)! : null
          const wet = !!plot && plot.wateredAt !== null && !ready
          const label = !mine ? (ko ? `새 밭 사기 (${plotPrice(farm)}코인)` : `Buy plot (${plotPrice(farm)} coins)`) : !plot ? (ko ? `${i + 1}번 밭 심기` : `Plant in plot ${i + 1}`) : plot.wateredAt === null ? (ko ? `${i + 1}번 밭 물 주기` : `Water plot ${i + 1}`) : ready ? (ko ? `${i + 1}번 밭 수확하기` : `Harvest plot ${i + 1}`) : (ko ? `${i + 1}번 밭 자라는 중` : `Plot ${i + 1} growing`)
          return (
            <div key={i} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, zIndex: 2 + box.row, opacity: mine ? 1 : 0.55 }}>
              <FarmImg name={wet ? 'plot_wet' : 'plot_dry'} emoji="🟫" className="absolute inset-0 h-full w-full" style={{ objectFit: 'fill' }} />
              {plot && crop && [{ x: 67, b: 40 }, { x: 34, b: 27 }].map((pp) => (
                <FarmImg key={pp.x} name={`${crop.id}_${stageOf(plot.wateredAt, progress)}`} emoji={ready ? crop.emoji : plot.wateredAt === null ? '🌰' : progress < 0.4 ? '🌱' : '🌿'} className="absolute -translate-x-1/2" style={{ left: `${pp.x}%`, bottom: `${pp.b}%`, width: `${CROP_BOX[crop.id][0] / 500 * 36}%`, aspectRatio: `${CROP_BOX[crop.id][0]} / ${CROP_BOX[crop.id][1]}`, objectFit: 'contain', objectPosition: 'bottom' }} />
              ))}
              {plot && (plot.wateredAt === null || ready) && (
                <span aria-hidden className={`absolute left-1/2 -translate-x-1/2 text-lg leading-none drop-shadow ${ready ? 'animate-bounce' : ''}`} style={{ bottom: '8%' }}>{ready ? '✨' : '💧'}</span>
              )}
              {!mine && <span aria-hidden className="absolute inset-0 flex items-center justify-center text-base drop-shadow">🔒</span>}
              <button aria-label={label} className="pointer-events-auto absolute inset-0" style={{ clipPath: 'polygon(19.6% 0, 100% 0, 80.4% 100%, 0 100%)' }} onClick={() => tapPlot(i)} />
            </div>
          )
        })}

        {/* 내 아바타: 밭 옆까지 걸어가서 직접 물 주고 수확한다 */}
        <div aria-hidden className="pointer-events-none absolute" style={{ left: `${here.x}%`, top: `${here.y}%`, width: `${aw}%`, aspectRatio: '1024 / 1536', zIndex: 10, transition: 'left 0.8s ease-in-out, top 0.8s ease-in-out' }}>
          <div className={walking ? 'farm-walk' : ''} style={{ width: '100%', height: '100%', position: 'relative' }}>
            <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
            {hold === 'can' ? (
              <img src={assetUrl('assets/farm/can.webp')} alt="" draggable={false} className="absolute" style={{ left: '66%', top: '50%', width: '34%', zIndex: 1000, transformOrigin: '15% 60%', transform: watering ? 'rotate(32deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }} />
            ) : (
              <img src={assetUrl(`assets/farm/${hold === 'seed' ? 'icon_seed' : 'icon_basket'}.webp`)} alt="" draggable={false} className="absolute" style={hold === 'seed' ? { left: '64%', top: '42%', width: '44%', zIndex: 1000 } : { left: '62%', top: '44%', width: '42%', zIndex: 1000 }} />
            )}
            {watering && <span className="absolute text-sm" style={{ left: '98%', top: '58%', zIndex: 1000 }}>💧</span>}
          </div>
        </div>

        {/* 같이 농사짓는 친구들: 평소에는 아바타 양옆을 따라다니고, 물 줄 밭이 생기면 물뿌리개를 들고 그 밭으로 걸어가 물을 준다 */}
        {friends.map((f, k) => {
          const a = CALL_ANIMALS[f]
          const fw = aw * FRIEND_PER_AVATAR_W // 친구 그림 칸 너비(%, 정사각형)
          const fh = fw * (L.w / L.h) // 같은 칸의 높이(그림 높이에 대한 %)
          const job = jobs[f]
          const box = job ? plotBox(job.plot, L) : null
          const stroll = strolls[f]
          // 발 위치(가운데 x, 발 y): 일할 때는 밭 옆, 쉴 때는 밭 둘레를 거닐며 가는 곳(아바타를 따라다니지 않는다)
          const feet = box ? { x: box.x - box.w * 0.18, y: box.y + box.h * 0.35 } : stroll ?? { x: L.home.x + aw / 2 + (k === 0 ? -1 : 1) * (aw * 0.55 + fw * 0.45), y: L.home.y + L.avatarH }
          const strolling = !job && !!stroll && stroll.until > 0 // 걷는 중
          const moving = (!!job && !job.watering) || strolling
          const walkMs = job ? WALK_MS : stroll?.ms ?? WALK_MS
          return (
            <div key={a.img} aria-hidden className="pointer-events-none absolute" style={{ left: `${feet.x - fw / 2}%`, top: `${feet.y - fh}%`, width: `${fw}%`, aspectRatio: '1 / 1', zIndex: job ? 11 : 9, transition: `left ${walkMs}ms ${job ? 'ease-in-out' : 'linear'}, top ${walkMs}ms ${job ? 'ease-in-out' : 'linear'}` }}>
              <div className={`relative h-full w-full ${moving ? 'farm-walk' : ''}`}>
                <img src={assetUrl(`cafe/stand/${a.img}_stand.webp`)} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain" style={{ transform: !job && stroll?.dir === -1 ? 'scaleX(-1)' : undefined }} />
                {job?.kind === 'water' && <img src={assetUrl('assets/farm/can.webp')} alt="" draggable={false} className="absolute" style={{ left: '62%', top: '42%', width: '46%', transformOrigin: '15% 60%', transform: job.watering ? 'rotate(32deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }} />}
                {job?.kind === 'water' && job.watering && <span className="absolute text-sm" style={{ left: '102%', top: '56%' }}>💧</span>}
                {/* 수확: 바구니를 들고 가서, 밭에서 바구니를 살짝 내렸다 들며 담는다 */}
                {job?.kind === 'harvest' && <img src={assetUrl('assets/farm/icon_basket.webp')} alt="" draggable={false} className="absolute" style={{ left: '58%', top: '44%', width: '50%', transform: job.watering ? 'translateY(12%) rotate(-8deg)' : 'none', transition: 'transform 0.2s' }} />}
                {job?.kind === 'harvest' && job.watering && <span className="absolute text-sm" style={{ left: '96%', top: '30%' }}>✨</span>}
              </div>
              {job && job.n === Math.max(...Object.values(jobs).map((j) => j.n)) && <p className="absolute bottom-[98%] left-1/2 m-0 w-max -translate-x-1/2 rounded-2xl bg-white px-2 py-0.5 text-[11px] font-bold text-[#6b4b52] shadow">{job.line}</p>}
            </div>
          )
        })}

        {buying !== null && (
          <div role="dialog" aria-label={ko ? '밭 사기' : 'Buy a plot'} className="absolute left-1/2 flex w-max max-w-[96%] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-3xl bg-white/95 p-3 shadow-lg" style={{ top: '45%', zIndex: 14 }}>
            <span className="text-sm font-extrabold">{ko ? '새 밭' : 'New plot'} · {plotPrice(farm)} <CoinIcon /></span>
            <button className={`${btn} bg-blush text-white disabled:opacity-40`} disabled={farm.coins < plotPrice(farm)} onClick={() => { if (apply({ type: 'buy', plot: buying })) setNotice(ko ? '새 밭이 생겼어요! 🌱' : 'New plot! 🌱'); setBuying(null) }}>{ko ? '사기' : 'Buy'}</button>
            <button className={`${btn} bg-petal`} onClick={() => setBuying(null)}>{ko ? '아니요' : 'No'}</button>
            {farm.coins < plotPrice(farm) && <span className="text-xs font-bold text-blush-deep">{ko ? '코인이 모자라요' : 'Not enough coins'}</span>}
          </div>
        )}

        {/* 위쪽: 코인 */}
        <div className="absolute flex items-center gap-1" style={{ right: '2.5%', top: '1.8%', zIndex: 12 }}>
          {/* 같이 농사지을 친구 고르기: 고른 친구 얼굴(혼자면 🐾) */}
          <button aria-label={ko ? '같이 농사지을 친구' : 'Farm friends'} onClick={() => setPicking(true)} className={PILL}>
            <PillText>{friends.length ? friends.map((f) => <img key={f} src={assetUrl(`cafe/face/${CALL_ANIMALS[f].img}.webp`)} alt="" draggable={false} className="-mx-0.5 inline-block h-6 w-6 object-contain align-middle" />) : '🐾'}</PillText>
          </button>
          <span className={PILL}><PillText><CoinIcon /> {farm.coins}</PillText></span>
        </div>
        {notice && <p role="status" className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-center text-xs font-bold shadow-md" style={{ top: '14%', maxWidth: '90%', zIndex: 13 }}>{notice}</p>}
      </div>

      {/* 도구 버튼: 폰은 그림 아래, 가로 화면은 그림 오른쪽 위에 세로 한 줄로 얹는다 */}
      <div className={`absolute flex flex-col items-center justify-center ${wide ? '' : 'inset-x-0 bottom-0 px-3 py-3'}`} style={wide && side ? { zIndex: 15, left: 'calc(min(100cqw, 160cqh) + 0.5rem)', right: '0.5rem', top: '50%', transform: 'translateY(-50%)' } : wide ? { zIndex: 15, left: 'calc(min(100cqw, 160cqh) * 0.715)', width: 'calc(min(100cqw, 160cqh) * 0.235)', top: 'calc((100cqh - min(100cqw, 160cqh) / 1.5988) / 2 + min(100cqw, 160cqh) / 1.5988 * 0.37)' } : { zIndex: 5, height: 'max(calc(100cqh - min(150cqw, 100cqh)), 8rem)' }}>
        <div className={`flex w-full flex-col gap-3 ${wide ? '' : 'max-w-[560px]'}`}>
          {/* 씨앗 고르기 */}
          {picker && (
            <div className="flex justify-center gap-2 rounded-3xl bg-white/95 p-2 shadow-lg" role="radiogroup" aria-label={ko ? '씨앗 고르기' : 'Choose seeds'}>
              {CROPS.map((c) => (
                <button key={c.id} role="radio" aria-checked={selected === c.id} className={`flex flex-1 flex-col items-center rounded-2xl p-1 ${selected === c.id ? 'bg-petal ring-2 ring-blush' : ''}`} onClick={() => { setSelected(c.id); setPicker(false) }}>
                  <FarmImg name={`harvest_${c.id}`} emoji={c.emoji} className="h-12 w-12 object-contain" />
                  <span className="text-xs font-bold">{c[lang]}</span>
                  <span className="text-[10px]">{c.seconds}{ko ? '초' : 's'}</span>
                  {/* 지금 가진 수 */}
                  <span className="mt-0.5 rounded-full bg-[#fdf2d8] px-2 text-xs font-extrabold text-[#6b4a2b]">×{farm.inventory[c.id]}</span>
                </button>
              ))}
            </div>
          )}

          {/* 도구 4개 */}
          <div className={wide ? 'grid grid-cols-2 gap-2' : 'flex gap-2'}>
            {tools.map((t) => {
              const active = tool === t.id
              return (
                <button key={t.id} aria-pressed={t.id === 'kitchen' ? undefined : active} className={`flex flex-1 items-center rounded-3xl border-2 shadow-md ${wide ? 'flex-col px-1 py-1.5' : 'flex-col px-1 pt-2 pb-2.5'} ${active ? 'border-blush bg-[#fff1cc]' : 'border-[#e5cfa3] bg-[#fdf2d8]/95'}`} onClick={() => (t.id === 'kitchen' ? onKitchen() : pick(t.id))}>
                  <FarmImg name={t.icon} emoji={t.emoji} className={wide ? 'h-12 w-12 shrink-0 object-contain' : 'aspect-square w-[85%] object-contain'} />
                  <span className="text-sm font-extrabold text-[#6b4a2b]">{t[lang]}</span>
                </button>
              )
            })}
          </div>
          {/* 수확량: 바구니에 든 작물 */}
          <div className={`flex justify-center rounded-2xl bg-white/80 px-2 py-1.5 ${wide ? 'gap-1.5' : 'gap-4'}`} aria-label={ko ? '수확량' : 'Harvest count'}>
            {CROPS.map((c) => (
              <span key={c.id} className="flex items-center gap-0.5 text-sm font-extrabold whitespace-nowrap text-[#6b4a2b]">
                <FarmImg name={`harvest_${c.id}`} emoji={c.emoji} className={wide ? 'h-6 w-6 object-contain' : 'h-8 w-8 object-contain'} />
                ×{farm.inventory[c.id]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {stall && (
        <Modal title={`🧺 ${ko ? '노점' : 'Market stall'}`} onClose={() => setStall(false)}>
          <div className="rounded-2xl bg-petal/60 p-3">
            <h3 className="m-0 text-sm font-bold">🐰 {ko ? '주민의 부탁' : 'Resident request'} · +12 <CoinIcon /></h3>
            <p lang="en" className="mb-1 text-base font-bold">Can I have two {order.plural}?</p>
            <p className="mt-0 text-xs">{ko ? `${order.ko} 두 개를 줄 수 있나요?` : `Give the resident two ${order.plural}.`}</p>
            <button disabled={farm.inventory[order.id] < 2} className={`${btn} w-full bg-blush text-white disabled:opacity-40`} onClick={() => apply({ type: 'deliver' })}>
              {ko ? '전달하기' : 'Deliver'} · {farm.inventory[order.id]}/2
            </button>
          </div>
          <h3 className="mt-3 mb-1 text-sm font-bold">🧺 {ko ? '바구니 팔기' : 'Sell from basket'}</h3>
          <div className="grid grid-cols-3 gap-2">
            {CROPS.map((c) => (
              <div key={c.id} className="text-center">
                <FarmImg name={`harvest_${c.id}`} emoji={c.emoji} className="mx-auto h-14 w-14 object-contain" />
                <p className="my-1 text-sm font-bold">{c[lang]} × {farm.inventory[c.id]}</p>
                <button disabled={!farm.inventory[c.id]} className={`${btn} w-full bg-petal disabled:opacity-40`} onClick={() => apply({ type: 'sell', crop: c.id })}>{ko ? '팔기' : 'Sell'} +{c.price} <CoinIcon /></button>
              </div>
            ))}
          </div>
          <p role="status" className="mt-2 min-h-5 text-xs font-bold">{notice}</p>
        </Modal>
      )}
      {picking && (
        <PartyInvite here={[]} initial={friends} max={MAX_FARM_FRIENDS} allowNone title="🌱 누구랑 같이 농사지을까요?" note={`${MAX_FARM_FRIENDS}명까지 골라요 · 친구가 물을 줘요 · 아무도 안 고르면 혼자 해요`}
          cta="🌱 같이 하기" ctaNone="🙋 혼자 할래요" onClose={() => setPicking(false)} onInvite={(a) => { setPicking(false); setFarmFriends(a) }} />
      )}
    </section>
  )
}
