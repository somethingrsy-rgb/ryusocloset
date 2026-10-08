import { useState, type RefObject } from 'react'
import { useI18n } from '../i18n'
import { partsOf, type Assembly, type Slot } from '../lib/assemble'
import { assetUrl } from '../lib/items'
import { DragGhost, useThumbDrag } from './useThumbDrag'

interface Props {
  assembly: Assembly
  /** 탭하면 입고/벗기, 끌어다 놓으면 입히기 */
  onPick: (slot: Slot, id: string) => void
  onDragWear: (slot: Slot, id: string) => void
  dropRef: RefObject<HTMLElement | null>
  onDragOver: (over: boolean) => void
}

export function AssembleTray({ assembly, onPick, onDragWear, dropRef, onDragOver }: Props) {
  const { lang, t } = useI18n()
  const [slot, setSlot] = useState<Slot>('top')
  const { press, ghost, ignoreClick } = useThumbDrag(dropRef, onDragOver)
  const tabs: { id: Slot; icon: string; label: string }[] = [
    { id: 'head', icon: '💇', label: t('partHead') },
    { id: 'top', icon: '👚', label: t('partTop') },
    { id: 'bottom', icon: '👖', label: t('partBottom') },
    { id: 'shoes', icon: '👟', label: t('partShoes') },
  ]
  const parts = partsOf(slot)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex shrink-0 gap-1 px-2 pt-2 pb-1">
        {tabs.map((tb) => {
          const active = tb.id === slot
          return (
            <button
              key={tb.id}
              role="tab"
              aria-selected={active}
              onClick={() => setSlot(tb.id)}
              className={`relative flex min-h-14 flex-1 flex-col items-center justify-center rounded-2xl px-1 text-2xl transition ${
                active ? 'bg-blush text-white shadow' : 'bg-petal/70 hover:bg-petal'
              }`}
            >
              <span aria-hidden>{tb.icon}</span>
              <span className={`text-[10px] leading-tight font-semibold ${active ? 'text-white' : 'text-cocoa-soft'}`}>{tb.label}</span>
              {assembly[tb.id] && (
                <span aria-hidden className={`absolute top-1 right-1 h-2 w-2 rounded-full ${active ? 'bg-white' : 'bg-blush'}`} />
              )}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {slot === 'top' && <p className="mb-2 px-1 text-[11px] font-semibold text-cocoa-soft">{t('assembleTopHint')}</p>}
        {slot === 'shoes' && <p className="mb-2 px-1 text-[11px] font-semibold text-cocoa-soft">{t('assembleShoesHint')}</p>}
        {slot === 'bottom' && <p className="mb-2 px-1 text-[11px] font-semibold text-cocoa-soft">{t('assembleBottomHint')}</p>}
        {parts.length === 0 ? (
          <p className="py-8 text-center text-sm font-semibold text-cocoa-soft">{t('noBottoms')}</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2">
            {parts.map((c) => {
              const worn = assembly[slot] === c.id
              return (
                <li key={c.id}>
                  <button
                    onPointerDown={(e) => press(e, c.thumb, () => onDragWear(slot, c.id))}
                    onClick={() => !ignoreClick() && onPick(slot, c.id)}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-pressed={worn}
                    aria-label={c.name[lang]}
                    title={c.name[lang]}
                    className={`relative flex aspect-square w-full select-none items-center justify-center rounded-2xl bg-white p-1 ring-2 transition active:scale-95 [-webkit-touch-callout:none] ${
                      worn ? 'ring-blush shadow-md' : 'ring-petal hover:ring-blush/50'
                    }`}
                  >
                    <img src={assetUrl(c.thumb)} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain" />
                    {c.colorHex && (
                      <span aria-hidden className="absolute bottom-1 left-1 h-3 w-3 rounded-full ring-1 ring-black/15" style={{ background: c.colorHex }} />
                    )}
                    {worn && (
                      <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blush text-[11px] font-bold text-white">
                        ✓
                      </span>
                    )}
                  </button>
                  <p className="mt-0.5 truncate text-center text-[10px] font-semibold text-cocoa-soft">{c.name[lang]}</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <DragGhost ghost={ghost} src={assetUrl} />
    </div>
  )
}
