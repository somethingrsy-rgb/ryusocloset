import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { subscribeFarm, getFarm } from '../lib/farm'
import { gameVersion, getGame, isFound, subscribeGame, travelPool } from '../lib/game'
import { assetUrl } from '../lib/items'
import { buyItem, priceOf, readWallet, type BuyResult, type Currency } from '../lib/shop'
import { useItemsVersion } from '../lib/useItemsVersion'
import { playSnap } from '../lib/sound'
import { FigureLayers } from './FigureLayers'
import type { Outfit, Tweaks } from '../lib/types'

const TABS = ['costume', 'accessory', 'wand', 'shoes', 'room'] as const
type Tab = (typeof TABS)[number]

const MSG: Record<string, Record<BuyResult, string>> = {
  ko: { bought: '샀어요! 🎉', owned: '이미 가지고 있어요', poor: '아직 모자라요. 별비나 농장에서 더 모아요', unknown: '없는 물건이에요', failed: '저장하지 못했어요. 저장 공간을 확인해주세요' },
  en: { bought: 'Bought! 🎉', owned: 'You already have it', poor: 'Not enough yet. Earn more at Stars or the Farm', unknown: 'Unknown item', failed: 'Could not save. Check storage' },
}

const SERIF = '"Nanum Myeongjo", "Noto Serif KR", AppleMyungjo, "Apple SD Gothic Neo", serif'
const TAB_LABEL: Record<string, { ko: string; en: string }> = {
  costume: { ko: '의상', en: 'Outfits' },
  accessory: { ko: '헤어 장식', en: 'Hair' },
  wand: { ko: '마법봉', en: 'Wands' },
  shoes: { ko: '신발', en: 'Shoes' },
  room: { ko: '소품', en: 'Props' },
}

/** 상점(달빛 옷장): 별비에서 모은 ⭐ 이나 농장에서 번 🪙 으로 아직 못 찾은 아이템을 산다. 입어보기로 내 아바타에 미리 입혀 본다 */
export function ShopModal({ onClose, onWear, outfit, tweaks }: { onClose: () => void; onWear: (id: string) => void; outfit?: Outfit; tweaks?: Tweaks }) {
  const { lang } = useI18n()
  const ko = lang === 'ko'
  useItemsVersion()
  useSyncExternalStore(subscribeFarm, getFarm)
  useSyncExternalStore(subscribeGame, gameVersion)
  const [spentTick, setSpentTick] = useState(0) // 별을 쓰면 다시 읽는다
  const [currency, setCurrency] = useState<Currency>('star')
  const [tab, setTab] = useState<Tab>('costume')
  const [msg, setMsg] = useState('')
  const [bought, setBought] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const wallet = useMemo(readWallet, [spentTick, getFarm().coins, getGame().found.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const pool = travelPool()
  const items = pool.filter((i) => i.category === tab)
  const sym = currency === 'star' ? '⭐' : '🪙'
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (preview ? setPreview(null) : onClose())
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, preview])

  const buy = (id: string) => {
    const r = buyItem(id, currency)
    setMsg(MSG[lang][r])
    if (r === 'bought') { playSnap(); setSpentTick((n) => n + 1); setBought(id) }
  }
  const boughtItem = bought ? pool.find((i) => i.id === bought) : undefined
  const previewItem = preview ? pool.find((i) => i.id === preview) : undefined
  const previewOutfit: Outfit | null = previewItem && outfit ? { ...outfit, [previewItem.category]: previewItem.id } : null
  const canPreview = !!outfit && tab !== 'room'

  return (
    <div className="absolute inset-0">
      <div role="dialog" aria-modal="true" aria-label={ko ? '상점' : 'Shop'} className="relative mx-auto flex h-full w-full max-w-lg flex-col overflow-hidden rounded-3xl shadow-lg ring-1 ring-black/5" style={{ background: `#fbf4ea url(${assetUrl('assets/farm/shop_paper.webp')}) center / cover`, color: '#4b3a2a' }}>
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <div className="flex items-center gap-2">
            <img src={assetUrl('assets/farm/shop_moon.webp')} alt="" draggable={false} className="h-16 w-16 object-contain" />
            <div>
              <h2 className="m-0 text-2xl leading-tight font-bold whitespace-nowrap" style={{ fontFamily: SERIF }}>{ko ? '달빛 옷장' : 'Moonlight Closet'}</h2>
              <p className="m-0 text-[11px]" style={{ color: '#8b7355' }}>{ko ? '숲속의 작은 편집숍' : 'A little shop in the woods'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-2 rounded-full border border-[#e3d3b3] bg-white/60 px-3 py-1.5 text-sm font-bold whitespace-nowrap"><span>⭐ {wallet.stars}</span><span>🪙 {wallet.coins}</span></div>
            <button onClick={onClose} aria-label={ko ? '닫기' : 'Close'} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d9c7a3] bg-white/60 text-lg">✕</button>
          </div>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="relative mt-2 overflow-hidden rounded-xl border border-[#e3d3b3]" style={{ aspectRatio: '1983 / 793' }}>
            <img src={assetUrl('assets/farm/shop_banner.webp')} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute top-1/2 left-[5%] -translate-y-1/2" style={{ fontFamily: SERIF, color: '#4a4220' }}>
              <p className="m-0 text-[clamp(1.1rem,5.6vw,1.8rem)] whitespace-nowrap leading-tight font-bold">{ko ? '숲속 티타임' : 'Forest Tea Time'}</p>
              <p aria-hidden className="m-0 text-xs" style={{ color: '#a58f56' }}>— ❦ —</p>
              <p className="m-0 mt-1 text-[11px] leading-snug" style={{ color: '#6b5a3a' }}>{ko ? '꽃향기가 머무는 시간,' : 'A time that smells of flowers,'}<br />{ko ? '특별한 하루를 입어요.' : 'dress for a special day.'}</p>
            </div>
          </div>

          <div role="radiogroup" aria-label={ko ? '내는 방법' : 'Pay with'} className="mt-3 flex items-center gap-1.5">
            {(['star', 'coin'] as const).map((c) => (
              <button key={c} role="radio" aria-checked={currency === c} onClick={() => setCurrency(c)} className={`min-h-9 rounded-full border px-3 text-sm font-bold ${currency === c ? 'border-[#d36f8b] bg-[#f4a9bb] text-white' : 'border-[#e3d3b3] bg-white/60'}`}>
                {c === 'star' ? '⭐' : '🪙'} {ko ? (c === 'star' ? '별로 사기' : '코인으로 사기') : c === 'star' ? 'Pay stars' : 'Pay coins'}
              </button>
            ))}
          </div>

          <div role="tablist" className="mt-2 flex border-b border-[#dccbaa]">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`relative min-h-11 flex-1 text-sm font-bold ${tab === t ? 'text-[#c0517a]' : 'text-[#5d4a35]'}`} style={{ fontFamily: SERIF }}>
                {TAB_LABEL[t][lang]}
                {tab === t && <span aria-hidden className="absolute inset-x-1 -bottom-px h-0.5 rounded bg-[#d36f8b]" />}
              </button>
            ))}
          </div>

          <p role="status" className="my-1 min-h-5 text-sm font-bold">{msg}</p>
          {boughtItem && (
            <div className="mb-2 flex items-center gap-2 rounded-2xl border border-[#cfe3b8] bg-[#eef6df] p-2">
              <img src={assetUrl(boughtItem.thumb)} alt="" className="h-12 w-12 object-contain" />
              <span className="flex-1 text-sm font-bold">{boughtItem.name[lang]}</span>
              <button className="min-h-10 rounded-full bg-[#e98aa3] px-4 text-sm font-bold text-white" onClick={() => { onClose(); onWear(boughtItem.id) }}>{boughtItem.kind === 'room' ? (ko ? '내 방에서 꾸미기' : 'Decorate') : ko ? '입어보기' : 'Try on'}</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-3 gap-y-4 pt-2 pb-4">
            {items.map((it, idx) => {
              const own = isFound(it.id)
              const price = priceOf(it.category)
              const poor = (currency === 'star' ? wallet.stars : wallet.coins) < price
              return (
                <div key={it.id} className="flex flex-col items-center">
                  <div className="relative flex aspect-square w-full items-end justify-center">
                    <img src={assetUrl(`assets/farm/shop_shelf_${(idx % 3) + 1}.webp`)} alt="" draggable={false} className="absolute inset-x-0 bottom-0 w-full" />
                    <img src={assetUrl(it.thumb)} alt="" className="relative z-10 mb-[7%] max-h-[92%] w-[78%] object-contain" draggable={false} />
                  </div>
                  <p className="mt-1 mb-0 w-full truncate text-center text-sm font-bold" style={{ fontFamily: SERIF }}>{it.name[lang]}</p>
                  <div className="mt-1 flex w-full items-center justify-between gap-1">
                    <button disabled={own || poor} onClick={() => buy(it.id)} className="min-h-9 rounded-full bg-transparent px-1 text-base font-bold disabled:opacity-60" aria-label={own ? (ko ? '보유' : 'Owned') : `${price}${sym}`}>
                      {own ? (ko ? '보유 ✓' : 'Owned ✓') : `${price} ${sym}`}
                    </button>
                    {canPreview && <button onClick={() => setPreview(it.id)} className="min-h-9 rounded-full bg-[#e98aa3] px-3 text-xs font-bold text-white shadow">👗 {ko ? '입어보기' : 'Try on'}</button>}
                  </div>
                </div>
              )
            })}
            {!items.length && <p className="col-span-2 text-sm">{ko ? '이 칸에는 아직 물건이 없어요.' : 'Nothing here yet.'}</p>}
          </div>
          <p className="mt-0 mb-1 text-center text-xs" style={{ color: '#8b7355' }}>🌿 {ko ? '별은 별비 산책에서, 코인은 농장에서 모아요' : 'Earn stars on the Star walk, coins on the Farm'} 🌿</p>
        </div>

        {previewItem && previewOutfit && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-between bg-[#fbf3e4] p-4" onClick={() => setPreview(null)}>
            <p className="m-0 text-lg font-bold" style={{ fontFamily: SERIF }}>{previewItem.name[lang]}</p>
            <div className="relative" style={{ height: 'min(62dvh, 560px)', aspectRatio: '1024 / 1536' }}>
              <FigureLayers outfit={previewOutfit} tweaks={tweaks} animate={false} />
            </div>
            <div className="flex w-full max-w-xs gap-2" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setPreview(null)} className="min-h-11 flex-1 rounded-full border border-[#d9c7a3] bg-white/70 text-sm font-bold">{ko ? '닫기' : 'Close'}</button>
              {!isFound(previewItem.id) && (
                <button disabled={(currency === 'star' ? wallet.stars : wallet.coins) < priceOf(previewItem.category)} onClick={() => { buy(previewItem.id); setPreview(null) }} className="min-h-11 flex-1 rounded-full bg-[#e98aa3] text-sm font-bold text-white disabled:opacity-50">{priceOf(previewItem.category)} {sym} {ko ? '사기' : 'Buy'}</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
