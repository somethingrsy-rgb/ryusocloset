import type { RefObject } from 'react'
import { CATEGORIES, type Category } from '../lib/layers'
import { CATEGORY_LABEL, useI18n } from '../i18n'
import { ITEMS_BY_CATEGORY, assetUrl } from '../lib/items'
import type { Item, Outfit } from '../lib/types'
import { DragGhost, useThumbDrag } from './useThumbDrag'

export const CATEGORY_ICON: Record<Category, string> = {
  top: '👚',
  bottom: '👖',
  dress: '👗',
  outer: '🧥',
  shoes: '👟',
  accessory: '🎀',
  bag: '👜',
}

interface Props {
  category: Category
  onCategory: (c: Category) => void
  outfit: Outfit
  onToggle: (item: Item) => void
  /** 옷을 무대에 끌어다 놓았을 때 (입히기) */
  onDragWear: (item: Item) => void
  /** 끌어다 놓을 수 있는 영역 (무대) */
  dropRef: RefObject<HTMLElement | null>
  /** 끌고 있는 옷이 무대 위에 있는지 알린다 */
  onDragOver: (over: boolean) => void
}

export function Closet({ category, onCategory, outfit, onToggle, onDragWear, dropRef, onDragOver }: Props) {
  const { lang, t } = useI18n()
  const labels = CATEGORY_LABEL[lang]
  const items = ITEMS_BY_CATEGORY[category]
  const { press, ghost, ignoreClick } = useThumbDrag(dropRef, onDragOver)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label="categories" className="scroll-thin flex shrink-0 gap-1 overflow-x-auto px-2 pt-2 pb-1">
        {CATEGORIES.map((c) => {
          const active = c === category
          return (
            <button
              key={c}
              role="tab"
              aria-selected={active}
              aria-label={labels[c]}
              title={labels[c]}
              onClick={() => onCategory(c)}
              className={`relative flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center rounded-2xl px-1 text-2xl transition ${
                active ? 'bg-blush text-white shadow' : 'bg-petal/70 hover:bg-petal'
              }`}
            >
              <span aria-hidden>{CATEGORY_ICON[c]}</span>
              <span className={`text-[9.5px] leading-tight font-semibold whitespace-nowrap ${active ? 'text-white' : 'text-cocoa-soft'}`}>
                {labels[c]}
              </span>
              {outfit[c] && (
                <span
                  aria-hidden
                  className={`absolute top-1 right-1 h-2 w-2 rounded-full ${active ? 'bg-white' : 'bg-blush'}`}
                />
              )}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <ul className="grid grid-cols-4 gap-2 md:grid-cols-4">
          {items.map((it) => {
            const worn = outfit[it.category] === it.id
            const name = it.name[lang]
            const color = it.colorName?.[lang]
            return (
              <li key={it.id}>
                <button
                  onPointerDown={(e) => press(e, it.thumb, () => onDragWear(it))}
                  onClick={() => !ignoreClick() && onToggle(it)}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-pressed={worn}
                  aria-label={color ? `${name} ${color}` : name}
                  title={color ? `${name} · ${color}` : name}
                  className={`group relative flex aspect-square w-full select-none items-center justify-center rounded-2xl bg-white p-1 ring-2 transition active:scale-95 [-webkit-touch-callout:none] ${
                    worn ? 'ring-blush shadow-md' : 'ring-petal hover:ring-blush/50'
                  }`}
                >
                  <img
                    src={assetUrl(it.thumb)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                  {it.colorHex && (
                    <span
                      aria-hidden
                      className="absolute bottom-1 left-1 h-3 w-3 rounded-full ring-1 ring-black/15"
                      style={{ background: it.colorHex }}
                    />
                  )}
                  {worn && (
                    <span
                      aria-label={t('worn')}
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blush text-[11px] font-bold text-white"
                    >
                      ✓
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <DragGhost ghost={ghost} src={assetUrl} />
    </div>
  )
}
