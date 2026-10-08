import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { useI18n } from '../i18n'
import { bgToCss, type Background } from '../lib/backgrounds'
import { loadImage } from '../lib/exportPng'
import { ITEM_BY_ID, assetUrl } from '../lib/items'
import { CANVAS_H, CANVAS_W, type Category } from '../lib/layers'
import { wornItems } from '../lib/outfit'
import { maskCache, maskFromSource } from '../lib/roomHit'
import { getTweak, moveTweak, pickWorn, pivotOf, resetTweak, scaleTweak, setScaleTweak } from '../lib/tweaks'
import type { Outfit, Tweaks } from '../lib/types'
import { FigureLayers } from './FigureLayers'

interface Props {
  outfit: Outfit
  tweaks: Tweaks
  bg: Background
  selected: Category | null
  onSelect: (c: Category | null) => void
  onTweaks: (next: Tweaks) => void
  onTakeOff: (c: Category) => void
  /** 옷을 끌어다 놓을 수 있는 영역(바깥 상자) */
  dropRef: RefObject<HTMLDivElement | null>
  /** 드래그 중인 옷이 무대 위에 있을 때 */
  dropActive: boolean
  figureRef: RefObject<HTMLDivElement | null>
  children?: ReactNode
}

/** 마우스가 몇 px 넘게 움직여야 "끌기"로 보는지 (살짝 눌렀다 뗄 때 옷이 밀리지 않게) */
const DRAG_DEAD_ZONE = 6

/**
 * 코디 화면의 무대: 배경 위에 스티커 테두리가 있는 아바타.
 * 입은 옷을 눌러 선택하면 한 손가락으로 옮기고, 두 손가락(핀치)·마우스 휠·버튼으로 크기를 바꾼다.
 */
export function Stage({
  outfit,
  tweaks,
  bg,
  selected,
  onSelect,
  onTweaks,
  onTakeOff,
  dropRef,
  dropActive,
  figureRef,
  children,
}: Props) {
  const { lang, t } = useI18n()
  const areaRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ cat: Category; sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null)
  const pinch = useRef<{ dist: number; scale: number } | null>(null)
  /** 빈 곳을 눌렀을 때: 손을 뗄 때까지 선택 해제를 미룬다 (두 번째 손가락이 닿으면 핀치로 쓰려고) */
  const pendingDeselect = useRef(false)
  const missStart = useRef<{ x: number; y: number } | null>(null)
  // 이벤트 핸들러가 항상 최신 값을 보도록
  const live = useRef({ outfit, tweaks, selected })
  live.current = { outfit, tweaks, selected }

  // 옷 알파 마스크: 투명한 부분을 눌렀을 때 아래 옷이 선택되게
  useEffect(() => {
    for (const it of wornItems(outfit, ITEM_BY_ID)) {
      if (maskCache.has(it.id)) continue
      loadImage(assetUrl(it.image))
        .then((img) => maskCache.set(it.id, maskFromSource(img, img.naturalWidth, img.naturalHeight, 120)))
        .catch(() => undefined)
    }
  }, [outfit])

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const r = areaRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * CANVAS_W, y: ((e.clientY - r.top) / r.width) * CANVAS_W }
  }
  const perPx = () => CANVAS_W / areaRef.current!.getBoundingClientRect().width // 화면 1px = 캔버스 몇 px

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    areaRef.current?.focus({ preventScroll: true })
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const { outfit, tweaks, selected } = live.current
    if (pointers.current.size === 2 && selected) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: getTweak(tweaks, selected).scale }
      drag.current = null
      pendingDeselect.current = false
      return
    }
    if (pointers.current.size > 1) return
    const p = toCanvas(e)
    const hit = pickWorn(outfit, tweaks, ITEM_BY_ID, p.x, p.y, (id) => maskCache.get(id))
    pendingDeselect.current = !hit
    missStart.current = { x: e.clientX, y: e.clientY }
    if (hit) onSelect(hit)
    drag.current = hit ? { cat: hit, sx: e.clientX, sy: e.clientY, px: getTweak(tweaks, hit).dx, py: getTweak(tweaks, hit).dy, moved: false } : null
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const { tweaks, selected } = live.current
    if (pinch.current && selected && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      onTweaks(setScaleTweak(tweaks, selected, (pinch.current.scale * dist) / pinch.current.dist))
      return
    }
    const d = drag.current
    if (!d) {
      // 빈 곳에서 시작해 많이 끌었다면 탭이 아니므로 선택을 유지한다
      const m = missStart.current
      if (pendingDeselect.current && pointers.current.size === 1 && m && Math.hypot(e.clientX - m.x, e.clientY - m.y) > 8) {
        pendingDeselect.current = false
      }
      return
    }
    const dxPx = e.clientX - d.sx
    const dyPx = e.clientY - d.sy
    if (!d.moved && Math.hypot(dxPx, dyPx) < DRAG_DEAD_ZONE) return
    d.moved = true
    const k = perPx()
    const cur = getTweak(tweaks, d.cat)
    onTweaks(moveTweak(tweaks, d.cat, d.px + dxPx * k - cur.dx, d.py + dyPx * k - cur.dy))
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (e.type === 'pointerup' && pendingDeselect.current && pointers.current.size === 1) onSelect(null)
    if (pointers.current.size === 1) pendingDeselect.current = false
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!selected) return
    const step = e.shiftKey ? 40 : 10
    const move = (dx: number, dy: number) => {
      e.preventDefault()
      onTweaks(moveTweak(tweaks, selected, dx, dy))
    }
    switch (e.key) {
      case 'ArrowLeft': return move(-step, 0)
      case 'ArrowRight': return move(step, 0)
      case 'ArrowUp': return move(0, -step)
      case 'ArrowDown': return move(0, step)
      case '+': case '=': return onTweaks(scaleTweak(tweaks, selected, 1.08))
      case '-': case '_': return onTweaks(scaleTweak(tweaks, selected, 1 / 1.08))
      case '0': return onTweaks(resetTweak(tweaks, selected))
      case 'Escape': return onSelect(null)
      case 'Delete': case 'Backspace':
        e.preventDefault()
        return onTakeOff(selected)
    }
  }

  // 선택한 옷의 (조절이 반영된) 경계 상자 — 점선 테두리용
  const selId = selected ? outfit[selected] : undefined
  const selItem = selId ? ITEM_BY_ID[selId] : undefined
  let box: { l: number; t: number; w: number; h: number } | null = null
  if (selItem) {
    const tw = getTweak(tweaks, selItem.category)
    const p = pivotOf(selItem)
    box = {
      l: p.x + (selItem.box.x - p.x) * tw.scale + tw.dx,
      t: p.y + (selItem.box.y - p.y) * tw.scale + tw.dy,
      w: selItem.box.w * tw.scale,
      h: selItem.box.h * tw.scale,
    }
  }
  const selTweak = selected ? tweaks[selected] : undefined
  const hasClothes = Object.keys(outfit).length > 0
  const btn = 'flex h-10 min-w-10 items-center justify-center rounded-full text-base active:scale-90 disabled:opacity-40'

  return (
    <div
      ref={dropRef}
      className={`relative h-full w-full overflow-hidden rounded-3xl shadow-inner ring-1 transition ${
        dropActive ? 'ring-4 ring-blush-deep' : 'ring-black/5'
      }`}
      style={{ background: bgToCss(bg), containerType: 'size' }}
    >
      <div className="absolute inset-0 flex items-end justify-center pb-[3cqh]">
        <div
          ref={areaRef}
          tabIndex={0}
          role="application"
          aria-label={t('tweakAria')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onKeyDown}
          onWheel={(e) => selected && onTweaks(scaleTweak(tweaks, selected, Math.exp(-e.deltaY * 0.0015)))}
          className="relative touch-none outline-none focus-visible:ring-2 focus-visible:ring-blush-deep/70"
          style={{
            width: `min(calc(92cqh * ${CANVAS_W / CANVAS_H}), 92cqw)`,
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          }}
        >
          <div ref={figureRef} className="sticker absolute inset-0">
            <FigureLayers outfit={outfit} tweaks={tweaks} />
          </div>
          {box && (
            <div
              className="pointer-events-none absolute rounded-lg border-2 border-dashed border-blush-deep"
              style={{
                left: `${(box.l / CANVAS_W) * 100}%`,
                top: `${(box.t / CANVAS_H) * 100}%`,
                width: `${(box.w / CANVAS_W) * 100}%`,
                height: `${(box.h / CANVAS_H) * 100}%`,
                zIndex: 90,
              }}
            />
          )}
        </div>
      </div>

      {dropActive && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center">
          <span className="rounded-full bg-blush-deep px-4 py-2 text-sm font-bold text-white shadow-lg">{t('dropHere')}</span>
        </div>
      )}

      {children}

      <div className="pointer-events-none absolute top-2 left-2 z-20 max-w-[calc(100%-4.5rem)]">
        {selItem && selected ? (
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/95 p-1 pl-3 shadow-lg ring-1 ring-black/5">
            <span className="mr-0.5 max-w-[4.5rem] truncate text-xs font-bold">{selItem.name[lang]}</span>
            <button className={`${btn} bg-petal`} aria-label={t('smaller')} onClick={() => onTweaks(scaleTweak(tweaks, selected, 1 / 1.1))}>
              ➖
            </button>
            <button className={`${btn} bg-petal`} aria-label={t('bigger')} onClick={() => onTweaks(scaleTweak(tweaks, selected, 1.1))}>
              ➕
            </button>
            <button
              className={`${btn} bg-petal`}
              aria-label={t('tweakReset')}
              title={t('tweakReset')}
              disabled={!selTweak}
              onClick={() => onTweaks(resetTweak(tweaks, selected))}
            >
              ↺
            </button>
            <button className={`${btn} bg-blush text-white`} aria-label={t('takeOff')} title={t('takeOff')} onClick={() => onTakeOff(selected)}>
              ✕
            </button>
          </div>
        ) : (
          <p className="inline-block rounded-2xl bg-white/85 px-3 py-1.5 text-[11px] leading-tight font-semibold text-cocoa-soft shadow-sm">
            {hasClothes ? t('tweakHint') : t('dragHint')}
          </p>
        )}
      </div>
    </div>
  )
}
