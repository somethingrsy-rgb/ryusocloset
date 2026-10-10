import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { useI18n } from '../i18n'
import { PLACE_BY_ID, eventDone, finishEvent, findItem, getGame, isFound, pickReward, spotFor } from '../lib/game'
import { ITEM_BY_ID, assetUrl } from '../lib/items'
import { NPCS } from '../lib/npcs'
import { playSnap } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import { clampToBounds, depthScale, distPx, stepToward, type Vec } from '../lib/walk'
import { FigureLayers } from './FigureLayers'
import { NpcDialog } from './NpcDialog'
import { PHASE_ICON, PHASE_LABEL, tintOf } from '../lib/daynight'
import { useClock } from './useClock'
import { useGame } from './TravelGame'
import { useWalkKeys } from './useWalkKeys'
import { TravelDecor } from './TravelDecor'

const TEXT = {
  ko: { map: '지도', found: '찾음', hint: '바닥: 이동 · 방향키/WASD · 소품: 살펴보기',
    nightHint: '밤에는 반짝임이 더 잘 보여요 ✨ 소품도 눌러봐요', done: '모두 찾았어요 ⭐ 이제 소품을 살펴볼까요?', got: '찾았다!', wear: '옷장에서 입어보기', keep: '계속 걷기', talkTo: '말 걸기' },
  en: { map: 'Map', found: 'Found', hint: 'Tap to walk · Arrow keys/WASD · Tap props to explore',
    nightHint: 'Sparkles glow at night ✨ Try tapping the props, too', done: 'All found ⭐ Time to explore the furnishings!', got: 'Found it!', wear: 'Try it on', keep: 'Keep walking', talkTo: 'Talk' },
}

const NPC_POS: Vec = { x: 84, y: 84 }
const CHEST_POS: Vec = { x: 52, y: 74 }
const PICK_R = 70 // 이 거리(px) 안을 지나가면 줍는다
const TALK_R = 130 // NPC 가까이 가면 말을 건다
const TALK_AGAIN_R = 220 // 이만큼 멀어졌다가 다시 오면 또 말을 건다

interface Props {
  placeId: string
  assign: Record<string, string[]>
  outfit: Outfit
  tweaks: Tweaks
  onExit: () => void
  onWear: (id: string) => void
}

export function TravelScene({ placeId, assign, outfit, tweaks, onExit, onWear }: Props) {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  useGame()
  const { clock, skip } = useClock()
  const tint = tintOf(clock)
  const night = clock.dark > 0.5
  const p = PLACE_BY_ID[placeId]
  const npc = NPCS[placeId]
  const ids = assign[placeId] ?? []
  const left = ids.filter((id) => !isFound(id))

  const [pos, setPos] = useState<Vec>({ x: 20, y: 86 })
  const [dir, setDir] = useState<1 | -1>(1)
  const [walking, setWalking] = useState(false)
  const [destination, setDestination] = useState<Vec | null>(null)
  const [popup, setPopup] = useState<string | null>(null)
  const [talk, setTalk] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const posRef = useRef(pos)
  const target = useRef<Vec | null>(null)
  const talkLock = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const blocked = !!popup || talk

  const reward = useCallback(
    (scope: 'here' | 'any') => {
      const id = pickReward(assign, getGame().found, placeId, scope)
      finishEvent(placeId)
      if (id && findItem(id)) {
        playSnap()
        setPopup(id)
      }
    },
    [assign, placeId],
  )

  const pick = useCallback((id: string) => {
    if (findItem(id)) {
      playSnap()
      setPopup(id)
    }
  }, [])

  // 걷는 루프: 목표가 있을 때만 돈다
  const frame = useRef<number>(0)
  const last = useRef(0)
  const tick = useCallback(
    (now: number) => {
      const dt = Math.min(0.05, (now - last.current) / 1000)
      last.current = now
      const t = target.current
      if (t) {
        const r = stepToward(posRef.current, t, dt)
        if (r.pos.x !== posRef.current.x) setDir(r.pos.x < posRef.current.x ? -1 : 1)
        posRef.current = r.pos
        setPos(r.pos)
        if (r.arrived) {
          target.current = null
          setWalking(false)
          setDestination(null)
        }
      }
      // 지나가다 가까워지면 줍고, NPC 에게 다가가면 말을 건다
      const me = posRef.current
      const g = getGame()
      const hitSpot = ids.findIndex((id, i) => !g.found.includes(id) && distPx(me, spotFor(id, i)) < PICK_R)
      if (hitSpot >= 0) {
        target.current = null
        setWalking(false)
        setDestination(null)
        pick(ids[hitSpot])
        return
      }
      if (npc?.event === 'gift' && !eventDone(placeId) && distPx(me, CHEST_POS) < PICK_R) {
        target.current = null
        setWalking(false)
        setDestination(null)
        reward('any')
        return
      }
      if (npc) {
        const d = distPx(me, NPC_POS)
        if (d > TALK_AGAIN_R) talkLock.current = false
        else if (d < TALK_R && !talkLock.current) {
          talkLock.current = true
          target.current = null
          setWalking(false)
          setDestination(null)
          setTalk(true)
          return
        }
      }
      if (target.current) frame.current = requestAnimationFrame(tick)
    },
    [ids, npc, pick, placeId, reward],
  )

  const walkTo = (v: Vec) => {
    if (blocked) return
    target.current = clampToBounds(v)
    setDestination(target.current)
    setWalking(true)
    cancelAnimationFrame(frame.current)
    last.current = performance.now()
    frame.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const onTap = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    boxRef.current?.focus({ preventScroll: true })
    const r = boxRef.current!.getBoundingClientRect()
    walkTo({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
  }

  const stop = () => {
    cancelAnimationFrame(frame.current)
    target.current = null
    setWalking(false)
    setDestination(null)
  }
  const keys = useWalkKeys(
    (x, y) => walkTo({ x: posRef.current.x + x * 12, y: posRef.current.y + y * 9 }),
    stop,
    !blocked,
  )

  const got = ids.length - left.length
  const scale = depthScale(pos.y)

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden rounded-3xl bg-white/60 shadow-inner ring-1 ring-black/5">
      <div ref={boxRef} tabIndex={0} aria-label={lang === 'ko' ? p.ko : p.en} {...keys} className="relative isolate h-full max-w-full touch-none select-none" style={{ aspectRatio: '1086 / 1448' }} onPointerUp={onTap}>
        <img src={assetUrl(night && p.wallNight ? p.wallNight : p.wall)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
        <img src={assetUrl(p.floor)} alt="" className="absolute inset-x-0 bottom-0 w-full" style={{ height: `${(p.floorH / 1448) * 100}%` }} draggable={false} />

        {tint && !(night && p.wallNight) && <div className="pointer-events-none absolute inset-0" style={{ background: tint, zIndex: 1 }} />}

        <TravelDecor placeId={placeId} blocked={blocked} onInteract={stop} />

        {ids.map((id, i) => {
          if (isFound(id)) return null
          const s = spotFor(id, i)
          return (
            <button
              key={id}
              aria-label={tx.hint}
              onClick={() => walkTo(s)}
              className={`sparkle ${night ? 'sparkle-night' : ''} absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-2xl`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: 110 }}
            >
              <span aria-hidden>✨</span>
              {hint === id && <span className="absolute -top-3 -right-1 text-lg" aria-hidden>💡</span>}
            </button>
          )
        })}

        {npc?.event === 'gift' && !eventDone(placeId) && (
          <button
            aria-label="gift"
            onClick={() => walkTo(CHEST_POS)}
            className="sparkle absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-4xl"
            style={{ left: `${CHEST_POS.x}%`, top: `${CHEST_POS.y}%`, zIndex: Math.round(CHEST_POS.y) }}
          >
            <span aria-hidden>🎁</span>
          </button>
        )}

        {npc && (
          <button
            aria-label={npc.name[lang]}
            onClick={() => (distPx(posRef.current, NPC_POS) < TALK_R ? setTalk(true) : walkTo({ x: NPC_POS.x - 10, y: NPC_POS.y }))}
            className="absolute flex h-16 w-16 -translate-x-1/2 -translate-y-full items-center justify-center text-5xl transition active:scale-90"
            style={{ left: `${NPC_POS.x}%`, top: `${NPC_POS.y}%`, zIndex: Math.round(NPC_POS.y) }}
          >
            <span aria-hidden>{npc.emoji}</span>
            {!eventDone(placeId) && <span className="absolute -top-1 -right-1 rounded-full bg-blush px-1.5 text-xs font-bold text-white">!</span>}
          </button>
        )}

        {destination && <div aria-hidden className="walk-destination pointer-events-none absolute" style={{ left: `${destination.x}%`, top: `${destination.y}%`, zIndex: 2 }} />}
        {/* 류소: 발 위치(pos)에 서고, 아래쪽일수록 크게. 걸을 땐 통통 튀고 가는 방향을 바라본다 */}
        <div
          className="pointer-events-none absolute"
          style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${30 * scale}%`, aspectRatio: '1024 / 1536', transform: 'translate(-50%, -100%)', zIndex: Math.round(pos.y) }}
        >
          <div className="avatar-ground-shadow" />
          <div className="relative h-full w-full" style={{ transform: `scaleX(${dir})` }}>
            <div className={`h-full w-full ${walking ? 'walk-bob' : ''}`}>
            <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={skip}
        aria-label={PHASE_LABEL[clock.phase][lang]}
        className="absolute top-2 right-2 z-10 flex h-12 items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-bold shadow-md ring-1 ring-black/5"
      >
        <span aria-hidden>{PHASE_ICON[clock.phase]}</span>
        {PHASE_LABEL[clock.phase][lang]}
      </button>
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <button onClick={onExit} className="flex h-12 items-center gap-1 rounded-full bg-white/90 px-4 text-sm font-bold shadow-md ring-1 ring-black/5">
          <span aria-hidden>🗺️</span>
          {tx.map}
        </button>
        <span className="rounded-full bg-white/90 px-3 py-2 text-sm font-bold shadow-md ring-1 ring-black/5">
          {p.icon} {lang === 'ko' ? p.ko : p.en} · {tx.found} {got}/{ids.length}
        </span>
      </div>
      <p className="travel-hint pointer-events-none absolute inset-x-3 bottom-3 z-10 text-center text-xs font-bold">{left.length === 0 ? tx.done : night ? tx.nightHint : tx.hint}</p>

      {talk && npc && (
        <NpcDialog
          npc={npc}
          placeId={placeId}
          onReward={() => reward('here')}
          onHint={() => {
            if (!left.length) return false
            setHint(left[Math.floor(Math.random() * left.length)])
            return true
          }}
          onClose={() => setTalk(false)}
        />
      )}
      {popup && ITEM_BY_ID[popup] && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-6" onClick={() => setPopup(null)}>
          <div className="w-64 rounded-3xl bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-extrabold text-blush-deep">🎉 {tx.got}</p>
            <img src={assetUrl(ITEM_BY_ID[popup].thumb)} alt="" className="mx-auto my-3 h-32 w-32 object-contain" />
            <p className="mb-3 font-bold">{ITEM_BY_ID[popup].name[lang]}</p>
            <div className="flex flex-col gap-2">
              <button
                className="h-11 rounded-full bg-blush font-bold text-white"
                onClick={() => {
                  const id = popup
                  setPopup(null)
                  onWear(id)
                }}
              >
                {tx.wear}
              </button>
              <button className="h-11 rounded-full bg-petal font-bold" onClick={() => setPopup(null)}>
                {tx.keep}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

