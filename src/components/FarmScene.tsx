import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { actFarm, CROPS, getFarm, growth, orderCrop, subscribeFarm, type CropId, type FarmAction } from '../lib/farm'
import { assetUrl } from '../lib/items'
import type { Outfit, Tweaks } from '../lib/types'
import { FigureLayers } from './FigureLayers'
import { Modal } from './Modal'
import { PILL, PillText } from './pill'
import { ShopModal } from './ShopModal'

type Tool = 'seed' | 'water' | 'harvest'

/** 밭 9칸: 오른쪽으로 기운 평행사변형. 위 줄일수록 오른쪽으로 밀려 전체가 비스듬한 밭이 된다 (배경 그림 기준 %) */
const TILE_W = 22
const TILE_H = TILE_W * (646 / 1386) * (1024 / 1536)
const PITCH = 18.6
const SHEAR = TILE_W * 0.203
const ROW_Y = [51, 58.3, 65.6]
const FIRST_X = 32.5
const AVATAR_W = 19
const HOME = { x: 0.5, y: 37, z: 3 }
/** 작물 그림 한 장의 크기(px). 가로 500 = 칸 폭의 48% */
const CROP_BOX: Record<string, [number, number]> = { carrot: [568, 499], strawberry: [578, 453], corn: [505, 619] }

/** 그림 파일이 없으면 이모지로 대신 보여 준다 (그림을 나중에 채워도 코드는 그대로) */
function FarmImg({ name, emoji, className, style, alt = '' }: { name: string; emoji: string; className?: string; style?: React.CSSProperties; alt?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span aria-hidden className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem', lineHeight: 1 }}>{emoji}</span>
  return <img src={assetUrl(`assets/farm/${name}.webp`)} alt={alt} className={className} style={style} draggable={false} onError={() => setFailed(true)} />
}

const stageOf = (wateredAt: number | null, progress: number) => (wateredAt === null ? 1 : progress >= 1 ? 4 : progress < 0.4 ? 2 : 3)

export function FarmScene({ outfit, tweaks, onExit, onWear }: { outfit: Outfit; tweaks: Tweaks; onExit: () => void; onWear: (id: string) => void }) {
  const { lang } = useI18n()
  const ko = lang === 'ko'
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const [selected, setSelected] = useState<CropId>('carrot')
  const [tool, setTool] = useState<Tool | null>(null)
  const [picker, setPicker] = useState(false)
  const [now, setNow] = useState(Date.now)
  const [notice, setNotice] = useState('')
  const [stall, setStall] = useState(false)
  const [shop, setShop] = useState(false)
  const [pos, setPos] = useState(HOME)
  const [walking, setWalking] = useState(false)
  const [watering, setWatering] = useState(false)
  const [hold, setHold] = useState<'can' | 'basket'>('can')
  const busy = useRef(false)
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

  const tapPlot = (i: number) => {
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
    const r = Math.floor(i / 3)
    const px = FIRST_X + SHEAR * (2 - r) + (i % 3) * PITCH
    const py = ROW_Y[r]
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
    setHold(need === 'harvest' ? 'basket' : 'can')
    setWalking(true)
    setPos({ x: px - TILE_W * 0.45 - AVATAR_W / 2, y: py - AVATAR_W + 2, z: 2 + r })
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
    <section aria-label={ko ? '나의 작은 농장' : 'My little farm'} className="relative h-full overflow-hidden rounded-3xl bg-[#b9d77a] ring-1 ring-black/5" style={{ containerType: 'size' }}>
      {/* 그림 아래 남는 자리: 그림 맨 아래 풀밭 색에서 연두색으로 부드럽게 이어지는 그라데이션 */}
      <div aria-hidden className="absolute inset-x-0 bottom-0" style={{ top: 'calc(min(150cqw, 100cqh) - 3rem)', background: 'linear-gradient(to bottom, #9bad3f 0%, #aac24f 30%, #b9d77a 100%)' }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 select-none" style={{ width: 'min(100cqw, calc(100cqh * 1024 / 1536))', aspectRatio: '1024 / 1536', WebkitMaskImage: 'linear-gradient(to bottom, #000 95%, transparent 100%)', maskImage: 'linear-gradient(to bottom, #000 95%, transparent 100%)' }}>
        <img src={assetUrl('assets/farm/bg.webp')} alt="" className="absolute inset-0 h-full w-full" draggable={false} />

        {/* 노점: 눌러서 주민의 부탁·바구니 팔기 */}
        <button aria-label={ko ? '노점' : 'Market stall'} className="absolute rounded-2xl" style={{ left: '76%', top: '27%', width: '24%', height: '22%' }} onClick={() => setStall(true)}>
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold shadow">{ko ? '주문' : 'Orders'} · {farm.inventory[order.id]}/2</span>
        </button>

        {/* 밭 9칸 */}
        {ROW_Y.map((y, r) => [0, 1, 2].map((c) => {
          const x = FIRST_X + SHEAR * (2 - r) + c * PITCH
          const i = r * 3 + c
          const plot = farm.plots[i]
          const progress = growth(plot, now)
          const ready = progress === 1
          const crop = plot ? CROPS.find((cr) => cr.id === plot.crop)! : null
          const wet = !!plot && plot.wateredAt !== null && !ready
          const label = !plot ? (ko ? `${i + 1}번 밭 심기` : `Plant in plot ${i + 1}`) : plot.wateredAt === null ? (ko ? `${i + 1}번 밭 물 주기` : `Water plot ${i + 1}`) : ready ? (ko ? `${i + 1}번 밭 수확하기` : `Harvest plot ${i + 1}`) : (ko ? `${i + 1}번 밭 자라는 중` : `Plot ${i + 1} growing`)
          return (
            <div key={i} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%`, width: `${TILE_W}%`, height: `${TILE_H}%`, zIndex: 2 + r }}>
              <FarmImg name={wet ? 'plot_wet' : 'plot_dry'} emoji="🟫" className="absolute inset-0 h-full w-full" style={{ objectFit: 'fill' }} />
              {plot && crop && [{ x: 71, b: 40 }, { x: 29, b: 27 }].map((pos) => (
                <FarmImg key={pos.x} name={`${crop.id}_${stageOf(plot.wateredAt, progress)}`} emoji={ready ? crop.emoji : plot.wateredAt === null ? '🌰' : progress < 0.4 ? '🌱' : '🌿'} className="absolute -translate-x-1/2" style={{ left: `${pos.x}%`, bottom: `${pos.b}%`, width: `${CROP_BOX[crop.id][0] / 500 * 36}%`, aspectRatio: `${CROP_BOX[crop.id][0]} / ${CROP_BOX[crop.id][1]}`, objectFit: 'contain', objectPosition: 'bottom' }} />
              ))}
              {plot && (plot.wateredAt === null || ready) && (
                <span aria-hidden className={`absolute left-1/2 -translate-x-1/2 text-lg leading-none drop-shadow ${ready ? 'animate-bounce' : ''}`} style={{ bottom: '8%' }}>{ready ? '✨' : '💧'}</span>
              )}
              <button aria-label={label} className="pointer-events-auto absolute inset-0" style={{ clipPath: 'polygon(20.3% 0, 100% 0, 83.1% 100%, 0 100%)' }} onClick={() => tapPlot(i)} />
            </div>
          )
        }))}

        {/* 내 아바타: 밭 옆까지 걸어가서 직접 물 주고 수확한다 */}
        <div aria-hidden className="pointer-events-none absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${AVATAR_W}%`, aspectRatio: '1024 / 1536', zIndex: pos.z, transition: 'left 0.8s ease-in-out, top 0.8s ease-in-out' }}>
          <div className={walking ? 'farm-walk' : ''} style={{ width: '100%', height: '100%', position: 'relative' }}>
            <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
            {hold === 'can' ? (
              <img src={assetUrl('assets/farm/can.webp')} alt="" draggable={false} className="absolute" style={{ left: '66%', top: '50%', width: '34%', transformOrigin: '15% 60%', transform: watering ? 'rotate(32deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }} />
            ) : (
              <img src={assetUrl('assets/farm/icon_basket.webp')} alt="" draggable={false} className="absolute" style={{ left: '62%', top: '44%', width: '42%' }} />
            )}
            {watering && <span className="absolute text-sm" style={{ left: '98%', top: '58%' }}>💧</span>}
          </div>
        </div>

        {/* 위쪽: 코인, 지도 */}
        <div className="absolute flex items-center gap-1" style={{ right: '2.5%', top: '1.8%', zIndex: 5 }}>
          <span className={PILL}><PillText>🪙 {farm.coins}</PillText></span>
          <button className={PILL} onClick={onExit}><PillText>🗺️ {ko ? '지도' : 'Map'}</PillText></button>
        </div>
        {notice && <p role="status" className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-center text-xs font-bold shadow-md" style={{ top: '14%', maxWidth: '90%', zIndex: 6 }}>{notice}</p>}
      </div>

      {/* 아래 도구 4개: 그림 아래 초록 바탕에 둔다 */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center px-3 py-3" style={{ zIndex: 5, height: 'max(calc(100cqh - min(150cqw, 100cqh)), 8rem)' }}>
        <div className="flex w-full max-w-[560px] flex-col gap-3">
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
          <div className="flex gap-2">
            {tools.map((t) => {
              const active = tool === t.id
              return (
                <button key={t.id} aria-pressed={t.id === 'decorate' ? undefined : active} className={`flex flex-1 flex-col items-center rounded-3xl border-2 px-1 pt-2 pb-2.5 shadow-md ${active ? 'border-blush bg-[#fff1cc]' : 'border-[#e5cfa3] bg-[#fdf2d8]/95'}`} onClick={() => (t.id === 'decorate' ? setShop(true) : pick(t.id))}>
                  <FarmImg name={t.icon} emoji={t.emoji} className="aspect-square w-[85%] object-contain" />
                  <span className="text-sm font-extrabold text-[#6b4a2b]">{t[lang]}</span>
                </button>
              )
            })}
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
      {shop && <ShopModal onClose={() => setShop(false)} onWear={onWear} />}
    </section>
  )
}
