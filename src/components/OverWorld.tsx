import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { extendReach, findItem, travelItem } from '../lib/game'
import { roadSpot } from '../lib/roadItems'
import { playTap } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import {
  CHUNK_W,
  DOOR_Y,
  MIN_CHUNKS,
  ROAD_PART,
  ROAD_PARTS,
  TILE_W,
  WORLD_H,
  cameraX,
  chunksNeeded,
  clampWalk,
  gateAt,
  gateX,
  houseBox,
  placeOfChunk,
  startPos,
  stepWorld,
  worldWidth,
} from '../lib/world'
import { FigureLayers } from './FigureLayers'
import { useWalkKeys } from './useWalkKeys'
import { assetUrl } from '../lib/items'

/** 길 배경 그림(집 20채, 가로 19200×667)을 1.3배로 키워 길(모래색 띠)이 걷는 높이(585 근처)에 오게 깔고(위쪽 하늘은 잘림) 같은 그림을 이어 붙인다. 그림 속 집이 장소의 문이다. */
const BG_W = TILE_W
const BG_H = 867
const BG_TOP = -26

interface Props {
  actions?: ReactNode
  paused?: boolean
  /** 저장된 맵 길이(구간 수) */
  reach: number
  /** 마지막으로 들어간 문의 구간 (그 앞에서 시작) */
  chunk: number
  assign: Record<string, string[]>
  outfit: Outfit
  tweaks: Tweaks
  onEnter: (placeId: string, chunk: number) => void
}

export function OverWorld({ reach, chunk, outfit, tweaks, onEnter, paused = false, actions }: Props) {
  const { lang } = useI18n()
  const hostRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 400, h: 500 })
  const [chunks, setChunks] = useState(Math.max(MIN_CHUNKS, reach, chunk + 2))
  const chunksRef = useRef(chunks)
  const [pos, setPos] = useState(() => startPos(chunk))
  const [dir, setDir] = useState<1 | -1>(1)
  const [walking, setWalking] = useState(false)
  const [destination, setDestination] = useState<{ x: number; y: number } | null>(null)
  const posRef = useRef(pos)
  const target = useRef<{ x: number; y: number } | null>(null)
  const frame = useRef(0)
  const last = useRef(0)
  const entered = useRef(false)
  // 누른 집: 테두리가 네온으로 반짝이고, 문에 닿으면 잠깐 반짝인 뒤 들어간다
  const [glow, setGlow] = useState<number | null>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(enterTimer.current), [])
  /** 큰 배경 그림이 다 받아진 뒤에 부드럽게 나타낸다 (그 전에는 하늘·풀밭 색이 보여서 회색 화면이 없다) */
  const [bgReady, setBgReady] = useState(false)
  useEffect(() => { const im = new Image(); im.onload = im.onerror = () => setBgReady(true); im.src = assetUrl('assets/farm/travel_road10_0.webp') }, [])
  const [gotId, setGotId] = useState<string | null>(null)
  useEffect(() => { if (!gotId) return; const t = setTimeout(() => setGotId(null), 3000); return () => clearTimeout(t) }, [gotId])
  /** 반짝이는 자리에 닿으면 줍는다 */
  const pickNear = (pos: { x: number; y: number }) => {
    const c0 = Math.floor(pos.x / CHUNK_W)
    for (let c = Math.max(0, c0 - 1); c <= c0 + 1; c++) {
      const sp = roadSpot(c)
      if (sp && Math.hypot(pos.x - sp.x, pos.y - sp.y) < 110 && findItem(sp.id)) setGotId(sp.id)
    }
  }
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
      pickNear(r.pos)
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
        setDestination(null)
        enterTimer.current = setTimeout(() => onEnter(placeOfChunk(g).id, g), 450)
        return
      }
      if (r.arrived) {
        target.current = null
        setWalking(false)
        setDestination(null)
        return
      }
      frame.current = requestAnimationFrame(tick)
    },
    [onEnter],
  )
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const walkTo = (x: number, y: number, gate: number | null = null) => {
    intent.current = gate
    setGlow(gate)
    target.current = clampWalk(x, y, chunksRef.current)
    setDestination(target.current)
    setWalking(true)
    cancelAnimationFrame(frame.current)
    last.current = performance.now()
    frame.current = requestAnimationFrame(tick)
  }

  const onTap = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    hostRef.current?.focus({ preventScroll: true })
    const r = hostRef.current!.getBoundingClientRect()
    walkTo((e.clientX - r.left) / scale + cam, (e.clientY - r.top) / scale)
  }

  const stop = () => {
    cancelAnimationFrame(frame.current)
    target.current = null
    intent.current = null
    setGlow(null)
    setWalking(false)
    setDestination(null)
  }
  useEffect(() => { if (paused) stop() }, [paused])
  const keys = useWalkKeys(
    (x, y) => walkTo(posRef.current.x + x * 120, posRef.current.y + y * 120),
    stop,
    !paused,
  )

  const figW = 145 * 1.5 * (0.8 + 0.2 * ((pos.y - 585) / 150))
  const bgTiles = Array.from({ length: Math.floor((cam + visibleW) / BG_W) - Math.floor(cam / BG_W) + 1 }, (_, k) => Math.floor(cam / BG_W) + k)
  const range = Array.from({ length: lastChunk - first + 1 }, (_, k) => first + k)

  return (
    <div ref={hostRef} tabIndex={0} aria-label={lang === 'ko' ? '여행 마을, 방향키로 이동' : 'Village, move with arrow keys'} {...keys} className="travel-world relative h-full touch-none overflow-hidden rounded-3xl shadow-inner ring-1 ring-black/5 select-none" style={{ background: 'linear-gradient(#8fc3ee 0%, #bcd9a2 40%, #8fba5c 62%, #e5c98e 80%, #8fba5c 100%)' }} onPointerUp={onTap}>
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: worldWidth(chunks), height: WORLD_H, transform: `scale(${scale}) translateX(${-cam}px)` }}>
        {bgTiles.map((t) => Array.from({ length: ROAD_PARTS }, (_, k) => {
          const x0 = Math.round(k * ROAD_PART * 1.3)
          const x1 = k === ROAD_PARTS - 1 ? BG_W : Math.round((k + 1) * ROAD_PART * 1.3)
          return <img key={`${t}-${k}`} src={assetUrl(`assets/farm/travel_road10_${k}.webp`)} alt="" draggable={false} className="pointer-events-none absolute select-none" style={{ left: t * BG_W + x0, top: BG_TOP, width: x1 - x0 + 1, height: BG_H, maxWidth: 'none', opacity: bgReady ? 1 : 0, transition: 'opacity 0.4s' }} />
        }))}
        {/* 밤 색은 길 전체에 한 장으로 덮는다 (구간마다 따로 덮으면 이음매에 세로줄이 보인다) */}
        {range.map((c) => {
          return (
            <div key={c} className="absolute top-0" style={{ left: c * CHUNK_W, width: CHUNK_W, height: WORLD_H }}>
              <button
                onPointerUp={(e) => e.stopPropagation()}
                aria-label={`${lang === 'ko' ? '집' : 'House'} ${c + 1}`}
                onClick={() => walkTo(gateX(c), DOOR_Y + 40, c)}
                className="absolute -translate-x-1/2 rounded-3xl"
                style={{ left: gateX(c) - c * CHUNK_W, top: 190, zIndex: 2 }}
              >
                <span aria-hidden className="block" style={{ width: 300, height: 300 }} />
              </button>
              {glow === c && (() => { const b = houseBox(c); return <div aria-hidden className="house-neon pointer-events-none absolute" style={{ left: b.left - c * CHUNK_W, top: b.top, width: b.right - b.left, height: b.bottom - b.top, zIndex: 2 }} /> })()}
            </div>
          )
        })}

        {range.map((c) => {
          const sp = roadSpot(c)
          return sp ? (
            <button key={`s${c}`} aria-label={lang === 'ko' ? '반짝이는 것' : 'Something sparkly'} onPointerUp={(e) => e.stopPropagation()} onClick={() => { playTap(); walkTo(sp.x, sp.y) }} className="absolute -translate-x-1/2 -translate-y-1/2 animate-pulse text-5xl drop-shadow-lg" style={{ left: sp.x, top: sp.y, zIndex: 3 }}>✨</button>
          ) : null
        })}

        {destination && <div aria-hidden className="walk-destination pointer-events-none absolute" style={{ left: destination.x, top: destination.y, zIndex: 3 }} />}
        <div
          className="pointer-events-none absolute"
          style={{ left: pos.x, top: pos.y, width: figW, aspectRatio: '1024 / 1536', transform: 'translate(-50%, -100%)', zIndex: 1000 }}
        >
          <div className="relative h-full w-full" style={{ transform: `scaleX(${dir})` }}>
            <div className={`h-full w-full ${walking ? 'walk-bob' : ''}`}>
            <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
            </div>
          </div>
        </div>
      </div>

      {gotId && travelItem(gotId) && (
        <div role="status" className="absolute top-28 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-white/95 px-3 py-2 shadow-lg">
          <img src={assetUrl(travelItem(gotId)!.thumb)} alt="" className="h-12 w-12 object-contain" />
          <span className="text-sm font-bold">{lang === 'ko' ? '찾았어요!' : 'Found it!'} {travelItem(gotId)!.name[lang]}</span>
        </div>
      )}
      <div className="absolute top-2 left-2 right-28 z-10 flex min-w-0 flex-wrap items-center gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1" onPointerUp={e => e.stopPropagation()}>{actions}</div>
      </div>
    </div>
  )
}

