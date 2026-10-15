import { useMemo, useState, useSyncExternalStore } from 'react'
import { CATEGORY_LABEL, useI18n } from '../i18n'
import { subscribeFarm, getFarm } from '../lib/farm'
import { gameVersion, getGame, isFound, subscribeGame, travelPool } from '../lib/game'
import { assetUrl } from '../lib/items'
import { buyItem, priceOf, readWallet, type BuyResult, type Currency } from '../lib/shop'
import { useItemsVersion } from '../lib/useItemsVersion'
import { playSnap } from '../lib/sound'
import { Modal } from './Modal'

const TABS = ['costume', 'accessory', 'wand', 'shoes', 'room'] as const
type Tab = (typeof TABS)[number]

const MSG: Record<string, Record<BuyResult, string>> = {
  ko: { bought: '샀어요! 🎉', owned: '이미 가지고 있어요', poor: '아직 모자라요. 별비나 농장에서 더 모아요', unknown: '없는 물건이에요', failed: '저장하지 못했어요. 저장 공간을 확인해주세요' },
  en: { bought: 'Bought! 🎉', owned: 'You already have it', poor: 'Not enough yet. Earn more at Stars or the Farm', unknown: 'Unknown item', failed: 'Could not save. Check storage' },
}

/** 상점: 별비에서 모은 ⭐ 이나 농장에서 번 🪙 으로 아직 못 찾은 아이템을 산다 */
export function ShopModal({ onClose, onWear }: { onClose: () => void; onWear: (id: string) => void }) {
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
  const wallet = useMemo(readWallet, [spentTick, getFarm().coins, getGame().found.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const pool = travelPool()
  const items = pool.filter((i) => i.category === tab)
  const sym = currency === 'star' ? '⭐' : '🪙'
  const btn = 'min-h-11 rounded-2xl px-3 py-2 text-sm font-bold'

  const buy = (id: string) => {
    const r = buyItem(id, currency)
    setMsg(MSG[lang][r])
    if (r === 'bought') { playSnap(); setSpentTick((n) => n + 1); setBought(id) }
  }
  const boughtItem = bought ? pool.find((i) => i.id === bought) : undefined

  return (
    <Modal title={`🛍 ${ko ? '상점' : 'Shop'}`} onClose={onClose}>
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-petal/60 p-2">
        <p className="m-0 text-sm font-bold">{ko ? '내 지갑' : 'My wallet'} · ⭐ {wallet.stars} · 🪙 {wallet.coins}</p>
        <div role="radiogroup" aria-label={ko ? '내는 방법' : 'Pay with'} className="flex gap-1">
          {(['star', 'coin'] as const).map((c) => (
            <button key={c} role="radio" aria-checked={currency === c} onClick={() => setCurrency(c)} className={`${btn} ${currency === c ? 'bg-blush text-white' : 'bg-white'}`}>
              {c === 'star' ? '⭐' : '🪙'} {ko ? (c === 'star' ? '별로' : '코인으로') : c === 'star' ? 'Stars' : 'Coins'}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 mb-1 text-xs text-cocoa-soft">{ko ? '별은 별비 산책에서, 코인은 농장에서 모아요. 산 아이템은 옷장에서 바로 쓸 수 있어요.' : 'Earn stars on the Star walk and coins on the Farm. Bought items are ready in your closet.'}</p>
      <div role="tablist" className="my-2 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`${btn} shrink-0 ${tab === t ? 'bg-blush text-white' : 'bg-petal'}`}>
            {t === 'room' ? (ko ? '테마 소품' : 'Props') : CATEGORY_LABEL[lang][t]}
          </button>
        ))}
      </div>
      <p role="status" className="my-1 min-h-5 text-sm font-bold">{msg}</p>
      {boughtItem && (
        <div className="mb-2 flex items-center gap-2 rounded-2xl bg-mint/30 p-2">
          <img src={assetUrl(boughtItem.thumb)} alt="" className="h-12 w-12 object-contain" />
          <span className="flex-1 text-sm font-bold">{boughtItem.name[lang]}</span>
          <button className={`${btn} bg-blush text-white`} onClick={() => { onClose(); onWear(boughtItem.id) }}>{boughtItem.kind === 'room' ? (ko ? '내 방에서 꾸미기' : 'Decorate') : ko ? '입어보기' : 'Try on'}</button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 overflow-y-auto pb-2" style={{ maxHeight: '46dvh' }}>
        {items.map((it) => {
          const own = isFound(it.id)
          const price = priceOf(it.category)
          const poor = (currency === 'star' ? wallet.stars : wallet.coins) < price
          return (
            <div key={it.id} className="flex flex-col items-center rounded-2xl bg-petal/50 p-1 text-center">
              <img src={assetUrl(it.thumb)} alt="" className="aspect-square w-full object-contain" draggable={false} style={own ? { opacity: 0.55 } : undefined} />
              <span className="w-full truncate text-[11px] font-bold">{it.name[lang]}</span>
              <button disabled={own || poor} onClick={() => buy(it.id)} className="mt-1 min-h-9 w-full rounded-xl bg-white text-xs font-bold disabled:opacity-50">
                {own ? (ko ? '보유 ✓' : 'Owned ✓') : `${price}${sym}`}
              </button>
            </div>
          )
        })}
        {!items.length && <p className="col-span-3 text-sm">{ko ? '이 칸에는 아직 물건이 없어요.' : 'Nothing here yet.'}</p>}
      </div>
    </Modal>
  )
}
