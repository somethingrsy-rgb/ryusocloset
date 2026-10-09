import type { RefObject } from 'react'
import { CATEGORIES, type Category } from '../lib/layers'
import { CATEGORY_LABEL, useI18n } from '../i18n'
import { ITEMS_BY_CATEGORY, assetUrl, isCustomItem } from '../lib/items'
import { hiddenCount, visible } from '../lib/hidden'
import { useItemsVersion } from '../lib/useItemsVersion'
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
  /** '내 옷 추가' 버튼 */
  onAdd: () => void
  /** 옷 삭제 (내가 추가한 옷은 진짜 삭제, 기본 옷은 목록에서 숨김) */
  onRemove: (item: Item) => void
  /** 이 카테고리에서 숨긴 옷 되돌리기 */
  onRestore: (items: Item[]) => void
}

export function Closet({ category, onCategory, outfit, onToggle, onDragWear, dropRef, onDragOver, onAdd, onRemove, onRestore }: Props) {
  useItemsVersion()
  const { lang, t } = useI18n()
  const labels = CATEGORY_LABEL[lang]
  const all = ITEMS_BY_CATEGORY[category]
  const items = visible(all)
  const nHidden = hiddenCount(all.map((i) => i.id))
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
          <li>
            <button
              onClick={onAdd}
              aria-label={t('addItem')}
              title={t('addItem')}
              className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl bg-petal/60 text-blush-deep ring-2 ring-dashed ring-blush/60 transition active:scale-95"
            >
              <span aria-hidden className="text-3xl leading-none font-bold">+</span>
              <span className="mt-0.5 text-[10px] leading-tight font-semibold">{t('addItem')}</span>
            </button>
          </li>
          {items.map((it) => {
            const worn = outfit[it.category] === it.id
            const name = it.name[lang]
            const color = it.colorName?.[lang]
            return (
              <li key={it.id} className="relative">
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
                {(
                  <button
                    aria-label={`${t('removeItem')}: ${name}`}
                    title={t('removeItem')}
                    onClick={() => window.confirm(t(isCustomItem(it) ? 'removeItemConfirm' : 'hideItemConfirm')) && onRemove(it)}
                    className="absolute -top-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs text-cocoa-soft shadow ring-1 ring-black/10"
                  >
                    ✕
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {nHidden > 0 && (
          <button
            onClick={() => onRestore(all)}
            className="mt-3 min-h-11 w-full rounded-full bg-petal/70 px-4 text-sm font-semibold text-cocoa-soft"
          >
            ↩ {t('restoreHidden', { n: nHidden })}
          </button>
        )}
      </div>
      <DragGhost ghost={ghost} src={assetUrl} />
    </div>
  )
}
