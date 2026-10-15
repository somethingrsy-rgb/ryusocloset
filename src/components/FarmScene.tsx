import { useEffect, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { actFarm, CROPS, getFarm, growth, orderCrop, subscribeFarm, type CropId, type FarmAction } from '../lib/farm'
import { assetUrl } from '../lib/items'
import type { Outfit, Tweaks } from '../lib/types'
import { FigureLayers } from './FigureLayers'
import { Modal } from './Modal'
import { PILL, PillText } from './pill'
import { ShopModal } from './ShopModal'

type Tool = 'seed' | 'water' | 'harvest'

/** 밭 9칸의 위치(배경 그림 기준 %). 아래 줄로 갈수록 크게 보이게 해서 배경의 원근과 맞춘다. */
const ROWS = [
  { y: 46.5, w: 24, xs: [30.5, 54, 77.5] },
  { y: 57.5, w: 26, xs: [29.5, 54, 78.5] },
  { y: 69, w: 28, xs: [28.5, 54, 79.5] },
]
const PLOT_ASPECT = 1431 / 667

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
    if (need === 'seed') apply({ type: 'plant', plot: i, crop: selected })
    else if (need === 'water') apply({ type: 'water', plot: i })
    else if (need === 'harvest') apply({ type: 'harvest', plot: i })
    else setNotice(ko ? '자라는 중이에요' : 'Still growing')
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
      <div className="absolute top-0 left-1/2 -translate-x-1/2 select-none" style={{ width: 'min(100cqw, calc(100cqh * 1024 / 1536))', aspectRatio: '1024 / 1536' }}>
        <img src={assetUrl('assets/farm/bg.webp')} alt="" className="absolute inset-0 h-full w-full" draggable={false} />

        {/* 노점: 눌러서 주민의 부탁·바구니 팔기 */}
        <button aria-label={ko ? '노점' : 'Market stall'} className="absolute rounded-2xl" style={{ left: '76%', top: '27%', width: '24%', height: '22%' }} onClick={() => setStall(true)}>
          <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold shadow">{ko ? '주문' : 'Orders'} · {farm.inventory[order.id]}/2</span>
        </button>

        {/* 내 아바타 */}
        <div aria-hidden className="pointer-events-none absolute" style={{ left: '0%', top: '53%', width: '22%', aspectRatio: '1024 / 1536', zIndex: 3 }}>
          <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
        </div>

        {/* 밭 9칸 */}
        {ROWS.map((row, r) => row.xs.map((x, c) => {
          const i = r * 3 + c
          const plot = farm.plots[i]
          const progress = growth(plot, now)
          const ready = progress === 1
          const crop = plot ? CROPS.find((cr) => cr.id === plot.crop)! : null
          const wet = !!plot && plot.wateredAt !== null && !ready
          const h = row.w / PLOT_ASPECT * (1024 / 1536)
          const label = !plot ? (ko ? `${i + 1}번 밭 심기` : `Plant in plot ${i + 1}`) : plot.wateredAt === null ? (ko ? `${i + 1}번 밭 물 주기` : `Water plot ${i + 1}`) : ready ? (ko ? `${i + 1}번 밭 수확하기` : `Harvest plot ${i + 1}`) : (ko ? `${i + 1}번 밭 자라는 중` : `Plot ${i + 1} growing`)
          return (
            <button key={i} aria-label={label} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${row.y}%`, width: `${row.w}%`, height: `${h}%`, zIndex: 2 }} onClick={() => tapPlot(i)}>
              <FarmImg name={wet ? 'plot_wet' : 'plot_dry'} emoji="🟫" className="absolute inset-0 h-full w-full" />
              {plot && crop && (
                <FarmImg name={`${crop.id}_${stageOf(plot.wateredAt, progress)}`} emoji={ready ? crop.emoji : plot.wateredAt === null ? '🌰' : progress < 0.4 ? '🌱' : '🌿'} className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '28%', width: '50%', aspectRatio: '1', objectFit: 'contain', objectPosition: 'bottom' }} />
              )}
              {plot && (
                <span aria-hidden className={`absolute left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-1.5 text-[10px] leading-4 font-bold shadow ${ready ? 'animate-bounce' : ''}`} style={{ bottom: '-3%' }}>
                  {ready ? (ko ? '수확!' : 'Ready!') : plot.wateredAt === null ? '💧' : `${Math.ceil((1 - progress) * crop!.seconds)}${ko ? '초' : 's'}`}
                </span>
              )}
            </button>
          )
        }))}

        {/* 위쪽: 코인, 지도 */}
        <div className="absolute flex items-center gap-1" style={{ right: '2.5%', top: '1.8%', zIndex: 5 }}>
          <span className={PILL}><PillText>🪙 {farm.coins}</PillText></span>
          <button className={PILL} onClick={onExit}><PillText>🗺️ {ko ? '지도' : 'Map'}</PillText></button>
        </div>
        {notice && <p role="status" className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-center text-xs font-bold shadow-md" style={{ top: '14%', maxWidth: '90%', zIndex: 6 }}>{notice}</p>}

        {/* 씨앗 고르기 */}
        {picker && (
          <div className="absolute flex justify-center gap-2 rounded-3xl bg-white/95 p-2 shadow-lg" style={{ left: '4%', right: '4%', bottom: '19.5%', zIndex: 6 }} role="radiogroup" aria-label={ko ? '씨앗 고르기' : 'Choose seeds'}>
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
        <div className="absolute flex gap-[2%]" style={{ left: '3%', right: '3%', bottom: '2.2%', zIndex: 5 }}>
          {tools.map((t) => {
            const active = tool === t.id
            return (
              <button key={t.id} aria-pressed={t.id === 'decorate' ? undefined : active} className={`flex flex-1 flex-col items-center rounded-3xl border-2 px-1 pt-1 pb-1.5 shadow-md ${active ? 'border-blush bg-[#fff1cc]' : 'border-[#e5cfa3] bg-[#fdf2d8]/95'}`} onClick={() => (t.id === 'decorate' ? setShop(true) : pick(t.id))}>
                <FarmImg name={t.icon} emoji={t.emoji} className="aspect-square w-3/4 object-contain" />
                <span className="text-xs font-extrabold text-[#6b4a2b]">{t[lang]}</span>
              </button>
            )
          })}
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
