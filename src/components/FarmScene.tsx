import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { actFarm, CROPS, getFarm, growth, orderCrop, plotPrice, subscribeFarm, ZONE_PLOTS, ZONES, type CropId, type FarmAction } from '../lib/farm'
import { assetUrl } from '../lib/items'
import type { Outfit, Tweaks } from '../lib/types'
import { FarmFx } from './FarmFx'
import { FigureLayers } from './FigureLayers'
import { Modal } from './Modal'
import { PILL, PillText } from './pill'

type Tool = 'seed' | 'water' | 'harvest'

/** 농장 그림은 가로로 긴 한 장(1774×887). 세 구역(왼쪽 · 가운데 · 오른쪽)이 한 장 안에 있고, 폰에서는 한 번에 3분의 1씩 보인다. 아래 좌표는 모두 그림 안의 px */
const IMG_W = 1774
const IMG_H = 887
/** 가로 화면에서 그림 위아래 빈 자리를 채우는 색: 그림 맨 윗줄·맨 아랫줄 색을 가로 9칸으로 뽑은 것. 그림 가장자리는 이 색으로 서서히 녹는다 */
const EDGE_TOP = ['#3fa3d8', '#60b1fc', '#39a1fc', '#43a3f5', '#44a3f2', '#3ba3fc', '#3ca3fc', '#3ba2fc', '#3fa3e8'] as const
const EDGE_BOTTOM = ['#3a5a1c', '#677e16', '#8d9d11', '#b4c127', '#b0c119', '#b3c318', '#b2c113', '#98aa1a', '#3f5a1c'] as const
const PANEL_W = '11rem'
const SCENE_W = `min(calc(100cqw - ${PANEL_W}), 200cqh)`
const edgeGradient = (colors: readonly string[]) => `linear-gradient(to right, ${colors.map((c, k) => `${c} calc(${SCENE_W} * ${k / (colors.length - 1)})`).join(', ')}, ${colors[colors.length - 1]} 100%)`
/** 밭 칸은 오른쪽으로 기운 평행사변형 그림(1433×646). 구역마다 빈 풀밭 크기에 맞춰 칸 폭(tw, px)과 밭 덩어리 가운데(cx, cy)를 정한다 */
const FIELD = {
  0: { cx: 310, cy: 565, tw: 140 }, // 왼쪽 땅
  1: { cx: 965, cy: 525, tw: 120 }, // 가운데(처음 땅): 건물 사이 빈 풀밭
  2: { cx: 1490, cy: 455, tw: 100 }, // 오른쪽 땅: 노점 오른쪽과 파란 집 위의 빈 풀밭
} as const
/** 밭 한 칸의 가운데 위치(그림 가로·세로 %)와 칸 크기(%) */
function plotBox(i: number) {
  const z = zoneOfPlot(i)
  const { cx, cy, tw } = FIELD[z as 0 | 1 | 2]
  const local = i % ZONE_PLOTS
  const r = Math.floor(local / 3)
  const c = local % 3
  const th = (tw * 646) / 1433
  const rowPitch = th + 3
  const shear = (281 / 1433) * tw * (rowPitch / th)
  const pitch = (1152 / 1433) * tw + 4
  const x = cx + (c - 1) * pitch + (1 - r) * shear
  const y = cy + (r - 1) * rowPitch
  return { x: (x / IMG_W) * 100, y: (y / IMG_H) * 100, w: (tw / IMG_W) * 100, h: (th / IMG_H) * 100, row: r }
}
const AVATAR_W = 19
const HOME = { x: 0.5, y: 37, z: 3 }
/** 폰에서 구역을 볼 때 화면 왼쪽 끝이 놓이는 그림 안 위치(px). 가운데는 집·헛간·밭이 한 화면에 들어오게 오른쪽으로 당겼다 */
const VIEW_X = [0, 640, IMG_W - IMG_W / 3] as const
/** 구역 z 를 볼 때 아바타가 서는 자리(그림 가로 %) */
const zoneHome = (z: number) => ({ x: (VIEW_X[z] / IMG_W) * 100 + 0.2, y: HOME.y, z: 3 })
/** 땅 세 구역(왼쪽·가운데·오른쪽)을 옆으로 이어 붙인 모양. 구역 번호 0·1·2 = 그림 순서, 밭 번호의 시작 */
const CENTER = 1
/** 밭 번호가 속한 구역(그림 순서): 0~8 가운데, 9~17 왼쪽, 18~26 오른쪽 */
const zoneOfPlot = (i: number) => (i < ZONE_PLOTS ? CENTER : i < ZONE_PLOTS * 2 ? 0 : 2)
const ZONE_NAME = [{ ko: '왼쪽 땅', en: 'Left field' }, { ko: '처음 땅', en: 'Home field' }, { ko: '오른쪽 땅', en: 'Right field' }] as const
/** 작물 그림 한 장의 크기(px). 가로 500 = 칸 폭의 48% */
const CROP_BOX: Record<string, [number, number]> = { carrot: [568, 499], strawberry: [578, 453], corn: [505, 619] }

/** 그림 파일이 없으면 이모지로 대신 보여 준다 (그림을 나중에 채워도 코드는 그대로) */
function FarmImg({ name, emoji, className, style, alt = '' }: { name: string; emoji: string; className?: string; style?: React.CSSProperties; alt?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span aria-hidden className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem', lineHeight: 1 }}>{emoji}</span>
  return <img src={assetUrl(`assets/farm/${name}.webp`)} alt={alt} className={className} style={style} draggable={false} onError={() => setFailed(true)} />
}

const stageOf = (wateredAt: number | null, progress: number) => (wateredAt === null ? 1 : progress >= 1 ? 4 : progress < 0.4 ? 2 : 3)

export function FarmScene({ outfit, tweaks, onExit, onShop }: { outfit: Outfit; tweaks: Tweaks; onExit: () => void; onShop: () => void }) {
  const { lang } = useI18n()
  const ko = lang === 'ko'
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const [selected, setSelected] = useState<CropId>('carrot')
  const [tool, setTool] = useState<Tool | null>(null)
  const [picker, setPicker] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [notice, setNotice] = useState('')
  const [stall, setStall] = useState(false)
  const [zone, setZone] = useState<number>(CENTER)
  const [buying, setBuying] = useState<number | null>(null)
  const swipe = useRef<{ x: number; at: number } | null>(null)
  const swiped = useRef(0)
  const [pos, setPos] = useState(zoneHome(CENTER))
  const [walking, setWalking] = useState(false)
  const [watering, setWatering] = useState(false)
  const [hold, setHold] = useState<'can' | 'basket' | 'seed'>('can')
  const busy = useRef(false)
  const secRef = useRef<HTMLElement>(null)
  const [wide, setWide] = useState(false) // 가로로 넓은 화면(패드 가로 등): 세 구역을 한 번에 넓게 보여 주고 버튼은 오른쪽 옆에 둔다
  useEffect(() => {
    const el = secRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWide(el.clientWidth > el.clientHeight * 1.2))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const timers = useRef<number[]>([])
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 2600); return () => clearTimeout(t) }, [notice])

  const apply = (action: FarmAction) => {
    const result = actFarm(action)
    setNow(Date.now())
    if (result === 'failed') setNotice(ko ? '저장하지 못했어요. 저장 공간을 확인해주세요.' : 'Could not save. Check storage.')
    else if (result === 'invalid') setNotice(ko ? '아직 할 수 없는 동작이에요.' : 'Not possible yet.')
    return result === 'saved'
  }

  const goZone = (z: number) => {
    if (wide || busy.current || z < 0 || z >= ZONES || z === zone) return
    setBuying(null)
    setZone(z)
    setPos(zoneHome(z))
  }

  const tapPlot = (i: number) => {
    if (Date.now() - swiped.current < 350) return // 밀어서 넘기는 중에는 밭을 누른 것으로 치지 않는다
    if (!farm.owned[i]) { setBuying(i); setTool(null); setPicker(false); return }
    setBuying(null)
    const plot = farm.plots[i]
    const ready = growth(plot, now) === 1
    const need = !plot ? 'seed' : plot.wateredAt === null ? 'water' : ready ? 'harvest' : null
    if (tool && need !== tool) {
      setNotice(tool === 'seed' ? (ko ? '빈 밭에 심어요' : 'Plant in an empty plot') : tool === 'water' ? (ko ? '심고 물 안 준 밭에 물을 줘요' : 'Water a planted plot') : (ko ? '다 자란 밭을 수확해요' : 'Harvest a grown plot'))
      return
    }
    if (!need) { setNotice(ko ? '자라는 중이에요' : 'Still growing'); return }
    if (busy.current) return
    busy.current = true
    const box = plotBox(i)
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
    setHold(need === 'harvest' ? 'basket' : need === 'seed' ? 'seed' : 'can')
    setWalking(true)
    setPos({ x: box.x - AVATAR_W / ZONES / 2, y: box.y + box.h / 2 - AVATAR_W, z: 10 })
    later(() => {
      setWalking(false)
      if (need === 'water') setWatering(true)
      later(() => {
        setWatering(false)
        if (need === 'seed') apply({ type: 'plant', plot: i, crop: selected })
        else if (need === 'water') apply({ type: 'water', plot: i })
        else apply({ type: 'harvest', plot: i })
        busy.current = false
      }, need === 'water' ? 700 : 350)
    }, 850)
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
    <section ref={secRef} aria-label={ko ? '나의 작은 농장' : 'My little farm'} className="relative h-full overflow-hidden rounded-3xl bg-[#b9d77a] ring-1 ring-black/5" style={{ containerType: 'size', ...(wide ? { background: 'linear-gradient(to bottom, #3ba3fc 0%, #5db0f2 42%, #a9bd24 58%, #98aa1a 100%)' } : null) }}>
      {/* 그림 아래 남는 자리: 그림 맨 아래 풀밭 색에서 연두색으로 부드럽게 이어지는 그라데이션 */}
      {!wide && <div aria-hidden className="absolute inset-x-0 bottom-0" style={{ top: 'calc(min(150cqw, 100cqh) - 3rem)', background: 'linear-gradient(to bottom, #9bad3f 0%, #aac24f 30%, #b9d77a 100%)' }} />}
      {wide && (
        <>
          <div aria-hidden className="absolute inset-x-0 top-0" style={{ height: '50%', background: edgeGradient(EDGE_TOP) }} />
          <div aria-hidden className="absolute inset-x-0 bottom-0" style={{ height: '50%', background: edgeGradient(EDGE_BOTTOM) }} />
        </>
      )}
      <div className={`absolute overflow-hidden select-none ${wide ? 'top-1/2 left-0 -translate-y-1/2' : 'top-0 left-1/2 -translate-x-1/2'}`} style={wide ? { width: SCENE_W, aspectRatio: '2 / 1', WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 7%, #000 93%, transparent)', maskImage: 'linear-gradient(to bottom, transparent, #000 7%, #000 93%, transparent)' } : { width: 'min(100cqw, calc((100cqh - 11rem) / 1.08))', aspectRatio: '1024 / 1536', WebkitMaskImage: 'linear-gradient(to bottom, #000 95%, transparent 100%)', maskImage: 'linear-gradient(to bottom, #000 95%, transparent 100%)' }}>
        <div
          className="absolute top-0 left-0 h-full"
          style={{ width: wide ? '100%' : `${ZONES * 100}%`, transform: wide ? undefined : `translateX(-${(VIEW_X[zone] / IMG_W) * 100}%)`, transition: 'transform 0.6s ease-in-out', touchAction: 'pan-y' }}
          onPointerDown={(e) => { swipe.current = { x: e.clientX, at: Date.now() } }}
          onPointerUp={(e) => {
            const s0 = swipe.current; swipe.current = null
            if (!s0) return
            const dx = e.clientX - s0.x
            if (Math.abs(dx) > 70 && Date.now() - s0.at < 900) { swiped.current = Date.now(); goZone(zone + (dx < 0 ? 1 : -1)) }
          }}
        >
          <img src={assetUrl('assets/farm/farm_wide.webp')} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
          {/* 장식(구름·나비·잎)은 가운데 구역 위에서만 움직인다 */}
          <div className="absolute top-0 h-full" style={{ left: `${100 / ZONES}%`, width: `${100 / ZONES}%` }}><FarmFx /></div>
          {/* 노점: 눌러서 주민의 부탁·바구니 팔기 */}
          <button aria-label={ko ? '노점' : 'Market stall'} className="absolute rounded-2xl" style={{ left: '63.5%', top: '33%', width: '12%', height: '27%' }} onClick={() => setStall(true)}>
            <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold shadow">{ko ? '주문' : 'Orders'} · {farm.inventory[order.id]}/2</span>
          </button>
          {/* 밭 27칸: 구역마다 3×3 */}
          {Array.from({ length: ZONES * ZONE_PLOTS }, (_, i) => {
            const box = plotBox(i)
            const plot = farm.plots[i]
            const mine = farm.owned[i]
            const progress = growth(plot, now)
            const ready = progress === 1
            const crop = plot ? CROPS.find((cr) => cr.id === plot.crop)! : null
            const wet = !!plot && plot.wateredAt !== null && !ready
            const label = !mine ? (ko ? `새 밭 사기 (${plotPrice(farm)}코인)` : `Buy plot (${plotPrice(farm)} coins)`) : !plot ? (ko ? `${i + 1}번 밭 심기` : `Plant in plot ${i + 1}`) : plot.wateredAt === null ? (ko ? `${i + 1}번 밭 물 주기` : `Water plot ${i + 1}`) : ready ? (ko ? `${i + 1}번 밭 수확하기` : `Harvest plot ${i + 1}`) : (ko ? `${i + 1}번 밭 자라는 중` : `Plot ${i + 1} growing`)
            return (
              <div key={i} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, zIndex: 2 + box.row, opacity: mine ? 1 : 0.5 }}>
                <FarmImg name={wet ? 'plot_wet' : 'plot_dry'} emoji="🟫" className="absolute inset-0 h-full w-full" style={{ objectFit: 'fill' }} />
                {plot && crop && [{ x: 67, b: 40 }, { x: 34, b: 27 }].map((pp) => (
                  <FarmImg key={pp.x} name={`${crop.id}_${stageOf(plot.wateredAt, progress)}`} emoji={ready ? crop.emoji : plot.wateredAt === null ? '🌰' : progress < 0.4 ? '🌱' : '🌿'} className="absolute -translate-x-1/2" style={{ left: `${pp.x}%`, bottom: `${pp.b}%`, width: `${CROP_BOX[crop.id][0] / 500 * 36}%`, aspectRatio: `${CROP_BOX[crop.id][0]} / ${CROP_BOX[crop.id][1]}`, objectFit: 'contain', objectPosition: 'bottom' }} />
                ))}
                {plot && (plot.wateredAt === null || ready) && (
                  <span aria-hidden className={`absolute left-1/2 -translate-x-1/2 text-lg leading-none drop-shadow ${ready ? 'animate-bounce' : ''}`} style={{ bottom: '8%' }}>{ready ? '✨' : '💧'}</span>
                )}
                {!mine && <span aria-hidden className="absolute inset-0 flex items-center justify-center text-xl drop-shadow">🔒</span>}
                <button aria-label={label} className="pointer-events-auto absolute inset-0" style={{ clipPath: 'polygon(19.6% 0, 100% 0, 80.4% 100%, 0 100%)' }} onClick={() => tapPlot(i)} />
              </div>
            )
          })}
          {/* 내 아바타: 밭 옆까지 걸어가서 직접 물 주고 수확한다 */}
        <div aria-hidden className="pointer-events-none absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${AVATAR_W / ZONES}%`, aspectRatio: '1024 / 1536', zIndex: 10, transition: 'left 0.8s ease-in-out, top 0.8s ease-in-out' }}>
          <div className={walking ? 'farm-walk' : ''} style={{ width: '100%', height: '100%', position: 'relative' }}>
            <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
            {hold === 'can' ? (
              <img src={assetUrl('assets/farm/can.webp')} alt="" draggable={false} className="absolute" style={{ left: '66%', top: '50%', width: '34%', transformOrigin: '15% 60%', transform: watering ? 'rotate(32deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }} />
            ) : (
              <img src={assetUrl(`assets/farm/${hold === 'seed' ? 'icon_seed' : 'icon_basket'}.webp`)} alt="" draggable={false} className="absolute" style={hold === 'seed' ? { left: '64%', top: '42%', width: '44%' } : { left: '62%', top: '44%', width: '42%' }} />
            )}
            {watering && <span className="absolute text-sm" style={{ left: '98%', top: '58%' }}>💧</span>}
          </div>
        </div>
        </div>

        {/* 옆 땅으로 가는 화살표 */}
        {!wide && zone > 0 && <button aria-label={ko ? ZONE_NAME[zone - 1].ko : ZONE_NAME[zone - 1].en} onClick={() => goZone(zone - 1)} className="absolute top-1/2 left-1 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl shadow-md ring-1 ring-black/5" style={{ zIndex: 12 }}>◀</button>}
        {!wide && zone < ZONES - 1 && <button aria-label={ko ? ZONE_NAME[zone + 1].ko : ZONE_NAME[zone + 1].en} onClick={() => goZone(zone + 1)} className="absolute top-1/2 right-1 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl shadow-md ring-1 ring-black/5" style={{ zIndex: 12 }}>▶</button>}
        <p aria-hidden hidden={wide} className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-3 py-0.5 text-xs font-bold shadow" style={{ zIndex: 12 }}>{ko ? ZONE_NAME[zone].ko : ZONE_NAME[zone].en}</p>
        {buying !== null && (
          <div role="dialog" aria-label={ko ? '밭 사기' : 'Buy a plot'} className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-3xl bg-white/95 p-3 shadow-lg" style={{ top: '45%', zIndex: 14 }}>
            <span className="text-sm font-extrabold">{ko ? '새 밭' : 'New plot'} · {plotPrice(farm)}🪙</span>
            <button className={`${btn} bg-blush text-white disabled:opacity-40`} disabled={farm.coins < plotPrice(farm)} onClick={() => { if (apply({ type: 'buy', plot: buying })) setNotice(ko ? '새 밭이 생겼어요! 🌱' : 'New plot! 🌱'); setBuying(null) }}>{ko ? '사기' : 'Buy'}</button>
            <button className={`${btn} bg-petal`} onClick={() => setBuying(null)}>{ko ? '아니요' : 'No'}</button>
            {farm.coins < plotPrice(farm) && <span className="text-xs font-bold text-blush-deep">{ko ? '코인이 모자라요' : 'Not enough coins'}</span>}
          </div>
        )}

        {/* 위쪽: 코인, 지도 */}
        <div className="absolute flex items-center gap-1" style={{ right: '2.5%', top: '1.8%', zIndex: 12 }}>
          <span className={PILL}><PillText>🪙 {farm.coins}</PillText></span>
          <button className={PILL} onClick={onExit}><PillText>🗺️ {ko ? '지도' : 'Map'}</PillText></button>
        </div>
        {notice && <p role="status" className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-center text-xs font-bold shadow-md" style={{ top: '14%', maxWidth: '90%', zIndex: 13 }}>{notice}</p>}
      </div>

      {/* 아래 도구 4개: 그림 아래 초록 바탕에 둔다 */}
      <div className={`absolute flex flex-col items-center justify-center px-3 py-3 ${wide ? 'top-0 right-0 bottom-0' : 'inset-x-0 bottom-0'}`} style={wide ? { zIndex: 5, width: PANEL_W } : { zIndex: 5, height: 'max(calc(100cqh - min(150cqw, 100cqh)), 8rem)' }}>
        <div className={`flex w-full flex-col gap-3 ${wide ? 'max-w-[300px]' : 'max-w-[560px]'}`}>
          {/* 씨앗 고르기 */}
          {picker && (
            <div className="flex justify-center gap-2 rounded-3xl bg-white/95 p-2 shadow-lg" role="radiogroup" aria-label={ko ? '씨앗 고르기' : 'Choose seeds'}>
              {CROPS.map((c) => (
                <button key={c.id} role="radio" aria-checked={selected === c.id} className={`flex flex-1 flex-col items-center rounded-2xl p-1 ${selected === c.id ? 'bg-petal ring-2 ring-blush' : ''}`} onClick={() => { setSelected(c.id); setPicker(false) }}>
                  <FarmImg name={`harvest_${c.id}`} emoji={c.emoji} className="h-12 w-12 object-contain" />
                  <span className="text-xs font-bold">{c[lang]}</span>
                  <span className="text-[10px]">{c.seconds}{ko ? '초' : 's'}</span>
                </button>
              ))}
            </div>
          )}

          {/* 아래 도구 4개 */}
          <div className={wide ? 'flex flex-col gap-2' : 'flex gap-2'}>
            {tools.map((t) => {
              const active = tool === t.id
              return (
                <button key={t.id} aria-pressed={t.id === 'decorate' ? undefined : active} className={`flex flex-1 items-center rounded-3xl border-2 shadow-md ${wide ? 'flex-row gap-2 px-2 py-1.5' : 'flex-col px-1 pt-2 pb-2.5'} ${active ? 'border-blush bg-[#fff1cc]' : 'border-[#e5cfa3] bg-[#fdf2d8]/95'}`} onClick={() => (t.id === 'decorate' ? onShop() : pick(t.id))}>
                  <FarmImg name={t.icon} emoji={t.emoji} className={wide ? 'h-12 w-12 shrink-0 object-contain' : 'aspect-square w-[85%] object-contain'} />
                  <span className="text-sm font-extrabold text-[#6b4a2b]">{t[lang]}</span>
                </button>
              )
            })}
          </div>
          {/* 수확량: 바구니에 든 작물 */}
          <div className={`flex justify-center rounded-2xl bg-white/60 px-3 py-1.5 ${wide ? 'gap-1.5' : 'gap-4'}`} aria-label={ko ? '수확량' : 'Harvest count'}>
            {CROPS.map((c) => (
              <span key={c.id} className="flex items-center gap-1 text-sm font-extrabold text-[#6b4a2b]">
                <FarmImg name={`harvest_${c.id}`} emoji={c.emoji} className="h-8 w-8 object-contain" />
                × {farm.inventory[c.id]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {stall && (
        <Modal title={`🧺 ${ko ? '노점' : 'Market stall'}`} onClose={() => setStall(false)}>
          <div className="rounded-2xl bg-petal/60 p-3">
            <h3 className="m-0 text-sm font-bold">🐰 {ko ? '주민의 부탁' : 'Resident request'} · +12🪙</h3>
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
                <button disabled={!farm.inventory[c.id]} className={`${btn} w-full bg-petal disabled:opacity-40`} onClick={() => apply({ type: 'sell', crop: c.id })}>{ko ? '팔기' : 'Sell'} +{c.price}🪙</button>
              </div>
            ))}
          </div>
          <p role="status" className="mt-2 min-h-5 text-xs font-bold">{notice}</p>
        </Modal>
      )}
    </section>
  )
}
