import { useEffect, useRef, type KeyboardEvent } from 'react'

const DIRECTIONS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0],
  ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1],
}

/** Keyboard movement belongs to the focused game, never to the rest of the app. */
export function useWalkKeys(move: (x: number, y: number) => void, stop: () => void, enabled = true) {
  const latest = useRef({ move, stop, enabled })
  latest.current = { move, stop, enabled }
  const keys = useRef(new Set<string>())
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const release = () => {
    keys.current.clear()
    if (timer.current !== null) clearInterval(timer.current)
    timer.current = null
    latest.current.stop()
  }
  const advance = () => {
    if (!latest.current.enabled) { release(); return }
    let x = 0, y = 0
    for (const key of keys.current) {
      const d = DIRECTIONS[key]
      x += d[0]; y += d[1]
    }
    const length = Math.hypot(x, y)
    if (length) latest.current.move(x / length, y / length)
    else latest.current.stop()
  }
  useEffect(() => {
    const onHidden = () => { if (document.hidden) release() }
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      if (timer.current !== null) clearInterval(timer.current)
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [])
  useEffect(() => { if (!enabled) release() }, [enabled])
  return {
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (!DIRECTIONS[key] || !latest.current.enabled || e.altKey || e.ctrlKey || e.metaKey) return
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      if (keys.current.has(key)) return
      keys.current.add(key)
      advance()
      if (timer.current === null) timer.current = setInterval(advance, 80)
    },
    onKeyUp: (e: KeyboardEvent<HTMLDivElement>) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (!DIRECTIONS[key]) return
      e.preventDefault()
      keys.current.delete(key)
      if (keys.current.size) advance()
      else release()
    },
    onBlur: release,
  }
}
