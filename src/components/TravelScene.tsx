import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react'
import { useI18n } from '../i18n'
import { PLACE_BY_ID, eventDone, finishEnglish, finishEvent, findItem, getGame, isFound, pickReward, spotFor, travelItem } from '../lib/game'
import { assetUrl } from '../lib/items'
import { NPCS } from '../lib/npcs'
import { playSnap } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import { WALK_BOUNDS, clampToBounds, depthScale, distPx, stepToward, type Vec } from '../lib/walk'
import { FigureLayers } from './FigureLayers'
import { NpcDialog } from './NpcDialog'
import { useGame } from './TravelGame'
import { useWalkKeys } from './useWalkKeys'
import { TravelDecor } from './TravelDecor'

import { getTravelRoom, subscribeTravelRooms, travelRoomsVersion } from '../lib/travelRooms'
import { useItemsVersion } from '../lib/useItemsVersion'
import { sceneAssets } from '../lib/exportRoom'
import { drawables } from '../lib/room'
import { AVATAR_BASE_W, AVATAR_FEET_RATIO, ROOM_W, ROOM_H } from '../lib/roomTypes'

const TEXT = {
  ko: { map: '지도', found: '찾음', hint: '바닥: 이동 · 방향키/WASD · 소품: 살펴보기',
    nightHint: '밤에는 반짝임이 더 잘 보여요 ✨ 소품도 눌러봐요', done: '모두 찾았어요 ⭐ 이제 소품을 살펴볼까요?', got: '찾았다!', wear: '옷장에서 입어보기', keep: '계속 걷기', talkTo: '말 걸기' },
  en: { map: 'Map', found: 'Found', hint: 'Tap to walk · Arrow keys/WASD · Tap props to explore',
    nightHint: 'Sparkles glow at night ✨ Try tapping the props, too', done: 'All found ⭐ Time to explore the furnishings!', got: 'Found it!', wear: 'Try it on', keep: 'Keep walking', talkTo: 'Talk' },
}

/** 내 방 탭은 아래 패널이 40dvh, 여행 탭은 28dvh 라서 무대가 12dvh 더 높다. 보낸 방이 내 방 탭보다 커 보이지 않게 그만큼 뺀 높이에 맞춘다 */
const ROOM_STAGE_DIFF = 12

const NPC_POS: Vec = { x: 84, y: 84 }
const CHEST_POS: Vec = { x: 52, y: 74 }
const PICK_R = 70 // 이 거리(px) 안을 지나가면 줍는다
const TALK_R = 130 // NPC 가까이 가면 말을 건다
const TALK_AGAIN_R = 220 // 이만큼 멀어졌다가 다시 오면 또 말을 건다

interface Props {
  paused?: boolean
  placeId: string
  assign: Record<string, string[]>
  outfit: Outfit
  tweaks: Tweaks
  onExit: () => void
  onWear: (id: string) => void
}

export function TravelScene({ placeId, assign, outfit, tweaks, onExit, onWear, paused = false }: Props) {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  useGame()
  const night = false // 낮만 쓴다 (저녁·밤 기능은 뺐다)
  const roomVersion = useSyncExternalStore(subscribeTravelRooms, travelRoomsVersion)
  const itemVersion = useItemsVersion()
  const layout = useMemo(() => getTravelRoom(placeId), [placeId, roomVersion, itemVersion])
  const assets = layout ? sceneAssets(layout.scene, (layout.scene === 'camp' || layout.room.wallId === 'camp') ? night : layout.room.night, layout.room.wallId, layout.room.floorId) : null
  const minY = assets ? Math.min(88, 100 - assets.floorH / ROOM_H * 100 + 2) : WALK_BOUNDS.minY
  const layerZ = (y: number) => layout ? 2000 + y / 100 * ROOM_H : Math.round(y)
  const p = PLACE_BY_ID[placeId]
  const npc = NPCS[placeId]
  const ids = assign[placeId] ?? []
  const left = ids.filter((id) => !isFound(id))

  const [pos, setPos] = useState<Vec>(() => layout ? { x: clampToBounds({ x: layout.room.avatar.x / ROOM_W * 100, y: 86 }).x, y: Math.max(minY, Math.min(100, layout.room.avatar.y / ROOM_H * 100)) } : { x: 20, y: 86 })
  const [dir, setDir] = useState<1 | -1>(layout?.room.avatar.flip ? -1 : 1)
  const [walking, setWalking] = useState(false)
  const [destination, setDestination] = useState<Vec | null>(null)
  const [popup, setPopup] = useState<string | null>(null)
  const [talk, setTalk] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const posRef = useRef(pos)
  const target = useRef<Vec | null>(null)
  const talkLock = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const blocked = !!popup || talk || paused

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
    target.current = { ...clampToBounds(v), y: Math.min(layout ? 100 : WALK_BOUNDS.maxY, Math.max(minY, v.y)) }
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
  useEffect(() => { if (paused) stop() }, [paused])
  const keys = useWalkKeys(
    (x, y) => walkTo({ x: posRef.current.x + x * 12, y: posRef.current.y + y * 9 }),
    stop,
    !blocked,
  )

  const got = ids.length - left.length
  const scale = depthScale(pos.y)
  const avatarLayer = layout ? Math.max(10000, ...drawables(layout.room).map(d => d.z)) + 1 : 1000
  const collected = popup ? travelItem(popup) : undefined

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden rounded-3xl bg-white/60 shadow-inner ring-1 ring-black/5" style={{ containerType: 'size' }}>
      {assets && <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: `min(100cqw, calc((100cqh - ${ROOM_STAGE_DIFF}dvh) * ${ROOM_W / ROOM_H}))`, aspectRatio: `${ROOM_W} / ${ROOM_H}` }}>
          {[-1, 0, 1].flatMap(ky => [-2, -1, 0, 1, 2].map(k => ({ k, ky }))).filter(({ k, ky }) => k || ky).map(({ k, ky }) => <div key={`${k}_${ky}`} className="absolute" style={{ left: `calc(${k * 100}% - 1px)`, top: `calc(${ky * 100}% - 1px)`, width: 'calc(100% + 2px)', height: 'calc(100% + 2px)', transform: `scale(${Math.abs(k) % 2 ? -1 : 1}, ${ky ? -1 : 1})` }}>
            <img src={assets.floor} alt="" draggable={false} className="absolute inset-x-0 bottom-0 w-full" style={{ height: `${assets.floorH / ROOM_H * 100}%` }} />
            <img src={assets.wall} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
          </div>)}
        </div>
      </div>}
      <div ref={boxRef} tabIndex={0} aria-label={lang === 'ko' ? p.ko : p.en} {...keys} className={`relative isolate touch-none select-none ${layout ? '' : 'h-full w-full'}`} style={layout ? { width: `min(100cqw, calc((100cqh - ${ROOM_STAGE_DIFF}dvh) * ${ROOM_W / ROOM_H}))`, aspectRatio: `${ROOM_W} / ${ROOM_H}` } : undefined} onPointerUp={onTap}>
        {assets ? <>
          <img src={assets.floor} alt="" className="absolute inset-x-0 bottom-0 w-full" style={{ height: `${assets.floorH / ROOM_H * 100}%` }} draggable={false} />
          <img src={assets.wall} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
        </> : <>
          <img src={assetUrl(night && p.wallNight ? p.wallNight : p.wall)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
          <img src={assetUrl(p.floor)} alt="" className="absolute inset-x-0 bottom-0 w-full" style={{ height: `${p.floorH / ROOM_H * 100}%` }} draggable={false} />
        </>}
        {layout ? drawables(layout.room).filter(d => d.group !== 'avatar').map(d => <img key={d.key} src={d.src ? assetUrl(d.src) : undefined} alt="" draggable={false} className="pointer-events-none absolute" style={{ left: `${d.left / ROOM_W * 100}%`, top: `${d.top / ROOM_H * 100}%`, width: `${d.w / ROOM_W * 100}%`, height: `${d.h / ROOM_H * 100}%`, zIndex: d.z, transform: d.flip ? 'scaleX(-1)' : undefined }} />) : <TravelDecor placeId={placeId} />}

        {ids.map((id, i) => {
          if (isFound(id)) return null
          const s = spotFor(id, i)
          return (
            <button
              key={id}
              aria-label={lang === 'ko' ? '반짝이는 아이템 줍기' : 'Collect sparkling item'}
              disabled={blocked}
              onClick={() => {
                if (blocked) return
                if (s.y < minY) {
                  stop()
                  pick(id)
                } else walkTo(s)
              }}
              className={`sparkle ${night ? 'sparkle-night' : ''} absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-2xl`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: layout ? 10000 : 110 }}
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
            style={{ left: `${CHEST_POS.x}%`, top: `${CHEST_POS.y}%`, zIndex: layerZ(CHEST_POS.y) }}
          >
            <span aria-hidden>🎁</span>
          </button>
        )}

        {npc && (
          <button
            aria-label={npc.name[lang]}
            onClick={() => (distPx(posRef.current, NPC_POS) < TALK_R ? setTalk(true) : walkTo({ x: NPC_POS.x - 10, y: NPC_POS.y }))}
            className="absolute flex h-14 w-14 -translate-x-1/2 -translate-y-full items-center justify-center transition active:scale-90"
            style={{ left: `${NPC_POS.x}%`, top: `${NPC_POS.y}%`, zIndex: layerZ(NPC_POS.y) }}
          >
            {/* 버튼에는 전역 `button { font: inherit }` 때문에 글자 크기 클래스가 먹지 않아서 안쪽 span 에 건다 */}
            <span aria-hidden className="text-[48px] leading-none">{npc.emoji}</span>
            {!eventDone(placeId) && <span className="absolute -top-1 -right-1 rounded-full bg-blush px-1.5 text-xs font-bold text-white">!</span>}
          </button>
        )}

        {destination && <div aria-hidden className="walk-destination pointer-events-none absolute" style={{ left: `${destination.x}%`, top: `${destination.y}%`, zIndex: 2 }} />}
        {/* 류소: 발 위치(pos)에 서고, 아래쪽일수록 크게. 걸을 땐 통통 튀고 가는 방향을 바라본다 */}
        <div
          className="pointer-events-none absolute"
          style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${layout ? AVATAR_BASE_W * layout.room.avatar.scale / ROOM_W * 100 : 30 * scale}%`, aspectRatio: '1024 / 1536', transform: `translate(-50%, -${layout ? AVATAR_FEET_RATIO * 100 : 100}%)`, zIndex: avatarLayer }}
        >
          <div className="relative h-full w-full" style={{ transform: `scaleX(${dir})` }}>
            <div className={`h-full w-full ${walking ? 'walk-bob' : ''}`}>
            <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-2 left-2 right-24 z-30 flex min-w-0 items-center gap-2">
        <button onClick={onExit} className="flex h-12 items-center gap-1 rounded-full bg-white/90 px-4 text-sm font-bold shadow-md ring-1 ring-black/5">
          <span aria-hidden>🗺️</span>
          {tx.map}
        </button>
        <span className="min-w-0 truncate rounded-full bg-white/90 px-3 py-2 text-sm font-bold shadow-md ring-1 ring-black/5">
          {p.icon} {lang === 'ko' ? p.ko : p.en} · {tx.found} {got}/{ids.length}
        </span>
      </div>

      {talk && npc && (
        <NpcDialog
          npc={npc}
          placeId={placeId}
          onReward={() => reward('here')}
          onEnglishReward={() => {
            if (!finishEnglish(placeId)) return false
            const id = pickReward(assign, getGame().found, placeId, 'here')
            if (!id) return false
            pick(id)
            return true
          }}
          onMissionReward={() => {
            const id = pickReward(assign, getGame().found, placeId, 'any')
            if (id) pick(id)
          }}
          onHint={() => {
            if (!left.length) return false
            setHint(left[Math.floor(Math.random() * left.length)])
            return true
          }}
          onClose={() => setTalk(false)}
        />
      )}
      {popup && collected && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-6" onClick={() => setPopup(null)}>
          <div className="w-64 rounded-3xl bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-extrabold text-blush-deep">🎉 {tx.got}</p>
            <img src={assetUrl(collected.thumb)} alt="" className="mx-auto my-3 h-32 w-32 object-contain" />
            <p className="mb-3 font-bold">{collected.name[lang]}</p>
            <div className="flex flex-col gap-2">
              <button
                className="h-11 rounded-full bg-blush font-bold text-white"
                onClick={() => {
                  const id = popup
                  setPopup(null)
                  onWear(id)
                }}
              >
                {collected.kind === 'room' ? (lang === 'ko' ? '내 방에서 꾸미기' : 'Decorate my room') : tx.wear}
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

