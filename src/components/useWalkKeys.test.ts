import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeyboardEvent } from 'react'
import { useWalkKeys } from './useWalkKeys'

const effects = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }))
vi.mock('react', () => ({
  useRef: (value: unknown) => ({ current: value }),
  useEffect: (effect: () => (() => void) | void) => {
    const cleanup = effect()
    if (cleanup) effects.cleanups.push(cleanup)
  },
}))

function key(key: string, editing = false) {
  return {
    key, preventDefault: vi.fn(),
    target: { closest: () => editing ? {} : null },
  } as unknown as KeyboardEvent<HTMLDivElement>
}

describe('focused game keyboard movement', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', new EventTarget())
    vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }))
  })
  afterEach(() => {
    effects.cleanups.splice(0).forEach((cleanup) => cleanup())
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })
  it('continues while held and stops immediately when released', () => {
    const move = vi.fn(), stop = vi.fn()
    const controls = useWalkKeys(move, stop)
    controls.onKeyDown(key('ArrowRight'))
    expect(move).toHaveBeenLastCalledWith(1, 0)
    vi.advanceTimersByTime(160)
    expect(move).toHaveBeenCalledTimes(3)
    controls.onKeyUp(key('ArrowRight'))
    vi.advanceTimersByTime(160)
    expect(move).toHaveBeenCalledTimes(3)
    expect(stop).toHaveBeenCalledTimes(1)
  })
  it('normalizes diagonals and resumes the remaining held direction', () => {
    const move = vi.fn()
    const controls = useWalkKeys(move, vi.fn())
    controls.onKeyDown(key('D'))
    controls.onKeyDown(key('w'))
    const [x, y] = move.mock.calls.at(-1)!
    expect(Math.hypot(x, y)).toBeCloseTo(1)
    expect(x).toBeGreaterThan(0)
    expect(y).toBeLessThan(0)
    controls.onKeyUp(key('w'))
    expect(move).toHaveBeenLastCalledWith(1, 0)
  })
  it('stops held movement when the window loses focus', () => {
    const move = vi.fn(), stop = vi.fn()
    const controls = useWalkKeys(move, stop)
    controls.onKeyDown(key('a'))
    window.dispatchEvent(new Event('blur'))
    vi.advanceTimersByTime(200)
    expect(move).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledTimes(1)
  })
  it('does not intercept text editing or movement behind a dialog', () => {
    const move = vi.fn()
    useWalkKeys(move, vi.fn()).onKeyDown(key('w', true))
    useWalkKeys(move, vi.fn(), false).onKeyDown(key('w'))
    vi.advanceTimersByTime(200)
    expect(move).not.toHaveBeenCalled()
  })
  it('stops when the page is hidden and clears timers on unmount', () => {
    const move = vi.fn()
    const controls = useWalkKeys(move, vi.fn())
    controls.onKeyDown(key('s'))
    Object.assign(document, { hidden: true })
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(200)
    expect(move).toHaveBeenCalledTimes(1)
    Object.assign(document, { hidden: false })
    controls.onKeyDown(key('s'))
    effects.cleanups.splice(0).forEach((cleanup) => cleanup())
    vi.advanceTimersByTime(200)
    expect(move).toHaveBeenCalledTimes(2)
  })
})
