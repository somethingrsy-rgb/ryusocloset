import { useRef, useState, type PointerEvent, type RefObject } from 'react'
import { CATEGORIES, type Category } from '../lib/layers'
import { CATEGORY_LABEL, useI18n } from '../i18n'
import { ITEMS_BY_CATEGORY, assetUrl } from '../lib/items'
import type { Item, Outfit } from '../lib/types'

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

const LONG_PRESS_MS = 220 // 터치: 이만큼 꾹 누르면 끌기 시작 (그 전에 움직이면 목록 스크롤)
const TOUCH_SLOP = 8
const MOUSE_SLOP = 5

const inside = (el: HTMLElement | null, x: number, y: number) => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

export function Closet({ category, onCategory, outfit, onToggle, onDragWear, dropRef, onDragOver }: Props) {
  const { lang, t } = useI18n()
  const [ghost, setGhost] = useState<{ item: Item; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const latest = useRef({ onDragWear, onDragOver })
  latest.current = { onDragWear, onDragOver }

  /**
   * 썸네일 드래그 앤 드롭 (터치·마우스 공용).
   * 터치는 목록 스크롤과 겹치므로 꾹 눌러야 끌기가 시작되고, 마우스는 조금만 움직여도 시작된다.
   * 짧게 누르면 기존처럼 탭(착용/해제)으로 동작한다.
   */
  const startPress = (e: PointerEvent<HTMLButtonElement>, item: Item) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const id = e.pointerId
    const touch = e.pointerType !== 'mouse'
    const sx = e.clientX
    const sy = e.clientY
    let active = false
    let timer: number | undefined

    const preventScroll = (ev: TouchEvent) => ev.cancelable && ev.preventDefault()
    const cleanup = () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('touchmove', preventScroll)
    }
    const begin = () => {
      active = true
      setGhost({ item, x: sx, y: sy })
      window.addEventListener('touchmove', preventScroll, { passive: false })
      navigator.vibrate?.(10)
    }
    const move = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== id) return
      if (!active) {
        const d = Math.hypot(ev.clientX - sx, ev.clientY - sy)
        if (touch) {
          if (d > TOUCH_SLOP) cleanup() // 스크롤 중
        } else if (d > MOUSE_SLOP) begin()
        return
      }
      setGhost({ item, x: ev.clientX, y: ev.clientY })
      latest.current.onDragOver(inside(dropRef.current, ev.clientX, ev.clientY))
    }
    const finish = (ev: globalThis.PointerEvent, drop: boolean) => {
      if (ev.pointerId !== id) return
      const wasActive = active
      cleanup()
      if (!wasActive) return
      suppressClick.current = true // 끌고 난 뒤에 따라오는 click 은 무시
      window.setTimeout(() => (suppressClick.current = false), 0)
      setGhost(null)
      latest.current.onDragOver(false)
      if (drop && inside(dropRef.current, ev.clientX, ev.clientY)) latest.current.onDragWear(item)
    }
    const up = (ev: globalThis.PointerEvent) => finish(ev, true)
    const cancel = (ev: globalThis.PointerEvent) => finish(ev, false)

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    if (touch) timer = window.setTimeout(begin, LONG_PRESS_MS)
  }

  const labels = CATEGORY_LABEL[lang]
  const items = ITEMS_BY_CATEGORY[category]
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
                  onPointerDown={(e) => startPress(e, it)}
                  onClick={() => !suppressClick.current && onToggle(it)}
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
      {ghost && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[70] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/85 p-1 shadow-2xl ring-2 ring-blush"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <img src={assetUrl(ghost.item.thumb)} alt="" draggable={false} className="h-full w-full object-contain" />
        </div>
      )}
    </div>
  )
}
