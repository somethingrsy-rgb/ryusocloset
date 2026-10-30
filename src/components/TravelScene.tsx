import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react'
import { useI18n } from '../i18n'
import { MY_ROOM_ID, PLACE_BY_ID, findItem, getGame, isFound, spotFor, travelItem } from '../lib/game'
import { assetUrl } from '../lib/items'
import { playOrder, playServe, playTap } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import { WALK_BOUNDS, clampToBounds, depthScale, distPx, stepToward, type Vec } from '../lib/walk'
import { FigureLayers } from './FigureLayers'
import { useGame } from './TravelGame'
import { useWalkKeys } from './useWalkKeys'
import { TravelDecor } from './TravelDecor'
import { GUEST_PER_AVATAR_W, PartyGuests, PartyInvite } from './PartyGuests'
import { avatarName, avatarVersion, getAvatar, subscribeAvatar } from '../lib/avatars'
import { PARTY_SEAT, actKitchen, getKitchen, isPartySeat, subscribeKitchen, ticketAnimal } from '../lib/kitchen'
import { getMeet, subscribeMeet } from '../lib/meet'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { eatLine, getParty, orderLine, partyWish, setPartyState, subscribeParty } from '../lib/party'
import { menuById } from '../lib/recipes'
import { Ico } from './CafeGame'

import { getTravelRoom, subscribeTravelRooms, travelRoomsVersion } from '../lib/travelRooms'
import { useItemsVersion } from '../lib/useItemsVersion'
import { sceneAssets } from '../lib/exportRoom'
import { defaultRoom, drawables } from '../lib/room'
import { AVATAR_BASE_W, AVATAR_FEET_RATIO, ROOM_W, ROOM_H } from '../lib/roomTypes'

/** 찾았다 상자를 보여 주는 시간(ms) */
const FOUND_POP_MS = 700
const TEXT = {
  ko: { map: '산책', decorate: '방', found: '찾음', hint: '바닥: 이동 · 방향키/WASD · 소품: 살펴보기',
    nightHint: '밤에는 반짝임이 더 잘 보여요 ✨ 소품도 눌러봐요', done: '모두 찾았어요 ⭐ 이제 소품을 살펴볼까요?', got: '찾았다!', wear: '옷장에서 입어보기', keep: '계속 걷기', talkTo: '말 걸기' },
  en: { map: 'Walk', decorate: 'Room', found: 'Found', hint: 'Tap to walk · Arrow keys/WASD · Tap props to explore',
    nightHint: 'Sparkles glow at night ✨ Try tapping the props, too', done: 'All found ⭐ Time to explore the furnishings!', got: 'Found it!', wear: 'Try it on', keep: 'Keep walking', talkTo: 'Talk' },
}

/** 여행 탭 아래 패널도 내 방 탭과 같은 높이(40dvh)라서 무대 크기가 같다. 보낸 방은 내 방 탭과 똑같은 크기로 보인다 */
const ROOM_STAGE_DIFF = 0

/** 파티 친구 크기: 달리기 친구와 같은 기준(아바타 키의 2/3)에서 0.8배 */
const PARTY_GUEST_SCALE = 0.8

/** 방에 한 번에 보이는 보물 수 */
const MAX_SHOWN = 5
const PICK_R = 70 // 이 거리(px) 안을 지나가면 줍는다

interface Props {
  paused?: boolean
  placeId: string
  assign: Record<string, string[]>
  outfit: Outfit
  tweaks: Tweaks
  onExit: () => void
  onWear: (id: string) => void
  /** 이 장소 테마로 방 꾸미기를 연다 */
  onDecorate?: (placeId: string) => void
  /** 파티 친구 주문을 만들러 주방 탭으로 */
  onKitchen?: () => void
}

export function TravelScene({ placeId, assign, outfit, tweaks, onExit, onWear, onDecorate, onKitchen, paused = false }: Props) {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  useGame()
  const night = false // 낮만 쓴다 (저녁·밤 기능은 뺐다)
  const roomVersion = useSyncExternalStore(subscribeTravelRooms, travelRoomsVersion)
  const itemVersion = useItemsVersion()
  // 내 방은 아직 게임으로 보낸 방이 없어도 빈 방 무대로 보여 준다(꽉 채운 화면으로 그리면 가로 화면에서 너무 크게 확대된다)
  // roomVersion·itemVersion 은 보낸 방·소품이 바뀌면 다시 읽으라는 신호(값은 안 쓴다)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => getTravelRoom(placeId) ?? (placeId === MY_ROOM_ID ? { scene: 'room' as const, room: { ...defaultRoom(), items: [] } } : null), [placeId, roomVersion, itemVersion])
  const assets = layout ? sceneAssets(layout.scene, (layout.scene === 'camp' || layout.room.wallId === 'camp') ? night : layout.room.night, layout.room.wallId, layout.room.floorId) : null
  const minY = assets ? Math.min(88, 100 - assets.floorH / ROOM_H * 100 + 2) : WALK_BOUNDS.minY
  const p = PLACE_BY_ID[placeId]
  // 가로로 넓은 화면: 장소 그림(세로 그림)을 늘려 꽉 채우면 너무 크게 확대돼 보이므로, 방처럼 세로 무대에 그리고 양옆은 그림을 이어 붙여 채운다
  const rootRef = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)
  // 무대 양옆으로 이어 붙인 그림이 보이는 만큼(무대 너비에 대한 %): 그 자리까지 걸어 다닐 수 있다
  const [sideX, setSideX] = useState(0)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      setWide(el.clientWidth > el.clientHeight)
      const box = boxRef.current
      setSideX(box && box.clientWidth ? Math.max(0, (el.clientWidth / box.clientWidth - 1) * 50) : 0)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el); if (boxRef.current) ro.observe(boxRef.current); measure()
    return () => ro.disconnect()
  }, [])
  const stage = !!layout || wide
  const bg = assets ?? { wall: assetUrl(night && p.wallNight ? p.wallNight : p.wall), floor: assetUrl(p.floor), floorH: p.floorH }
  const ids = assign[placeId] ?? []
  // 방에 한 번에 보이는 보물은 5개까지: 아직 못 찾은 것 앞에서부터 5개, 하나 찾으면 다음 것이 나온다(자리는 원래 순서 그대로)
  const shownOf = (found: string[]) => new Set(ids.filter((id) => !found.includes(id)).slice(0, MAX_SHOWN))
  const shown = shownOf(getGame().found)

  const [pos, setPos] = useState<Vec>(() => layout ? { x: clampToBounds({ x: layout.room.avatar.x / ROOM_W * 100, y: 86 }).x, y: Math.max(minY, Math.min(100, layout.room.avatar.y / ROOM_H * 100)) } : { x: 20, y: 86 })
  const [dir, setDir] = useState<1 | -1>(layout?.room.avatar.flip ? -1 : 1)
  const [walking, setWalking] = useState(false)
  const [destination, setDestination] = useState<Vec | null>(null)
  const [popup, setPopup] = useState<string | null>(null)
  // 파티: 초대 창에서 고른 카페 동물 친구들이 집에 들어와 돌아다니며 이야기한다.
  // 누가 와 있는지는 저장해 두어서, 주방에 다녀오거나 집을 나갔다 와도 친구들이 그대로 기다린다
  const [inviting, setInviting] = useState(false)
  const partyNow = useSyncExternalStore(subscribeParty, getParty)
  // 파티에는 수학으로 모은 친구만 초대할 수 있다(친구 모으기)
  const meet = useSyncExternalStore(subscribeMeet, getMeet)
  const party = useMemo(() => (partyNow.place === placeId ? partyNow.guests : []), [partyNow, placeId])
  const [settled] = useState(party) // 이 화면을 열 때 이미 와 있던 친구들
  const [partyEnd, setPartyEnd] = useState(false)
  // 파티 친구 주문(주방 주문서): 주문받기 → 주방에서 만들기 → 같이 먹기
  const kitchen = useSyncExternalStore(subscribeKitchen, getKitchen)
  const orders = useMemo(() => Object.fromEntries(kitchen.tickets.filter((t) => isPartySeat(t.seat) && party.includes(ticketAnimal(t.seat))).map((t) => [ticketAnimal(t.seat), { menu: t.menu, ready: t.ready }])), [kitchen, party])
  const [eating, setEating] = useState<Record<number, string> | null>(null)
  const [announce, setAnnounce] = useState<{ id: number; lines: [number, string][] } | null>(null)
  const sayAll = (lines: [number, string][]) => setAnnounce((a) => ({ id: (a?.id ?? 0) + 1, lines }))
  const unordered = party.filter((a) => !orders[a])
  const cookingLeft = Object.values(orders).some((o) => !o.ready)
  const readyOnes = party.filter((a) => orders[a]?.ready)
  const takeOrders = () => {
    const lines: [number, string][] = []
    for (const a of unordered) {
      const menu = partyWish()
      if (actKitchen({ type: 'order', seat: PARTY_SEAT + a, menu }) === 'saved') lines.push([a, orderLine(menuById(menu)!.ko)])
    }
    if (!lines.length) return
    playOrder()
    sayAll(lines)
  }
  // 같이 먹기: 다 만든 음식을 친구들에게 나눠 주고, 아바타도 같이 먹는다(몇 초 뒤 접시가 비워진다)
  const eatTogether = () => {
    const got: Record<number, string> = {}
    for (const a of readyOnes) if (actKitchen({ type: 'serve', seat: PARTY_SEAT + a }) === 'saved') got[a] = orders[a].menu
    const who = Object.keys(got).map(Number)
    if (!who.length) return
    playServe()
    setEating(got)
    sayAll(who.map((a) => [a, eatLine(kidName)]))
    window.setTimeout(() => setEating(null), Math.max(6000, who.length * 1600 + 2500))
  }
  const endParty = () => {
    for (const t of getKitchen().tickets) if (isPartySeat(t.seat)) actKitchen({ type: 'cancel', seat: t.seat })
    setPartyState({ place: null, guests: [] })
    setPartyEnd(false)
    setEating(null)
  }
  useSyncExternalStore(subscribeAvatar, avatarVersion)
  const kidName = avatarName(getAvatar())

  const posRef = useRef(pos)
  const target = useRef<Vec | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const blocked = !!popup || paused
  // 찾았다 상자는 0.7초 뒤에 저절로 사라진다
  useEffect(() => {
    if (!popup) return
    const id = window.setTimeout(() => setPopup(null), FOUND_POP_MS)
    return () => clearTimeout(id)
  }, [popup])

  const pick = useCallback((id: string) => {
    if (findItem(id)) {
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
      // 지나가다 가까워지면 줍는다
      const me = posRef.current
      const g = getGame()
      const near = shownOf(g.found)
      const hitSpot = ids.findIndex((id, i) => near.has(id) && distPx(me, spotFor(id, i)) < PICK_R)
      if (hitSpot >= 0) {
        target.current = null
        setWalking(false)
        setDestination(null)
        pick(ids[hitSpot])
        return
      }
      if (target.current) frame.current = requestAnimationFrame(tick)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids, pick],
  )

  const walkTo = (v: Vec) => {
    if (blocked) return
    // 가로 화면에서는 무대 양옆(이어 붙인 그림)까지 화면 끝 가까이 걸어갈 수 있다
    target.current = { x: Math.min(WALK_BOUNDS.maxX + sideX, Math.max(WALK_BOUNDS.minX - sideX, v.x)), y: Math.min(layout ? 100 : WALK_BOUNDS.maxY, Math.max(minY, v.y)) }
    setDestination(target.current)
    setWalking(true)
    cancelAnimationFrame(frame.current)
    last.current = performance.now()
    frame.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const onTap = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, [role=dialog]')) return
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

  const got = ids.filter((id) => isFound(id)).length
  const scale = depthScale(pos.y)
  const avatarLayer = layout ? Math.round(Math.max(10000, ...drawables(layout.room).map(d => d.z))) + 1 : 1000
  const collected = popup ? travelItem(popup) : undefined

  return (
    <div ref={rootRef} className="relative flex h-full items-center justify-center overflow-hidden rounded-3xl bg-white/60 shadow-inner ring-1 ring-black/5" style={{ containerType: 'size' }} onPointerUp={onTap}>
      {stage && <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ width: `min(100cqw, calc((100cqh - ${ROOM_STAGE_DIFF}dvh) * ${ROOM_W / ROOM_H}))`, aspectRatio: `${ROOM_W} / ${ROOM_H}` }}>
          {[-1, 0, 1].flatMap(ky => [-2, -1, 0, 1, 2].map(k => ({ k, ky }))).filter(({ k, ky }) => k || ky).map(({ k, ky }) => <div key={`${k}_${ky}`} className="absolute" style={{ left: `calc(${k * 100}% - 1px)`, top: `calc(${ky * 100}% - 1px)`, width: 'calc(100% + 2px)', height: 'calc(100% + 2px)', transform: `scale(${Math.abs(k) % 2 ? -1 : 1}, ${ky ? -1 : 1})` }}>
            {/* 가운데 무대와 같은 순서로 겹친다(방은 바닥 위에 벽, 장소는 벽 위에 바닥) */}
            {!assets && <img src={bg.wall} alt="" draggable={false} className="absolute inset-0 h-full w-full" />}
            <img src={bg.floor} alt="" draggable={false} className="absolute inset-x-0 bottom-0 w-full" style={{ height: `${bg.floorH / ROOM_H * 100}%` }} />
            {assets && <img src={bg.wall} alt="" draggable={false} className="absolute inset-0 h-full w-full" />}
          </div>)}
        </div>
      </div>}
      <div ref={boxRef} tabIndex={0} aria-label={lang === 'ko' ? p.ko : p.en} {...keys} className={`relative isolate touch-none select-none ${stage ? '' : 'h-full w-full'}`} style={stage ? { width: `min(100cqw, calc((100cqh - ${ROOM_STAGE_DIFF}dvh) * ${ROOM_W / ROOM_H}))`, aspectRatio: `${ROOM_W} / ${ROOM_H}` } : undefined}>
        {assets ? <>
          <img src={assets.floor} alt="" className="absolute inset-x-0 bottom-0 w-full" style={{ height: `${assets.floorH / ROOM_H * 100}%` }} draggable={false} />
          <img src={assets.wall} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
        </> : <>
          <img src={assetUrl(night && p.wallNight ? p.wallNight : p.wall)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
          <img src={assetUrl(p.floor)} alt="" className="absolute inset-x-0 bottom-0 w-full" style={{ height: `${p.floorH / ROOM_H * 100}%` }} draggable={false} />
        </>}
        {layout ? drawables(layout.room).filter(d => d.group !== 'avatar').map(d => <img key={d.key} src={d.src ? assetUrl(d.src) : undefined} alt="" draggable={false} className="pointer-events-none absolute" style={{ left: `${d.left / ROOM_W * 100}%`, top: `${d.top / ROOM_H * 100}%`, width: `${d.w / ROOM_W * 100}%`, height: `${d.h / ROOM_H * 100}%`, zIndex: Math.round(d.z), transform: d.flip ? 'scaleX(-1)' : undefined }} />) : <TravelDecor placeId={placeId} />}

        {ids.map((id, i) => {
          if (!shown.has(id)) return null
          const s = spotFor(id, i)
          return (
            <button
              key={id}
              aria-label={lang === 'ko' ? '반짝이는 아이템 줍기' : 'Collect sparkling item'}
              disabled={blocked}
              onClick={() => {
                if (blocked) return
                playTap()
                if (s.y < minY) {
                  stop()
                  pick(id)
                } else walkTo(s)
              }}
              className={`sparkle ${night ? 'sparkle-night' : ''} absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-2xl`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, zIndex: layout ? 10000 : 110 }}
            >
              <span aria-hidden>✨</span>
            </button>
          )
        })}

        {party.length > 0 && (
          <PartyGuests
            invite={party}
            leave={partyEnd}
            kid={kidName}
            me={pos}
            // 장소 그림은 바닥(풀밭 등) 그림이 시작하는 곳보다 조금 아래부터: 하늘에 떠 보이지 않게
            floor={{ minX: 8 - sideX, maxX: 92 + sideX, minY: layout ? minY + 2 : Math.max(minY, 100 - p.floorH / ROOM_H * 100 + 8), maxY: layout ? 96 : WALK_BOUNDS.maxY }}
            // 동물 키는 그 자리에 선 아바타 키의 2/3(아바타 크기가 방·깊이마다 바뀌면 같이 바뀐다). 아바타보다 아래(앞)에 있으면 아바타 앞에 그린다
            size={(y) => GUEST_PER_AVATAR_W * PARTY_GUEST_SCALE * (layout ? AVATAR_BASE_W * layout.room.avatar.scale / ROOM_W * 100 : 30 * depthScale(y))}
            z={(y) => avatarLayer + (y >= posRef.current.y ? 1 : -1)}
            onGone={endParty}
            settled={settled}
            orders={orders}
            eating={eating}
            announce={announce}
          />
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
            {/* 같이 먹는 동안 아바타도 음식을 하나 들고 있다(카페에서 서빙할 때 드는 자리). 옷·머리 층보다 위에 그려 손 앞에 오게 */}
            {eating && Object.values(eating)[0] && <span aria-hidden className="party-yum absolute block" style={{ left: '76%', top: '42%', width: '41%', zIndex: 1000 }}><Ico id={Object.values(eating)[0]} className="h-auto w-full" /></span>}
          </div>
        </div>
      </div>

      <div className="absolute top-2 left-2 right-24 z-30 flex min-w-0 flex-wrap items-center gap-2">
        <button onClick={onExit} className="flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-white/90 px-3 py-2 text-sm font-bold shadow-md ring-1 ring-black/5">
          <span aria-hidden>🗺️</span>
          {tx.map}
        </button>
        {onDecorate && (
          <button onClick={() => onDecorate(placeId)} className="flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-white/90 px-3 py-2 text-sm font-bold shadow-md ring-1 ring-black/5">
            <span aria-hidden>🏠</span>
            {tx.decorate}
          </button>
        )}
        <button onClick={() => { playTap(); setInviting(true) }} disabled={partyEnd} className="flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-[#ff8fab] px-3 py-2 text-sm font-bold text-white shadow-md disabled:opacity-50">
          <span aria-hidden>🎉</span>
          {lang === 'ko' ? '파티 초대' : 'Party'}
        </button>
        {/* 파티 음식: 주문받기 → 주방에서 만들기 → 같이 먹기 */}
        {party.length > 0 && !partyEnd && !eating && unordered.length > 0 && (
          <button onClick={() => { playTap(); takeOrders() }} className="flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-[#ffd166] px-3 py-2 text-sm font-bold text-[#7a4a12] shadow-md">
            <span aria-hidden>📝</span>
            {lang === 'ko' ? '주문받기' : 'Take orders'}
          </button>
        )}
        {party.length > 0 && !partyEnd && cookingLeft && onKitchen && (
          <button onClick={() => { playTap(); onKitchen() }} className="flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-white/90 px-3 py-2 text-sm font-bold text-[#8a4b2a] shadow-md ring-1 ring-black/5">
            <span aria-hidden>🍳</span>
            {lang === 'ko' ? '주방에서 만들기' : 'Cook'}
          </button>
        )}
        {party.length > 0 && !partyEnd && !eating && readyOnes.length > 0 && (
          <button onClick={() => { playTap(); eatTogether() }} className="flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-[#7bc96f] px-3 py-2 text-sm font-bold text-white shadow-md">
            <span aria-hidden>🍽️</span>
            {lang === 'ko' ? '같이 먹기' : 'Eat together'}
          </button>
        )}
        {party.length > 0 && !partyEnd && (
          <button onClick={() => { playTap(); setPartyEnd(true) }} className="flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-white/90 px-3 py-2 text-sm font-bold shadow-md ring-1 ring-black/5">
            <span aria-hidden>👋</span>
            {lang === 'ko' ? '파티 끝' : 'Bye'}
          </button>
        )}
        <span className="rounded-full bg-white/90 px-3 py-2 text-sm font-bold shadow-md ring-1 ring-black/5">
          {p.icon} {lang === 'ko' ? p.ko : p.en}{ids.length > 0 && <> · {tx.found} {got}/{ids.length}</>}
        </span>
      </div>

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
      {inviting && <PartyInvite here={party} locked={CALL_ANIMALS.map((_, i) => i).filter((i) => !meet.met.includes(i))}
        note={meet.met.length ? `수학으로 모은 친구만 초대할 수 있어요 · 모은 친구 ${meet.met.length}/${CALL_ANIMALS.length}` : '아직 모은 친구가 없어요. 수학 문제를 10개 풀 때마다 친구를 한 명씩 만나요!'} onClose={() => setInviting(false)} onInvite={(animals) => {
        setInviting(false)
        // 다른 장소에서 하던 파티는 끝낸다(그 친구들 주문서도 지운다)
        if (partyNow.place && partyNow.place !== placeId) for (const t of getKitchen().tickets) if (isPartySeat(t.seat)) actKitchen({ type: 'cancel', seat: t.seat })
        setPartyState({ place: placeId, guests: [...party, ...animals.filter((a) => !party.includes(a))] })
      }} />}
    </div>
  )
}

