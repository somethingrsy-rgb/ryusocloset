import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { extendReach, findItem, travelItem } from '../lib/game'
import { roadSpot } from '../lib/roadItems'
import { playOrder, playServe, playTap } from '../lib/sound'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { getAvatar } from '../lib/avatars'
import { canMeet, getMeet, pickVisitor, talkFor, talkedOnRoad, type Talk } from '../lib/meet'
import { GUEST_PER_AVATAR_W } from './PartyGuests'
import type { Outfit, Tweaks } from '../lib/types'
import {
  CHUNK_W,
  DOOR_Y,
  GROUND,
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
/** 이만큼(논리 px) 가까이 가면 친구가 말을 건다 */
const TALK_R = 170

/** 산책길에서 만난 동물 친구: 아바타 앞쪽에 나타나 그 근처를 천천히 돌아다닌다 */
interface Visitor { animal: number; x: number; y: number; home: number; moveMs: number; dir: 1 | -1; leaving: boolean }

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

  // 산책길 친구: 많이 걸었고 지난번 만남에서 시간이 넉넉히 지났으면 가끔 한 명이 앞쪽에 나타난다(lib/meet)
  const walked = useRef(0)
  const [visitor, setVisitor] = useState<Visitor | null>(null)
  const visitorRef = useRef(visitor)
  visitorRef.current = visitor
  /** 이야기: step 은 지금 묻는 질문(0·1), said 는 친구가 방금 한 답(첫 질문에 답하면 그 답과 함께 두 번째 질문을 한다), done 이면 끝 */
  const [talk, setTalk] = useState<{ animal: number; first: boolean; t: Talk; step: 0 | 1; said: string | null; done: boolean } | null>(null)
  const talkRef = useRef(talk)
  talkRef.current = talk
  // 친구는 자기 자리 근처를 천천히 거닌다(2~3.5초마다 옆으로 조금)
  useEffect(() => {
    if (!visitor || visitor.leaving || talk) return
    const t = window.setTimeout(() => {
      setVisitor((v) => {
        if (!v || v.leaving) return v
        const x = v.home + (Math.random() - 0.5) * 420, y = GROUND.minY + 20 + Math.random() * (GROUND.maxY - GROUND.minY - 30)
        return { ...v, x, y, moveMs: Math.max(600, Math.hypot(x - v.x, y - v.y) / 120 * 1000), dir: x < v.x ? -1 : 1 }
      })
    }, 2000 + Math.random() * 1500)
    return () => clearTimeout(t)
  }, [visitor, talk])
  const startTalk = (v: Visitor) => {
    const first = !getMeet().met.includes(v.animal) // 수학으로 모은 친구면 '또 만났네', 아니면 자기소개
    playOrder()
    setTalk({ animal: v.animal, first, t: talkFor(v.animal, getAvatar().name.ko, first), step: 0, said: null, done: false })
    setVisitor({ ...v, dir: posRef.current.x < v.x ? -1 : 1, moveMs: 0 })
  }
  const endTalk = () => {
    const v = visitorRef.current
    setTalk(null)
    // 손 흔들며 아바타 반대쪽으로 걸어 나간다
    if (v) {
      const away = v.x >= posRef.current.x ? 1 : -1
      setVisitor({ ...v, leaving: true, x: v.x + away * 900, moveMs: 2600, dir: away })
      window.setTimeout(() => setVisitor(null), 2600)
    }
  }

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
  const visibleRef = useRef(visibleW)
  visibleRef.current = visibleW
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
      walked.current += Math.abs(r.pos.x - posRef.current.x)
      // 친구가 없으면, 충분히 걸었고 시간이 지났을 때 가는 쪽 앞에 한 명 나타난다
      const v = visitorRef.current
      if (!v && canMeet(getMeet(), walked.current, Date.now())) {
        const ahead = r.pos.x >= posRef.current.x ? 1 : -1
        // 화면 안 가는 쪽 앞(보이는 너비의 38%쯤)에 나타나 아이가 볼 수 있게
        const x = Math.max(200, r.pos.x + ahead * Math.min(900, visibleRef.current * 0.38))
        const nv: Visitor = { animal: pickVisitor(), x, y: GROUND.minY + 40 + Math.random() * 80, home: x, moveMs: 0, dir: ahead === 1 ? -1 : 1, leaving: false }
        visitorRef.current = nv
        setVisitor(nv)
        walked.current = 0
      } else if (v && !v.leaving && !talkRef.current) {
        // 가까이 가면 말을 건다(걷기를 멈춘다). 멀리 지나쳐 가면 친구는 사라진다(다음에 다시)
        if (Math.hypot(r.pos.x - v.x, r.pos.y - v.y) < TALK_R) {
          posRef.current = r.pos
          setPos(r.pos)
          target.current = null
          setWalking(false)
          setDestination(null)
          startTalk(v)
          return
        }
        if (Math.abs(r.pos.x - v.x) > 2600) { visitorRef.current = null; setVisitor(null); walked.current = 0 }
      }
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
        onEnter(placeOfChunk(g).id, g)
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
    target.current = clampWalk(x, y, chunksRef.current)
    setDestination(target.current)
    setWalking(true)
    cancelAnimationFrame(frame.current)
    last.current = performance.now()
    frame.current = requestAnimationFrame(tick)
  }

  const onTap = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button') || talkRef.current) return
    hostRef.current?.focus({ preventScroll: true })
    const r = hostRef.current!.getBoundingClientRect()
    walkTo((e.clientX - r.left) / scale + cam, (e.clientY - r.top) / scale)
  }

  const stop = () => {
    cancelAnimationFrame(frame.current)
    target.current = null
    intent.current = null
    setWalking(false)
    setDestination(null)
  }
  useEffect(() => { if (paused) stop() }, [paused])
  const keys = useWalkKeys(
    (x, y) => walkTo(posRef.current.x + x * 120, posRef.current.y + y * 120),
    stop,
    !paused && !talk,
  )

  const figW = 145 * 1.5 * (0.8 + 0.2 * ((pos.y - 585) / 150))
  /** 화면 픽셀 한 칸 단위로 맞춘 값: 아바타 자리·크기가 소수점 픽셀로 조금씩 바뀌면 그림이 떨려 보였다 */
  const px = (v: number) => Math.round(v * scale) / scale
  const bgTiles = Array.from({ length: Math.floor((cam + visibleW) / BG_W) - Math.floor(cam / BG_W) + 1 }, (_, k) => Math.floor(cam / BG_W) + k)
  const range = Array.from({ length: lastChunk - first + 1 }, (_, k) => first + k)

  return (
    <div ref={hostRef} tabIndex={0} aria-label={lang === 'ko' ? '여행 마을, 방향키로 이동' : 'Village, move with arrow keys'} {...keys} className="travel-world relative h-full touch-none overflow-hidden rounded-3xl shadow-inner ring-1 ring-black/5 select-none" style={{ background: 'linear-gradient(#8fc3ee 0%, #bcd9a2 40%, #8fba5c 62%, #e5c98e 80%, #8fba5c 100%)' }} onPointerUp={onTap}>
      {/* 카메라는 화면 픽셀 단위로 맞춰 옮긴다(소수점 픽셀로 옮기면 큰 배경 그림이 프레임마다 다시 그려져 지지직거렸다) */}
      <div className="absolute top-0 left-0 origin-top-left" style={{ width: worldWidth(chunks), height: WORLD_H, transform: `scale(${scale}) translate3d(${-Math.round(cam * scale) / scale}px, 0, 0)`, willChange: 'transform' }}>
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
        {/* 산책길 친구: 아바타 키의 2/3×0.8 크기(파티와 같게). 이야기할 때·떠날 때는 손 흔드는 그림 */}
        {visitor && (() => {
          const w = 145 * 1.5 * (0.8 + 0.2 * ((visitor.y - 585) / 150)) * GUEST_PER_AVATAR_W * 0.8
          const a = CALL_ANIMALS[visitor.animal]
          const wave = !!talk || visitor.leaving
          return (
            <div aria-hidden className="pointer-events-none absolute" style={{ left: visitor.x, top: visitor.y, width: w, aspectRatio: '1 / 1', transform: 'translate(-50%, -99%)', zIndex: visitor.y > pos.y ? 1001 : 999, transition: `left ${visitor.moveMs}ms linear, top ${visitor.moveMs}ms linear, opacity 0.6s`, opacity: visitor.leaving ? 0.85 : 1 }}>
              <div className={`relative h-full w-full ${visitor.moveMs && !talk ? 'walk-bob' : ''}`} style={{ transform: `scaleX(${visitor.dir})` }}>
                {(['stand', 'wave'] as const).map((pose) => <img key={pose} src={assetUrl(`cafe/stand/${a.img}_${pose}.webp`)} alt="" draggable={false} className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_6px_4px_rgba(80,50,40,0.25)]" style={{ visibility: (pose === 'wave') === wave ? 'visible' : 'hidden' }} />)}
              </div>
              {!talk && !visitor.leaving && <span className="absolute -top-2 left-1/2 -translate-x-1/2 animate-bounce text-4xl">💬</span>}
            </div>
          )
        })()}
        <div
          className="pointer-events-none absolute"
          style={{ left: px(pos.x), top: px(pos.y), width: px(figW), aspectRatio: '1024 / 1536', transform: 'translate(-50%, -100%)', zIndex: 1000 }}
        >
          <div className="relative h-full w-full" style={{ transform: `scaleX(${dir})` }}>
            {/* 옷·머리 여러 장을 한 장으로 합쳐 움직인다(장마다 따로 기울이면 테두리가 반짝반짝 지지직거렸다) */}
            <div className={`h-full w-full ${walking ? 'walk-bob' : ''}`} style={{ willChange: 'transform' }}>
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
      {/* 친구와 짧은 이야기: 첫인사 → 묻는 말 → 대답 고르기 → 친구의 답(친구 모으기는 수학에서: 여기서는 이야기만) */}
      {talk && (() => {
        const a = CALL_ANIMALS[talk.animal]
        return (
          <div role="dialog" aria-label={`${a.name}랑 이야기`} onPointerUp={(e) => e.stopPropagation()} className="absolute inset-x-2 top-14 z-30 mx-auto flex max-w-md flex-col gap-2 rounded-3xl bg-white/95 p-3 shadow-xl">
            <div className="flex items-start gap-2">
              <img src={assetUrl(`cafe/face/${a.img}.webp`)} alt="" draggable={false} className="h-14 w-14 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="m-0 text-xs font-bold text-[#c06a7d]">{a.name}</p>
                <p className="m-0 text-base leading-snug font-bold text-[#6b4b52]">{talk.done ? talk.said : `${talk.said ?? talk.t.hello} ${talk.t.asks[talk.step].ask}`}</p>
              </div>
            </div>
            {!talk.done ? (
              <div className="flex flex-wrap justify-end gap-2">
                {talk.t.asks[talk.step].replies.map((rp) => <button key={rp.label} onClick={() => {
                  playTap()
                  if (talk.step === 0) { talkedOnRoad(); setTalk({ ...talk, step: 1, said: rp.answer }) } // 답하고 두 번째 질문
                  else setTalk({ ...talk, said: rp.answer, done: true })
                }} className="min-h-11 rounded-full bg-[#ffe1ea] px-4 text-sm font-bold text-[#8a4b55] shadow-sm">{rp.label}</button>)}
              </div>
            ) : (
              <>
                <button onClick={() => { playServe(); endTalk() }} className="min-h-11 self-end rounded-full bg-[#ff8fab] px-5 text-sm font-bold text-white shadow">👋 {lang === 'ko' ? '안녕~ 또 만나!' : 'Bye~ see you!'}</button>
              </>
            )}
          </div>
        )
      })()}
      <div className="absolute top-2 left-2 right-2 z-10 flex min-w-0 flex-wrap items-center gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1" onPointerUp={e => e.stopPropagation()}>{actions}</div>
      </div>
    </div>
  )
}

