import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { useI18n } from '../i18n'
import { PHASE_ICON, PHASE_LABEL, tintOf } from '../lib/daynight'
import { PLACES, isFound } from '../lib/game'
import type { Outfit, Tweaks } from '../lib/types'
import { DOOR_Y, WORLD_H, WORLD_W, ZONE_DECOR, ZONE_GROUND, ZONE_SKY, cameraX, clampWalk, gateAt, gateX, startPos, stepWorld } from '../lib/world'
import { FigureLayers } from './FigureLayers'
import { useClock } from './useClock'

const TEXT = {
  ko: { hint: '화면을 눌러 걸어가요! 집(문)에 들어가면 그 장소로 들어가요', found: '찾음' },
  en: { hint: 'Tap to walk! Step into a door to enter the place', found: 'Found' },
}

interface Props {
  /** 지금 있는 장소 id (여기 문 앞에서 시작) */
  at: string
  assign: Record<string, string[]>
  outfit: Outfit
  tweaks: Tweaks
  onEnter: (placeId: string) => void
}

export function OverWorld({ at, assign, outfit, tweaks, onEnter }: Props) {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  const { clock, skip } = useClock()
  const tint = tintOf(clock)
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 400, h: 500 })
  const [pos, setPos] = useState(() => startPos(PLACES.findIndex((p) => p.id === at)))
  const [dir, setDir] = useState<1 | -1>(1)
  const [walking, setWalking] = useState(false)
  const posRef = useRef(pos)
  const target = useRef<{ x: number; y: number } | null>(null)
  const frame = useRef(0)
  const last = useRef(0)
  const entered = useRef(false)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 400, h: el.clientHeight || 500 }))
    ro.observe(el)
    setSize({ w: el.clientWidth || 400, h: el.clientHeight || 500 })
    return () => ro.disconnect()
  }, [])

  const scale = size.h / WORLD_H
  const visibleW = size.w / scale
  const cam = cameraX(pos.x, visibleW)

  const tick = useCallback(
    (now: number) => {
      const dt = Math.min(0.05, (now - last.current) / 1000)
      last.current = now
      const t = target.current
      if (!t) return
      const r = stepWorld(posRef.current, t, dt)
      if (r.pos.x !== posRef.current.x) setDir(r.pos.x < posRef.current.x ? -1 : 1)
      posRef.current = r.pos
      setPos(r.pos)
      const g = gateAt(r.pos)
      if (g >= 0 && !entered.current) {
        entered.current = true
        target.current = null
        setWalking(false)
        onEnter(PLACES[g].id)
        return
      }
      if (r.arrived) {
        target.current = null
        setWalking(false)
        return
      }
      frame.current = requestAnimationFrame(tick)
    },
    [onEnter],
  )
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const walkTo = (x: number, y: number) => {
    target.current = clampWalk(x, y)
    setWalking(true)
    cancelAnimationFrame(frame.current)
    last.current = performance.now()
    frame.current = requestAnimationFrame(tick)
  }

  const onTap = (e: PointerEvent<HTMLDivElement>) => {
    const r = hostRef.current!.getBoundingClientRect()
    walkTo((e.clientX - r.left) / scale + cam, (e.clientY - r.top) / scale)
  }

  const n = PLACES.length
  const figW = 190 * (0.75 + 0.25 * ((pos.y - 540) / 220))

  return (
    <div ref={hostRef} className="relative h-full touch-none overflow-hidden rounded-3xl shadow-inner ring-1 ring-black/5 select-none" onPointerUp={onTap}>
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: WORLD_W, height: WORLD_H, transform: `scale(${scale}) translateX(${-cam}px)` }}
      >
        {/* 하늘과 땅: 지역마다 색이 이어진다 */}
        <div className="absolute inset-x-0 top-0" style={{ height: 520, background: `linear-gradient(90deg, ${ZONE_SKY.join(',')})` }} />
        <div className="absolute inset-x-0 bottom-0" style={{ top: 520, background: `linear-gradient(90deg, ${ZONE_GROUND.join(',')})` }} />
        <div className="absolute inset-x-0" style={{ top: 520, height: 8, background: 'rgba(255,255,255,0.5)' }} />
        {/* 밤이 되면 하늘과 땅이 어두워진다 */}
        {tint && <div className="pointer-events-none absolute inset-0" style={{ background: tint, zIndex: 0 }} />}
        {clock.dark > 0.3 && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0" style={{ height: 500, opacity: Math.min(1, (clock.dark - 0.3) / 0.5) }}>
            {Array.from({ length: 46 }, (_, k) => (
              <span key={k} className="absolute text-2xl text-white" style={{ left: (k * 337) % WORLD_W, top: (k * 83) % 420, opacity: 0.5 + ((k * 7) % 5) / 10 }}>
                {k % 9 === 0 ? '⭐' : '✦'}
              </span>
            ))}
          </div>
        )}
        {/* 길 */}
        <div className="absolute inset-x-0 rounded-full" style={{ top: 690, height: 70, background: 'rgba(255,255,255,0.35)' }} />

        {PLACES.map((p, i) => (
          <div key={`d${p.id}`} aria-hidden>
            {ZONE_DECOR[i].map((d, k) => (
              <span
                key={k}
                className="absolute text-6xl"
                style={{ left: gateX(i, n) + (k - 1) * 260 + (k === 1 ? 90 : -40), top: k === 1 ? 600 : 330 + k * 40, opacity: 0.9, zIndex: 1 }}
              >
                {d}
              </span>
            ))}
          </div>
        ))}

        {PLACES.map((p, i) => {
          const ids = assign[p.id] ?? []
          const got = ids.filter(isFound).length
          const done = ids.length > 0 && got === ids.length
          return (
            <button
              key={p.id}
              aria-label={lang === 'ko' ? p.ko : p.en}
              onClick={() => walkTo(gateX(i, n), DOOR_Y + 40)}
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: gateX(i, n), top: DOOR_Y - 150, zIndex: 2 }}
            >
              <span className={`flex h-36 w-36 items-center justify-center rounded-[2.5rem] text-8xl shadow-lg ring-4 ${done ? 'bg-amber-100 ring-amber-400' : 'bg-white/90 ring-white'}`}>
                {p.icon}
              </span>
              <span className="mt-2 rounded-full bg-white/95 px-5 py-1 text-3xl font-bold whitespace-nowrap shadow">
                {lang === 'ko' ? p.ko : p.en}
              </span>
              <span className="mt-1 rounded-full bg-blush px-4 text-2xl font-bold text-white">
                {tx.found} {got}/{ids.length}
              </span>
            </button>
          )
        })}

        <div
          className="pointer-events-none absolute"
          style={{ left: pos.x, top: pos.y, width: figW, aspectRatio: '1024 / 1536', transform: 'translate(-50%, -100%)', zIndex: Math.round(pos.y) }}
        >
          <div className={`relative h-full w-full ${walking ? 'walk-bob' : ''}`} style={{ transform: `scaleX(${dir})` }}>
            <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
          </div>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          skip()
        }}
        onPointerUp={(e) => e.stopPropagation()}
        aria-label={PHASE_LABEL[clock.phase][lang]}
        className="absolute top-2 right-2 z-10 flex h-12 items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-bold shadow-md ring-1 ring-black/5"
      >
        <span aria-hidden>{PHASE_ICON[clock.phase]}</span>
        {PHASE_LABEL[clock.phase][lang]}
      </button>
      <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 text-center text-xs font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{tx.hint}</p>
    </div>
  )
}
