import { useRef, useState, type PointerEvent, type RefObject } from 'react'

const LONG_PRESS_MS = 220 // 터치: 이만큼 꾹 누르면 끌기 시작 (그 전에 움직이면 목록 스크롤)
const TOUCH_SLOP = 8
const MOUSE_SLOP = 5

const inside = (el: HTMLElement | null, x: number, y: number) => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}

/**
 * 썸네일 드래그 앤 드롭 (터치·마우스 공용). 코디 탭과 조립 탭이 함께 쓴다.
 * 터치는 목록 스크롤과 겹치므로 꾹 눌러야 끌기가 시작되고, 마우스는 조금만 움직여도 시작된다.
 * 짧게 누르면 기존처럼 탭(onClick)으로 동작한다.
 *
 * 사용: <button onPointerDown={(e) => press(e, thumbUrl, () => 놓았을 때)} onClick={() => !ignoreClick() && ...} />
 */
export function useThumbDrag(dropRef: RefObject<HTMLElement | null>, onDragOver: (over: boolean) => void) {
  const [ghost, setGhost] = useState<{ thumb: string; x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const latest = useRef({ onDragOver })
  latest.current = { onDragOver }

  const press = (e: PointerEvent<HTMLElement>, thumb: string, onDrop: () => void) => {
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
      setGhost({ thumb, x: sx, y: sy })
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
      setGhost({ thumb, x: ev.clientX, y: ev.clientY })
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
      if (drop && inside(dropRef.current, ev.clientX, ev.clientY)) onDrop()
    }
    const up = (ev: globalThis.PointerEvent) => finish(ev, true)
    const cancel = (ev: globalThis.PointerEvent) => finish(ev, false)

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    if (touch) timer = window.setTimeout(begin, LONG_PRESS_MS)
  }

  return { press, ghost, ignoreClick: () => suppressClick.current }
}

/** 끌고 있는 썸네일 카드 (손가락을 따라다닌다) */
export function DragGhost({ ghost, src }: { ghost: { thumb: string; x: number; y: number } | null; src: (thumb: string) => string }) {
  if (!ghost) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[70] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/85 p-1 shadow-2xl ring-2 ring-blush"
      style={{ left: ghost.x, top: ghost.y }}
    >
      <img src={src(ghost.thumb)} alt="" draggable={false} className="h-full w-full object-contain" />
    </div>
  )
}
