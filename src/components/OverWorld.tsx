import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { useI18n } from '../i18n'
import { PHASE_ICON, PHASE_LABEL, tintOf } from '../lib/daynight'
import { extendReach, isFound } from '../lib/game'
import type { Outfit, Tweaks } from '../lib/types'
import {
  CHUNK_W,
  DOOR_Y,
  MIN_CHUNKS,
  WORLD_H,
  ZONE_GROUND,
  ZONE_SKY,
  cameraX,
  chunksNeeded,
  clampWalk,
  decorFor,
  gateAt,
  gateX,
  metersOf,
  placeOfChunk,
  startPos,
  stepWorld,
  worldWidth,
} from '../lib/world'
import { FigureLayers } from './FigureLayers'
import { useClock } from './useClock'

const TEXT = {
  ko: { hint: '앞으로 걸어가면 맵이 계속 이어져요! 집을 누르면 그 장소로 들어가요', found: '찾음' },
  en: { hint: 'Keep walking: the map keeps growing! Tap a house to enter', found: 'Found' },
}

interface Props {
  /** 저장된 맵 길이(구간 수) */
  reach: number
  /** 마지막으로 들어간 문의 구간 (그 앞에서 시작) */
  chunk: number
  assign: Record<string, string[]>
  outfit: Outfit
  tweaks: Tweaks
  onEnter: (placeId: string, chunk: number) => void
}

export function OverWorld({ reach, chunk, assign, outfit, tweaks, onEnter }: Props) {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  const { clock, skip } = useClock()
  const tint = tintOf(clock)
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 400, h: 500 })
  const [chunks, setChunks] = useState(Math.max(MIN_CHUNKS, reach, chunk + 2))
  const chunksRef = useRef(chunks)
  const firstChunks = useRef(chunks)
  const [pos, setPos] = useState(() => startPos(chunk))
  const [dir, setDir] = useState<1 | -1>(1)
  const [walking, setWalking] = useState(false)
  const posRef = useRef(pos)
  const target = useRef<{ x: number; y: number } | null>(null)
  const frame = useRef(0)
  const last = useRef(0)
  const entered = useRef(false)
  /** 집을 눌러서 걸어가는 중이면 그 구간 번호 (지나가다 우연히 들어가지 않게) */
  const intent = useRef<number | null>(null)

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth || 400, h: el.clientHeight || 500 })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  const scale = size.h / WORLD_H
  const visibleW = size.w / scale
  const cam = cameraX(pos.x, visibleW, chunks)
  const first = Math.max(0, Math.floor(cam / CHUNK_W) - 1)
  const lastChunk = Math.min(chunks - 1, Math.floor((cam + visibleW) / CHUNK_W) + 1)

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
      // 끝이 가까워지면 맵을 오른쪽으로 잇는다
      const need = chunksNeeded(r.pos.x, chunksRef.current)
      if (need > chunksRef.current) {
        chunksRef.current = need
        setChunks(need)
        extendReach(need)
      }
      const g = gateAt(r.pos)
      if (g >= 0 && g === intent.current && r.arrived && !entered.current) {
        entered.current = true
        target.current = null
        setWalking(false)
        onEnter(placeOfChunk(g).id, g)
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

  const walkTo = (x: number, y: number, gate: number | null = null) => {
    intent.current = gate
    target.current = clampWalk(x, y, chunksRef.current)
    setWalking(true)
    cancelAnimationFrame(frame.current)
    last.current = performance.now()
    frame.current = requestAnimationFrame(tick)
  }

  const onTap = (e: PointerEvent<HTMLDivElement>) => {
    const r = hostRef.current!.getBoundingClientRect()
    walkTo((e.clientX - r.left) / scale + cam, (e.clientY - r.top) / scale)
  }

  const figW = 190 * (0.75 + 0.25 * ((pos.y - 540) / 220))
  const range = Array.from({ length: lastChunk - first + 1 }, (_, k) => first + k)

  return (
    <div ref={hostRef} className="relative h-full touch-none overflow-hidden rounded-3xl shadow-inner ring-1 ring-black/5 select-none" onPointerUp={onTap}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: worldWidth(chunks), height: WORLD_H, transform: `scale(${scale}) translateX(${-cam}px)` }}>
        {range.map((c) => {
          const zone = c % ZONE_SKY.length
          const next = (c + 1) % ZONE_SKY.length
          const p = placeOfChunk(c)
          const ids = assign[p.id] ?? []
          const got = ids.filter(isFound).length
          const done = ids.length > 0 && got === ids.length
          return (
            <div key={c} className={`absolute top-0 ${c >= firstChunks.current && c >= chunks - 2 ? 'chunk-in' : ''}`} style={{ left: c * CHUNK_W, width: CHUNK_W + 2, height: WORLD_H }}>
              {/* 하늘과 땅: 다음 지역 색으로 서서히 바뀐다 */}
              <div className="absolute inset-x-0 top-0" style={{ height: 520, background: `linear-gradient(90deg, ${ZONE_SKY[zone]}, ${ZONE_SKY[next]})` }} />
              <div className="absolute inset-x-0 bottom-0" style={{ top: 520, background: `linear-gradient(90deg, ${ZONE_GROUND[zone]}, ${ZONE_GROUND[next]})` }} />
              <div className="absolute inset-x-0" style={{ top: 520, height: 8, background: 'rgba(255,255,255,0.5)' }} />
              <div className="absolute inset-x-0 rounded-full" style={{ top: 690, height: 70, background: 'rgba(255,255,255,0.35)' }} />
              {tint && <div className="pointer-events-none absolute inset-0" style={{ background: tint }} />}
              {clock.dark > 0.3 && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0" style={{ height: 500, opacity: Math.min(1, (clock.dark - 0.3) / 0.5) }}>
                  {Array.from({ length: 16 }, (_, k) => (
                    <span key={k} className="absolute text-2xl text-white" style={{ left: (k * 97 + c * 31) % CHUNK_W, top: (k * 83 + c * 17) % 420, opacity: 0.5 + ((k * 7) % 5) / 10 }}>
                      {k % 9 === 0 ? '⭐' : '✦'}
                    </span>
                  ))}
                </div>
              )}
              {decorFor(c).map((d, k) => (
                <span key={k} aria-hidden className="absolute" style={{ left: d.x - c * CHUNK_W, top: d.y, fontSize: d.big ? 96 : 64, opacity: 0.9, zIndex: 1 }}>
                  {d.emoji}
                </span>
              ))}
              <button
                aria-label={`${lang === 'ko' ? p.ko : p.en} ${c}`}
                onClick={() => walkTo(gateX(c), DOOR_Y + 40, c)}
                className="absolute flex -translate-x-1/2 flex-col items-center"
                style={{ left: gateX(c) - c * CHUNK_W, top: DOOR_Y - 150, zIndex: 2 }}
              >
                <span className={`flex h-36 w-36 items-center justify-center rounded-[2.5rem] text-8xl shadow-lg ring-4 ${done ? 'bg-amber-100 ring-amber-400' : 'bg-white/90 ring-white'}`}>{p.icon}</span>
                <span className="mt-2 rounded-full bg-white/95 px-5 py-1 text-3xl font-bold whitespace-nowrap shadow">{lang === 'ko' ? p.ko : p.en}</span>
                <span className="mt-1 rounded-full bg-blush px-4 text-2xl font-bold text-white">
                  {tx.found} {got}/{ids.length}
                </span>
              </button>
            </div>
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

      <span className="pointer-events-none absolute top-2 left-2 z-10 flex h-12 items-center rounded-full bg-white/90 px-4 text-sm font-bold shadow-md ring-1 ring-black/5">
        🚶 {metersOf(pos.x).toLocaleString()}m
      </span>
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
