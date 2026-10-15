import { useState, useSyncExternalStore } from 'react'
import { CATEGORY_LABEL, useI18n } from '../i18n'
import { gameVersion, isLocked, subscribeGame } from '../lib/game'
import { visible } from '../lib/hidden'
import { ITEMS_BY_CATEGORY, assetUrl } from '../lib/items'
import type { Category } from '../lib/layers'
import type { Item, Outfit, Tweaks } from '../lib/types'
import { useItemsVersion } from '../lib/useItemsVersion'
import { CATEGORY_ICON } from './Closet'
import { FigureLayers } from './FigureLayers'

const CATS = ['top', 'bottom', 'dress', 'outer', 'costume', 'shoes', 'accessory', 'wand', 'bag'] as const

/** 농장 화면 왼쪽: 큰 아바타와 간단한 옷장 (농장을 나가지 않고 옷을 갈아입는다) */
export function FarmWardrobe({ outfit, tweaks, onToggle }: { outfit: Outfit; tweaks: Tweaks; onToggle: (item: Item) => void }) {
  useItemsVersion()
  useSyncExternalStore(subscribeGame, gameVersion)
  const { lang } = useI18n()
  const labels = CATEGORY_LABEL[lang]
  const [cat, setCat] = useState<Category>('dress')
  const items = visible(ITEMS_BY_CATEGORY[cat]).filter((it) => !isLocked(it))
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div aria-hidden className="relative mx-auto shrink-0" style={{ width: 'min(100%, calc(42cqh * 2 / 3))', aspectRatio: '1024 / 1536' }}>
        <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
      </div>
      <div role="tablist" aria-label={lang === 'ko' ? '옷 종류' : 'Categories'} className="scroll-thin flex shrink-0 gap-1 overflow-x-auto pb-1">
        {CATS.map((c) => (
          <button key={c} role="tab" aria-selected={c === cat} aria-label={labels[c]} title={labels[c]} onClick={() => setCat(c)} className={`flex h-10 min-w-10 items-center justify-center rounded-xl text-xl ${c === cat ? 'bg-blush text-white shadow' : 'bg-white/70'}`}>
            <span aria-hidden>{CATEGORY_ICON[c]}</span>
          </button>
        ))}
      </div>
      <ul className="scroll-thin grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto pb-1">
        {items.map((it) => {
          const worn = outfit[it.category] === it.id
          const name = it.name[lang]
          return (
            <li key={it.id}>
              <button aria-pressed={worn} aria-label={name} title={name} onClick={() => onToggle(it)} className={`relative flex aspect-square w-full items-center justify-center rounded-xl bg-white p-1 ring-2 active:scale-95 ${worn ? 'ring-blush shadow-md' : 'ring-transparent'}`}>
                <img src={assetUrl(it.thumb)} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain" />
                {worn && <span aria-hidden className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blush text-[10px] font-bold text-white">✓</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
