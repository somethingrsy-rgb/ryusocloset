/**
 * 친구가 부른 곳에 놀러 간 화면(같이 놀기): 친구가 꾸민 방이나 친구가 있는 장소(핼러윈 집·궁전…)를 그대로 보여 주고,
 * 걸어 다니며 같이 간식을 먹고 칭찬한다. 앱 어느 탭에서든 초대장을 「수락」하면 화면 위에 뜬다(App 이 그린다). 「돌아가기」로 원래 화면으로.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react'
import { assetUrl } from '../lib/items'
import { sceneAssets } from '../lib/exportRoom'
import { defaultRoom, drawables, sanitizeRoom } from '../lib/room'
import { AVATAR_BASE_W, AVATAR_FEET_RATIO, ROOM_H, ROOM_W } from '../lib/roomTypes'
import { WALK_BOUNDS, depthScale, stepToward, type Vec } from '../lib/walk'
import { PLACE_BY_ID } from '../lib/game'
import { TravelDecor } from './TravelDecor'
import { playServe, playTap } from '../lib/sound'
import { eatFood, getMp, leaveVisit, putFood, say, setEating, setWhere, subscribeMp } from '../lib/mp/session'
import type { Food } from '../lib/mp/core'
import type { Outfit, Tweaks } from '../lib/types'
import { FigureLayers } from './FigureLayers'
import { FoodPicker, HomeFriends, menuName } from './HomeFriends'
import { Ico } from './CafeGame'

/** 받은 집 데이터 → 꾸민 방(room) 또는 장소 그림(place) */
export function homeScene(raw: unknown) {
  const r = (raw ?? {}) as { scene?: unknown; room?: unknown; place?: unknown; title?: unknown }
  const title = typeof r.title === 'string' ? r.title.slice(0, 20) : null
  if (r.scene === 'place' && typeof r.place === 'string' && Object.hasOwn(PLACE_BY_ID, r.place)) return { kind: 'place' as const, placeId: r.place, place: PLACE_BY_ID[r.place], title }
  return { kind: 'room' as const, scene: r.scene === 'camp' ? 'camp' as const : 'room' as const, room: sanitizeRoom(r.room, { ...defaultRoom(), items: [] }), title }
}

export function HomeVisit({ outfit, tweaks }: { outfit: Outfit; tweaks: Tweaks }) {
  const mp = useSyncExternalStore(subscribeMp, getMp)
  const host = mp.visiting!
  const hostName = mp.players[host]?.name ?? mp.home?.name ?? '친구'
  // 이 화면에 있는 동안 나는 그 집에 있다
  // (돌아갈 때는 leaveVisit 이 원래 있던 곳으로 되돌린다)
  useEffect(() => { setWhere('home', host) }, [host])
  const where = useMemo(() => (mp.home ? homeScene(mp.home.room) : null), [mp.home])
  const layout = where?.kind === 'room' ? where : null
  const place = where?.kind === 'place' ? where : null
  const title = where?.title ?? '집'
  const myHouse = !place && (!where?.title || where.title === '우리집')
  const label = myHouse ? `${hostName}네 집` : `${title} · ${hostName}`
  // 장소 그림은 주인 화면처럼: 세로 화면이면 꽉 채우고, 가로 화면이면 방 무대 크기
  const rootRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)
  // 무대 양옆·아래로 이어 붙인 바닥이 보이는 만큼(무대에 대한 %): 그 바닥까지 걸어간다
  const [side, setSide] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const el = rootRef.current; if (!el) return
    const ro = new ResizeObserver(() => {
      setWide(el.clientWidth > el.clientHeight)
      const b = boxRef.current
      setSide(b && b.clientWidth && b.clientHeight ? { x: Math.max(0, (el.clientWidth / b.clientWidth - 1) * 50), y: Math.max(0, (el.clientHeight / b.clientHeight - 1) * 50) } : { x: 0, y: 0 })
    })
    ro.observe(el); if (boxRef.current) ro.observe(boxRef.current)
    return () => ro.disconnect()
  }, [where?.kind])
  // 집이 닫혔는지: 처음 조금 기다렸다가도 없으면
  const [waited, setWaited] = useState(false)
  useEffect(() => { const t = setTimeout(() => setWaited(true), 4000); return () => clearTimeout(t) }, [])
  const assets = layout ? sceneAssets(layout.scene, layout.room.night, layout.room.wallId, layout.room.floorId) : null
  const minY = assets ? Math.min(88, 100 - assets.floorH / ROOM_H * 100 + 2) : WALK_BOUNDS.minY
  const maxY = layout ? 98 : WALK_BOUNDS.maxY
  const avW = (y: number) => (layout ? AVATAR_BASE_W * layout.room.avatar.scale / ROOM_W * 100 : 30 * depthScale(y))
  const feet = layout ? AVATAR_FEET_RATIO : 1
  const z = layout ? Math.round(Math.max(10000, ...drawables(layout.room).map((d) => d.z))) + 1 : 1000

  // 걷기: 누른 곳으로
  const [pos, setPos] = useState<Vec>({ x: 30 + Math.random() * 20, y: 86 })
  const [dir, setDir] = useState<1 | -1>(1)
  const [walking, setWalking] = useState(false)
  const posRef = useRef(pos)
  const target = useRef<{ v: Vec; then?: () => void } | null>(null)
  const raf = useRef(0)
  const last = useRef(0)
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last.current) / 1000)
    last.current = now
    const t = target.current
    if (!t) return
    const r = stepToward(posRef.current, t.v, dt)
    if (r.pos.x !== posRef.current.x) setDir(r.pos.x < posRef.current.x ? -1 : 1)
    posRef.current = r.pos
    setPos(r.pos)
    if (r.arrived) { target.current = null; setWalking(false); t.then?.(); return }
    raf.current = requestAnimationFrame(tick)
  }
  const walkTo = (v: Vec, then?: () => void) => {
    const el = rootRef.current, b = boxRef.current
    const sd = el && b && b.clientWidth && b.clientHeight ? { x: Math.max(0, (el.clientWidth / b.clientWidth - 1) * 50), y: Math.max(0, (el.clientHeight / b.clientHeight - 1) * 50) } : side
    target.current = { v: { x: Math.max(3 - sd.x, Math.min(97 + sd.x, v.x)), y: Math.max(minY, Math.min(maxY + sd.y, v.y)) }, then }
    setWalking(true)
    cancelAnimationFrame(raf.current)
    last.current = performance.now()
    raf.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  const onTap = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, [role=dialog]')) return
    const r = boxRef.current?.getBoundingClientRect()
    if (!r) return
    walkTo({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
  }
  // 간식: 놓기 · 먹기
  const [picking, setPicking] = useState(false)
  const [myEat, setMyEat] = useState<string | null>(null)
  useEffect(() => { if (!myEat) return; const t = setTimeout(() => setMyEat(null), 4000); return () => clearTimeout(t) }, [myEat])
  const eat = (f: Food) => walkTo({ x: f.x + (posRef.current.x < f.x ? -6 : 6), y: f.y }, () => {
    if (!getMp().foods.some((x) => x.id === f.id)) return // 친구가 먼저 먹었다
    eatFood(f.id); setEating(f.menu); setMyEat(f.menu); playServe()
    say(`😋 ${menuName(f.menu)} 냠냠! 맛있다`)
  })
  const [hearts, setHearts] = useState(0)
  const btn = 'flex flex-none items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold shadow-md'
  return (
    <div ref={rootRef} role="region" aria-label={`${label}에 놀러 옴`} className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-3xl bg-[#fdf3f6]" style={{ containerType: 'size' }} onPointerUp={onTap}>
      {/* 방 무대 둘레는 주인 화면처럼 벽지·바닥을 거울처럼 이어 붙여 채운다(세로 화면에서 위아래가 비어 보이지 않게) */}
      {where && (layout ? !!assets : !!place && wide) && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative" style={{ width: `min(100cqw, calc(100cqh * ${ROOM_W / ROOM_H}))`, aspectRatio: `${ROOM_W} / ${ROOM_H}` }}>
            {[-2, -1, 0, 1, 2].flatMap((ky) => [-2, -1, 0, 1, 2].map((k) => ({ k, ky }))).filter(({ k, ky }) => k || ky).map(({ k, ky }) => {
              const wall = layout ? assets!.wall : assetUrl(place!.place.wall)
              const floor = layout ? assets!.floor : assetUrl(place!.place.floor)
              const floorH = layout ? assets!.floorH : place!.place.floorH
              return (
                <div key={`${k}_${ky}`} className="absolute" style={{ left: `calc(${k * 100}% - 1px)`, top: `calc(${ky * 100}% - 1px)`, width: 'calc(100% + 2px)', height: 'calc(100% + 2px)', transform: `scale(${Math.abs(k) % 2 ? -1 : 1}, ${Math.abs(ky) % 2 ? -1 : 1})` }}>
                  {!layout && <img src={wall} alt="" draggable={false} className="absolute inset-0 h-full w-full" />}
                  <img src={floor} alt="" draggable={false} className="absolute inset-x-0 bottom-0 w-full" style={{ height: `${floorH / ROOM_H * 100}%` }} />
                  {layout && <img src={wall} alt="" draggable={false} className="absolute inset-0 h-full w-full" />}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {where && (layout ? !!assets : !!place) ? (
        <div ref={boxRef} className={`relative isolate touch-none select-none ${layout || wide ? '' : 'h-full w-full'}`} style={layout || wide ? { width: `min(100cqw, calc(100cqh * ${ROOM_W / ROOM_H}))`, aspectRatio: `${ROOM_W} / ${ROOM_H}` } : undefined}>
          {layout && assets && <>
            <img src={assets.floor} alt="" draggable={false} className="absolute inset-x-0 bottom-0 w-full" style={{ height: `${assets.floorH / ROOM_H * 100}%` }} />
            <img src={assets.wall} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
            {drawables(layout.room).filter((d) => d.group !== 'avatar').map((d) => <img key={d.key + d.left} src={d.src ? assetUrl(d.src) : undefined} alt="" draggable={false} className="pointer-events-none absolute" style={{ left: `${d.left / ROOM_W * 100}%`, top: `${d.top / ROOM_H * 100}%`, width: `${d.w / ROOM_W * 100}%`, height: `${d.h / ROOM_H * 100}%`, zIndex: Math.round(d.z), transform: d.flip ? 'scaleX(-1)' : undefined }} />)}
          </>}
          {place && <>
            <img src={assetUrl(place.place.wall)} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
            <img src={assetUrl(place.place.floor)} alt="" draggable={false} className="absolute inset-x-0 bottom-0 w-full" style={{ height: `${place.place.floorH / ROOM_H * 100}%` }} />
            <TravelDecor placeId={place.placeId} />
          </>}
          <HomeFriends host={host} me={pos} dir={dir} walking={walking} w={avW} feet={feet} z={(y) => z + (y >= pos.y ? 1 : -1)} onFood={eat} />
          <div className="pointer-events-none absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${avW(pos.y)}%`, aspectRatio: '1024 / 1536', transform: `translate(-50%, -${feet * 100}%)`, zIndex: z }}>
            <div className="relative h-full w-full" style={{ transform: `scaleX(${dir})` }}>
              <div className={`h-full w-full ${walking ? 'walk-bob' : ''}`}><FigureLayers outfit={outfit} tweaks={tweaks} animate={false} /></div>
              {myEat && <span aria-hidden className="party-yum absolute block" style={{ left: '76%', top: '42%', width: '41%', zIndex: 1000 }}><Ico id={myEat} className="h-auto w-full" /></span>}
            </div>
          </div>
          {hearts > 0 && <span key={hearts} aria-hidden className="pointer-events-none absolute text-4xl" style={{ left: `${pos.x}%`, top: `${pos.y - 45}%`, zIndex: z + 5, animation: 'float-up 1.4s ease-out forwards' }}>💖</span>}
        </div>
      ) : (
        <p className="m-0 rounded-2xl bg-white/95 px-4 py-3 text-center text-sm font-bold text-[#6b4b52] shadow">{waited ? `🚪 ${hostName}가 문을 닫았어요` : `🏠 ${hostName}에게 가는 중…`}</p>
      )}
      <div className="absolute top-2 left-2 right-2 z-[20000] flex flex-wrap items-center gap-2">
        <button onClick={() => { playTap(); leaveVisit() }} className={`${btn} bg-white/90 ring-1 ring-black/5`}>🚪 돌아가기</button>
        <span className={`${btn} bg-white/90 text-[#7a3d8f]`}>{place ? place.place.icon : '🏠'} {label}</span>
        {where && <>
          <button onClick={() => { playTap(); setPicking(true) }} className={`${btn} bg-[#ffd166] text-[#7a4a12]`}>🍰 간식 꺼내기</button>
          <button onClick={() => { playServe(); setHearts((h) => h + 1); say(myHouse ? `💖 ${hostName}네 방 정말 예뻐요!` : `💖 ${title} 정말 멋져요!`) }} className={`${btn} bg-[#ff8fab] text-white`}>💖 칭찬</button>
        </>}
      </div>
      {picking && <FoodPicker onClose={() => setPicking(false)} onPick={(m) => { setPicking(false); playTap(); putFood(m, Math.max(8, Math.min(92, pos.x + (Math.random() < 0.5 ? -18 : 18))), Math.max(minY + 4, Math.min(maxY - 1, pos.y + (Math.random() - 0.5) * 6))) }} />}
    </div>
  )
}
