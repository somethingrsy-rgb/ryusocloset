import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { loadImage, renderFigure } from '../lib/exportPng'
import { assetUrl } from '../lib/items'
import {
  ROOM_ITEMS,
  roomBackgrounds,
  ROOM_ITEM_BY_ID,
  drawables,
  getPlacement,
  hasContactShadow,
  moveBy,
  moveTo,
  sameSelection,
  scaleBy,
  setScale,
  shadowWidthRatio,
  toggleFlip,
} from '../lib/room'
import { hitTest, maskCache, maskFromSource } from '../lib/roomHit'
import { CANVAS_H, CANVAS_W } from '../lib/layers'
import { FLOOR_H, ROOM_H, ROOM_W, type RoomState, type Selection } from '../lib/roomTypes'
import type { Outfit, Tweaks } from '../lib/types'
import { FigureLayers } from './FigureLayers'

interface Props {
  outfit: Outfit
  tweaks: Tweaks
  room: RoomState
  selection: Selection
  onSelect: (s: Selection) => void
  onChange: (next: RoomState) => void
  captureRef?: RefObject<HTMLDivElement | null>
  onCloset?: () => void
  children?: ReactNode
}

/** 논리 좌표(1086 기준) → 방 폭(cqw) 퍼센트 */
const cq = (v: number) => `${(v / ROOM_W) * 100}cqw`

export function RoomView({ outfit, tweaks, room, selection, onSelect, onChange, onCloset, captureRef, children }: Props) {
  const { lang, t } = useI18n()
  const roomRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ sel: NonNullable<Selection>; px: number; py: number; ox: number; oy: number } | null>(null)
  const pinch = useRef<{ dist: number; scale: number } | null>(null)
  const roomState = useRef(room)
  roomState.current = room
  const [, bump] = useState(0)

  // 마스크 준비: 방 아이템은 한 번, 아바타는 코디가 바뀔 때마다
  useEffect(() => {
    for (const d of ROOM_ITEMS) {
      if (maskCache.has(d.id)) continue
      loadImage(assetUrl(d.image))
        .then((img) => {
          maskCache.set(d.id, maskFromSource(img, img.naturalWidth, img.naturalHeight))
        })
        .catch(() => undefined)
    }
  }, [])
  useEffect(() => {
    let alive = true
    renderFigure(outfit, tweaks)
      .then((c) => {
        if (!alive) return
        maskCache.set('avatar', maskFromSource(c, c.width, c.height, 64))
        bump((n) => n + 1)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [outfit, tweaks])

  const list = drawables(room)
  const backdrops = roomBackgrounds(room)
  const selected = selection ? list.find((d) => sameSelection(d.sel, selection)) : undefined

  const toLogical = (e: { clientX: number; clientY: number }) => {
    const r = roomRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * ROOM_W, y: ((e.clientY - r.top) / r.width) * ROOM_W }
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    roomRef.current?.focus({ preventScroll: true })
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && selection?.kind === 'avatar') {
      const [a, b] = [...pointers.current.values()]
      const p = getPlacement(roomState.current, selection)
      if (p) pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: p.scale }
      drag.current = null
      return
    }
    if (pointers.current.size > 1) return
    const { x, y } = toLogical(e)
    const hit = hitTest(roomState.current, x, y, (k) => maskCache.get(k))
    onSelect(hit)
    if (hit) {
      if (hit.kind === 'item' && ['furniture_hanger', 'furniture_dresser', 'furniture_mirror_full'].includes(room.items.find(p => p.uid === hit.uid)?.itemId ?? '')) { onCloset?.(); return }
      const p = getPlacement(roomState.current, hit)!
      drag.current = { sel: hit, px: x, py: y, ox: p.x, oy: p.y }
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && selection && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
      onChange(setScale(roomState.current, selection, (pinch.current.scale * dist) / pinch.current.dist))
      return
    }
    const d = drag.current
    if (!d) return
    const { x, y } = toLogical(e)
    onChange(moveTo(roomState.current, d.sel, d.ox + (x - d.px), d.oy + (y - d.py)))
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!selection || selection.kind !== 'avatar') return
    const step = e.shiftKey ? 40 : 10
    const move = (dx: number, dy: number) => {
      e.preventDefault()
      onChange(moveBy(room, selection, dx, dy))
    }
    switch (e.key) {
      case 'ArrowLeft': return move(-step, 0)
      case 'ArrowRight': return move(step, 0)
      case 'ArrowUp': return move(0, -step)
      case 'ArrowDown': return move(0, step)
      case '+': case '=': return onChange(scaleBy(room, selection, 1.1))
      case '-': case '_': return onChange(scaleBy(room, selection, 1 / 1.1))
      case 'f': case 'F': return onChange(toggleFlip(room, selection))
      case 'Escape': return onSelect(null)

    }
  }

  const btn = 'flex h-10 min-w-10 items-center justify-center rounded-full text-base active:scale-90'
  const selName =
    selection?.kind === 'item'
      ? ROOM_ITEM_BY_ID[room.items.find((p) => p.uid === selection.uid)?.itemId ?? '']?.name[lang]
      : selection?.kind === 'avatar'
        ? t('roomAvatar')
        : undefined

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-3xl bg-petal shadow-inner ring-1 ring-black/5"
      style={{ containerType: 'size' }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          ref={node => { roomRef.current = node; if (captureRef) captureRef.current = node }}
          tabIndex={0}
          role="application"
          aria-label={t('roomAria')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onKeyDown}
          onWheel={(e) => selection?.kind === 'avatar' && onChange(scaleBy(room, selection, Math.exp(-e.deltaY * 0.0015)))}
          className="relative isolate touch-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blush-deep/70"
          style={{
            width: `min(100cqw, calc(100cqh * ${ROOM_W / ROOM_H}))`,
            aspectRatio: `${ROOM_W} / ${ROOM_H}`,
            containerType: 'inline-size',
          }}
        >
          <img
            src={assetUrl(backdrops.floor)}
            alt=""
            draggable={false}
            className="pointer-events-none absolute left-0 w-full select-none"
            style={{ top: cq(ROOM_H - FLOOR_H), height: cq(FLOOR_H), zIndex: 0 }}
          />
          <img
            src={assetUrl(backdrops.wall)}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
            style={{ zIndex: 1 }}
          />

          {list.map((d) => {
            const z = Math.round(d.z) + 10
            const flip = d.flip ? 'scaleX(-1)' : undefined
            return (
              <div key={d.sel.kind === 'item' ? d.sel.uid : 'avatar'}>
                {hasContactShadow(d.group) && (
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      left: cq(d.x - (d.w * shadowWidthRatio(d.group)) / 2),
                      top: cq(d.y - Math.max(10, d.w * shadowWidthRatio(d.group) * 0.045) * 1.35),
                      width: cq(d.w * shadowWidthRatio(d.group)),
                      height: cq(Math.max(10, d.w * shadowWidthRatio(d.group) * 0.045) * 2),
                      background: 'radial-gradient(closest-side, rgba(70,40,30,0.30), rgba(70,40,30,0))',
                      zIndex: z - 1,
                    }}
                  />
                )}
                {d.group === 'avatar' ? (
                  <div
                    className="pointer-events-none absolute select-none"
                    style={{
                      left: cq(d.left),
                      top: cq(d.top),
                      width: cq(d.w),
                      aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
                      transform: flip,
                      zIndex: z,
                    }}
                  >
                    <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
                  </div>
                ) : (
                  <img
                    src={assetUrl(d.src!)}
                    onError={e => { const img = e.currentTarget; if (!img.src.endsWith('placeholder.svg')) img.src = assetUrl('assets/room/placeholder.svg') }}
                    alt=""
                    draggable={false}
                    className="pointer-events-none absolute select-none"
                    style={{ left: cq(d.left), top: cq(d.top), width: cq(d.w), height: cq(d.h), transform: flip, zIndex: z }}
                  />
                )}
              </div>
            )
          })}

          {selected && (
            <div
              data-export-ignore="true" className="pointer-events-none absolute rounded-lg border-2 border-dashed border-blush-deep"
              style={{
                left: cq(selected.left),
                top: cq(selected.top),
                width: cq(selected.w),
                height: cq(selected.h),
                zIndex: 9000,
              }}
            />
          )}
        </div>
      </div>

      {children}

      <div className="pointer-events-none absolute top-2 left-2 z-20 max-w-[calc(100%-4.5rem)]">
        {selection?.kind === 'avatar' && selName ? (
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/95 p-1 pl-3 shadow-lg ring-1 ring-black/5">
            <span className="mr-0.5 max-w-[4.5rem] truncate text-xs font-bold">{selName}</span>
            <button className={`${btn} bg-petal`} aria-label={t('smaller')} onClick={() => onChange(scaleBy(room, selection, 1 / 1.12))}>
              ➖
            </button>
            <button className={`${btn} bg-petal`} aria-label={t('bigger')} onClick={() => onChange(scaleBy(room, selection, 1.12))}>
              ➕
            </button>
            <button className={`${btn} bg-petal`} aria-label={t('flip')} onClick={() => onChange(toggleFlip(room, selection))}>
              ↔
            </button>

          </div>
        ) : (
          <p className="inline-block rounded-2xl bg-white/85 px-3 py-1.5 text-[11px] leading-tight font-semibold text-cocoa-soft shadow-sm">
            {lang === 'ko' ? '물건은 아래에서 배치 · 아바타는 움직여 보세요' : 'Place items below · Move your avatar'}
          </p>
        )}
      </div>
    </div>
  )
}
