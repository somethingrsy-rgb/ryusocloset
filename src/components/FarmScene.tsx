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

const stageOf = (wateredAt: number | null, progress: number) => (wateredAt === null ? 1 : progress >= 1 ? 4 : progress < 0.4 ? 2 : 3)

export function FarmScene({ outfit, tweaks, onShop }: { outfit: Outfit; tweaks: Tweaks; onShop: () => void }) {
  const { lang } = useI18n()
  const ko = lang === 'ko'
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const [selected, setSelected] = useState<CropId>('carrot')
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
    const token = ++walkToken.current
    const box = plotBox(i, L)
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
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
    setPicker(false)
    setTool((cur) => (cur === t ? null : t))
  }

  const order = orderCrop(farm)
  const btn = 'min-h-11 rounded-2xl px-3 py-2 text-sm font-bold'
  const tools: { id: Tool | 'decorate'; ko: string; en: string; icon: string; emoji: string }[] = [
    { id: 'seed', ko: '씨앗', en: 'Seeds', icon: 'icon_seed', emoji: '🌱' },
    { id: 'water', ko: '물주기', en: 'Water', icon: 'icon_water', emoji: '💧' },
    { id: 'harvest', ko: '수확', en: 'Harvest', icon: 'icon_basket', emoji: '🧺' },
    { id: 'decorate', ko: '꾸미기', en: 'Shop', icon: 'icon_decorate', emoji: '🏡' },
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
              <img src={assetUrl(`kitchen/ing/${g}.webp`)} alt="" draggable={false} className={`h-7 w-7 object-contain ${wait === 0 ? 'animate-bounce drop-shadow-[0_0_6px_#fff6b0]' : 'drop-shadow-[0_1px_2px_rgba(80,50,30,0.6)]'}`} />
              {wait > 0 && <span className="mt-0.5 block h-1.5 w-8 overflow-hidden rounded-full bg-[#eee4d3] shadow-sm"><i className="block h-full bg-[#ef8d99]" style={{ width: `${(1 - wait / ANIMAL_SECONDS) * 100}%` }} /></span>}
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
                <button key={t.id} aria-pressed={t.id === 'decorate' ? undefined : active} className={`flex flex-1 items-center rounded-3xl border-2 shadow-md ${wide ? 'flex-col px-1 py-1.5' : 'flex-col px-1 pt-2 pb-2.5'} ${active ? 'border-blush bg-[#fff1cc]' : 'border-[#e5cfa3] bg-[#fdf2d8]/95'}`} onClick={() => (t.id === 'decorate' ? onShop() : pick(t.id))}>
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
    </section>
  )
}
