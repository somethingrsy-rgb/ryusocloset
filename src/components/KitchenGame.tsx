import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { CALL_ANIMALS } from '../lib/animalCalls'
import { CROPS, getFarm, subscribeFarm } from '../lib/farm'
import { assetUrl } from '../lib/items'
import { buyPantry, cookTicket, getKitchen, missing, subscribeKitchen } from '../lib/kitchen'
import { PACK, PACK_PRICE, PANTRY, STEPS, ingredient, isCrop, menuById, needList, type IngId, type Station, type StepId } from '../lib/recipes'
import { playBell, playCloud, playCoin, playCook, playTap, playWater, startBgm, stopBgm } from '../lib/sound'
import type { Outfit, Tweaks } from '../lib/types'
import { Ico } from './CafeGame'
import { FigureLayers } from './FigureLayers'
import { CoinIcon } from './Icons'

/**
 * 그림 속 자리(그림 크기에 대한 %, 가운데·너비·높이). 세로 그림(폰)과 가로 그림(패드·폰 가로)이 다르다.
 * 아바타는 아일랜드 뒤에 서서 요리한다: cook 은 발 위치, island 는 그림에서 오려 낸 아일랜드(public/kitchen/island_*.webp)를 아바타 앞에 다시 덮는 자리(왼쪽·위·너비·높이 %).
 */
type Box = { x: number; y: number; w: number; h: number }
const SPOTS: Record<'portrait' | 'wide', { img: string; ratio: number; avatarH: number; at: Record<Station, Box>; ovenGlass: Box; fx: { ice: [number, number, number]; tap: [number, number, number]; pot: [number, number, number] }; cook: [number, number]; island: { img: string; l: number; t: number; w: number; h: number } }> = {
  portrait: {
    img: 'kitchen/kitchen_portrait.webp', ratio: 941 / 1672, avatarH: 24,
    at: { fridge: { x: 15.5, y: 31, w: 24, h: 32 }, sink: { x: 48, y: 36.5, w: 24, h: 7 }, stove: { x: 86, y: 33.5, w: 22, h: 6 }, oven: { x: 86.5, y: 44, w: 24, h: 12 }, board: { x: 50, y: 59, w: 40, h: 9 } },
    ovenGlass: { x: 86.7, y: 43.3, w: 14, h: 4.4 },
    // 효과 자리(그림 크기에 대한 %): ice = 냉장고 위칸 가운데 [x, y, 너비(문 폭의 1/3)], tap = 수도꼭지 끝 [x, 물이 나오는 y, 개수대 테두리 y(물방울이 여기서 사라진다)], pot = 냄비 [x, 냄비 바닥 y, 냄비 폭]
    fx: { ice: [14, 22, 6.9], tap: [47.8, 31, 33.6], pot: [86.1, 34.8, 10] },
    cook: [50, 62], island: { img: 'kitchen/island_portrait.webp', l: 12.221, t: 52.452, w: 75.452, h: 33.612 },
  },
  wide: {
    img: 'kitchen/kitchen_wide.webp', ratio: 1672 / 941, avatarH: 38,
    at: { fridge: { x: 19.7, y: 37, w: 16, h: 45 }, sink: { x: 49.3, y: 41.5, w: 15, h: 10 }, stove: { x: 81.6, y: 38, w: 14, h: 9 }, oven: { x: 83.4, y: 53.5, w: 15, h: 17 }, board: { x: 49.6, y: 60.5, w: 24, h: 12 } },
    ovenGlass: { x: 83.2, y: 53.6, w: 9, h: 7 },
    fx: { ice: [19.1, 23.4, 5], tap: [49.1, 34.3, 38.6], pot: [81.6, 40.5, 5.5] },
    cook: [50, 66], island: { img: 'kitchen/island_wide.webp', l: 24.342, t: 51.753, w: 51.017, h: 44.421 },
  },
}

const T = {
  ko: {
    title: '🍳 주방', pantry: '🛒 마트', cafe: '☕ 카페', farm: '🥕 농장에서 가져오기', buy: '🛒 마트에서 사기',
    noTickets: '카페에서 주문을 받아 오세요', pick: '👆 만들 주문서를 골라요', order: (n: string) => `${n}의 주문`,
    start: '🍳 요리 시작', step: (k: number, n: number) => `${k} / ${n} 단계`, done: (m: string) => `완성! ${m} 🎉`, serve: '☕ 카페에서 서빙하기',
    ready: '다 만들었어요! 카페에서 서빙해요', wrong: '여기를 눌러요 👇', lack: '재료가 모자라요', need: '필요한 재료', how: '만드는 순서',
    pantryTitle: '🛒 마트', pantryNote: `기본 재료는 ${PACK}개 묶음에 ${PACK_PRICE}코인`, farmNote: '농장 재료는 농장에서 수확해요', close: '닫기', noCoins: '코인이 모자라요. 농장에서 팔거나 카페에서 서빙해 모아요',
    next: '다음 주문 만들기',
  },
  en: {
    title: '🍳 Kitchen', pantry: '🛒 Mart', cafe: '☕ Cafe', farm: '🥕 Get from the farm', buy: '🛒 Buy at the mart',
    noTickets: 'Take orders in the cafe first', pick: '👆 Pick an order to cook', order: (n: string) => `${n}'s order`,
    start: '🍳 Start cooking', step: (k: number, n: number) => `Step ${k} / ${n}`, done: (m: string) => `${m} is ready! 🎉`, serve: '☕ Serve it in the cafe',
    ready: 'All done! Serve it in the cafe', wrong: 'Tap here 👇', lack: 'Not enough ingredients', need: 'Ingredients', how: 'Steps',
    pantryTitle: '🛒 Mart', pantryNote: `Basics: ${PACK} for ${PACK_PRICE} coins`, farmNote: 'Grow these on the farm', close: 'Close', noCoins: 'Not enough coins. Sell crops or serve guests',
    next: 'Cook the next order',
  },
}

interface Cooking { seat: number; step: number; taps: number }

/**
 * 주방: 카페에서 받은 주문서를 골라, 농장 재료와 기본 재료로 음식을 만든다.
 * 단계마다 그림 속 싱크대·도마·냄비·오븐·냉장고를 톡톡 눌러 만들고, 다 만들면 카페에서 서빙한다. 실패나 시간 제한은 없다.
 */
export function KitchenGame({ outfit, tweaks, onGo }: { outfit: Outfit; tweaks: Tweaks; onGo: (to: 'farm' | 'cafe') => void }) {
  const { lang } = useI18n()
  const tx = T[lang]
  const kitchen = useSyncExternalStore(subscribeKitchen, getKitchen)
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const secRef = useRef<HTMLElement>(null)
  const [wide, setWide] = useState(false)
  const [short, setShort] = useState(false) // 폰 가로처럼 낮은 화면: 요리 중 안내를 한 줄로 줄여 도마를 가리지 않게 한다
  useEffect(() => {
    const el = secRef.current
    if (!el) return
    const ro = new ResizeObserver(() => { setWide(el.clientWidth > el.clientHeight * 1.2); setShort(el.clientHeight < 520) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { startBgm('cafe'); return stopBgm }, [])

  const [sel, setSel] = useState<number | null>(null)
  const [cooking, setCooking] = useState<Cooking | null>(null)
  const [done, setDone] = useState<number | null>(null) // 방금 다 만든 자리
  const [pantry, setPantry] = useState(false)
  const [toast, setToast] = useState('')
  const [shake, setShake] = useState<Station | null>(null)
  const [busy, setBusy] = useState(false) // 요리 단계가 바뀔 때 아바타가 통통
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const say = (t: string) => { setToast(t); later(() => setToast((x) => (x === t ? '' : x)), 2400) }

  // 주문서: 아직 안 만든 것 먼저, 그다음 다 만든 것
  const tickets = [...kitchen.tickets].sort((a, b) => Number(a.ready) - Number(b.ready) || a.seat - b.seat)
  // 고른 주문서가 없어지면(서빙함) 고르기를 푼다. 처음 들어오면 첫 주문서를 고른다
  const selTicket = sel === null ? undefined : kitchen.tickets.find((t) => t.seat === sel)
  useEffect(() => {
    if (cooking || done !== null) return
    if (!selTicket) setSel(kitchen.tickets.find((t) => !t.ready)?.seat ?? null)
  }, [kitchen.tickets, selTicket, cooking, done])

  const L = SPOTS[wide ? 'wide' : 'portrait']
  const bounce = () => { setBusy(true); later(() => setBusy(false), 650) }

  const menu = selTicket ? menuById(selTicket.menu) : undefined
  const lacks = selTicket ? missing(selTicket.menu, kitchen, farm) : []
  const step = cooking && menu ? STEPS[menu.steps[cooking.step]] : null

  const start = () => {
    if (!selTicket || !menu || lacks.length) return
    playCook()
    setCooking({ seat: selTicket.seat, step: 0, taps: 0 })
    bounce()
  }

  const tapStation = (s: Station) => {
    if (!cooking || !menu || !step) {
      if (s === 'fridge') { playTap(); setPantry(true) }
      return
    }
    if (s !== step.station) {
      playCloud(); setShake(step.station); later(() => setShake(null), 600); say(tx.wrong)
      return
    }
    const taps = cooking.taps + 1
    if (taps < step.taps) { if (menu.steps[cooking.step] === 'wash') playWater(); else playTap(); setCooking({ ...cooking, taps }); return }
    // 이 단계 끝: 다음 단계로, 마지막이면 완성
    const nextStep = cooking.step + 1
    if (nextStep < menu.steps.length) {
      playCook()
      setCooking({ ...cooking, step: nextStep, taps: 0 })
      bounce()
      return
    }
    if (!cookTicket(cooking.seat)) { playCloud(); say(tx.lack); setCooking(null); return }
    playBell()
    setDone(cooking.seat)
    setCooking(null)
    bounce()
  }

  const nextOrder = () => {
    playTap()
    setDone(null)
    setSel(kitchen.tickets.find((t) => !t.ready)?.seat ?? null)
    bounce()
  }

  const face = (seat: number) => assetUrl(`cafe/face/${CALL_ANIMALS[seat].img}.webp`)
  const btn = 'min-h-11 rounded-full px-3 font-bold shadow active:scale-95 disabled:opacity-40'
  const doneMenu = done !== null ? menuById(kitchen.tickets.find((t) => t.seat === done)?.menu ?? '') : undefined
  const [ax, ay] = L.cook
  // 마트에서 네온 테두리로 알려 줄 모자란 기본 재료: 아직 안 만든 주문서 전체에서
  const lackMart = new Set(kitchen.tickets.filter((t) => !t.ready).flatMap((t) => missing(t.menu, kitchen, farm)).map((x) => x.id).filter((id) => !isCrop(id)))
  const aw = L.avatarH * (1024 / 1536) / L.ratio // 아바타 너비(그림 너비에 대한 %)
  const boardIngs = cooking && menu ? needList(menu).map(({ id }) => id) : []
  // 도마 위 재료 줄보다 위에 나오는 도구: 섞기·말기는 두 손(조물조물), 믹서 돌리기는 믹서기, 갈기는 커피 그라인더
  const nowStep = cooking && menu ? menu.steps[cooking.step] : null
  const tool = nowStep ? BOARD_TOOL[nowStep] : undefined
  const kneading = !!tool

  return (
    <section ref={secRef} aria-label={tx.title} className="relative h-full overflow-clip rounded-3xl bg-[#e9b06c] ring-1 ring-black/5 select-none" style={{ containerType: 'size' }}>
      {/* 주방 그림: 화면을 꽉 채우고(넘치는 쪽은 조금 잘림) 가운데에 둔다. 그림 속 자리는 그림 크기에 대한 % 라 그대로 맞는다 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: `max(100cqw, calc(100cqh * ${L.ratio}))`, aspectRatio: `${L.ratio}` }}>
        <img src={assetUrl(L.img)} alt="" draggable={false} className="absolute inset-0 h-full w-full" />

        {(Object.keys(L.at) as Station[]).map((s) => {
          const b = L.at[s]
          const here = step?.station === s
          return (
            <button key={s} aria-label={s} onClick={() => tapStation(s)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-3xl border-0 bg-transparent p-0 ${here ? 'kitchen-here' : ''} ${shake === s ? 'call-shake' : ''}`}
              style={{ left: `${b.x}%`, top: `${b.y}%`, width: `${b.w}%`, height: `${b.h}%`, zIndex: 3 }}>
              {/* 가리키는 손: 보통은 위에서 아래로. 도마 위 도구나 수도꼭지 물방울과 겹치지 않게 그때는 오른쪽 옆에서 왼쪽으로 가리킨다 */}
              {here && ((kneading && s === 'board') || s === 'sink'
                ? <img aria-hidden src={assetUrl('kitchen/point.webp')} alt="" draggable={false} className="kitchen-point-side absolute top-1/2 left-full h-10 w-10 object-contain" />
                : <img aria-hidden src={assetUrl('kitchen/point.webp')} alt="" draggable={false} className="kitchen-point absolute bottom-full left-1/2 h-10 w-10 -translate-x-1/2 object-contain" />)}
            </button>
          )
        })}

        {/* 씻기: 수도꼭지에서 물방울이 개수대로 떨어진다 */}
        {nowStep === 'wash' && (
          <div aria-hidden className="pointer-events-none absolute -translate-x-1/2 overflow-hidden" style={{ left: `${L.fx.tap[0]}%`, top: `${L.fx.tap[1]}%`, height: `${L.fx.tap[2] - L.fx.tap[1]}%`, width: '2.4%', zIndex: 4 }}>
            {[0, 1].map((k) => <img key={k} src={assetUrl('kitchen/drop.svg')} alt="" draggable={false} className="kitchen-drop absolute left-0 w-full" style={{ animationDelay: `${k * 0.375}s` }} />)}
          </div>
        )}
        {/* 끓이기·녹이기: 냄비 아래에 작은 불꽃 셋 */}
        {(nowStep === 'boil' || nowStep === 'melt') && (
          <div aria-hidden className="pointer-events-none absolute flex -translate-x-1/2 items-end justify-center" style={{ left: `${L.fx.pot[0]}%`, top: `${L.fx.pot[1]}%`, width: `${L.fx.pot[2]}%`, zIndex: 4 }}>
            {[0, 1, 2].map((k) => <img key={k} src={assetUrl('kitchen/fire.webp')} alt="" draggable={false} className="kitchen-flame w-1/3 max-w-none object-contain" style={{ animationDelay: `${k * 0.15}s` }} />)}
          </div>
        )}
        {/* 굳히기: 냉장고 위칸 가운데에 얼음 */}
        {nowStep === 'chill' && (
          <img key={cooking!.taps} aria-hidden src={assetUrl('kitchen/ice.webp')} alt="" draggable={false} className="kitchen-press pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${L.fx.ice[0]}%`, top: `${L.fx.ice[1]}%`, width: `${L.fx.ice[2]}%`, aspectRatio: '1 / 1', zIndex: 4 }} />
        )}
        {/* 굽는 동안 오븐 유리창 안에 불꽃: 창 크기만큼, 누를수록 커진다 */}
        {cooking && menu?.steps[cooking.step] === 'bake' && (
          <div aria-hidden className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-end justify-center overflow-hidden" style={{ left: `${L.ovenGlass.x}%`, top: `${L.ovenGlass.y}%`, width: `${L.ovenGlass.w}%`, height: `${L.ovenGlass.h}%`, zIndex: 4 }}>
            {/* 창이 옆으로 길어서 불꽃 셋을 나란히(가운데가 제일 크게) 놓아 창을 꽉 채운다 */}
            {[0.65, 0.85, 0.65].map((k, i) => (
              <img key={i} src={assetUrl('kitchen/fire.webp')} alt="" draggable={false} className="kitchen-flame -mx-[3%] h-full w-auto max-w-none object-contain" style={{ height: `${k * 100}%`, animationDelay: `${i * 0.15}s`, transform: `scale(${0.8 + 0.25 * (cooking.taps / STEPS.bake.taps)})` }} />
            ))}
          </div>
        )}
        {/* 도마 위: 요리하는 동안은 재료, 다 만들면 완성된 음식 */}
        <div aria-hidden className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-0.5" style={{ left: `${L.at.board.x}%`, top: `${L.at.board.y - 1}%`, width: `${L.at.board.w}%`, zIndex: 4 }}>
          {doneMenu ? <Ico id={doneMenu.id} className="h-auto w-[30%] animate-bounce drop-shadow-lg" />
            : boardIngs.map((id) => <Ing key={id} id={id} className={`aspect-square w-[19%] ${step?.station === 'board' && cooking!.taps > 0 ? 'call-shake' : ''}`} />)}
        </div>
        {/* 도마 위 도구: 재료 바로 위(도마 안쪽)에 놓고, 누를 때마다 꾹 눌린다. 두 손은 계속 조물조물 움직인다. 재료와 겹치지 않게 재료 줄보다 위에 둔다 */}
        {tool && (
          <div key={cooking!.taps} aria-hidden className="kitchen-press pointer-events-none absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${L.at.board.x}%`, top: `${L.at.board.y - L.at.board.h * 0.35}%`, width: `${L.at.board.w * tool.w}%`, aspectRatio: '1 / 1', zIndex: 5 }}>
            {/* 칸을 정사각형으로 정해 둔다: 누를 때마다 새로 그려지는데, 그림을 다 읽기 전 칸 높이가 0 이면 위로 올리기(-100%)가 안 먹어 그림이 잠깐 도마 아래로 내려가 보였다 */}
            <img src={assetUrl(tool.img)} alt="" draggable={false} className={`${tool.img.includes('hands') ? 'kitchen-knead ' : ''}block h-full w-full object-contain`} />
          </div>
        )}

        {/* 내 아바타: 아일랜드 뒤에 서서 요리한다(아일랜드 그림을 아바타 앞에 한 번 더 덮어서 아래쪽이 가려진다) */}
        <div aria-hidden className="pointer-events-none absolute" style={{ left: `${ax}%`, top: `${ay}%`, width: `${aw}%`, aspectRatio: '1024 / 1536', transform: 'translate(-50%, -98%)', zIndex: 1 }}>
          <div className={busy ? 'farm-walk' : ''} style={{ position: 'relative', width: '100%', height: '100%' }}>
            <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
          </div>
        </div>
        <img aria-hidden src={assetUrl(L.island.img)} alt="" draggable={false} className="pointer-events-none absolute" style={{ left: `${L.island.l}%`, top: `${L.island.t}%`, width: `${L.island.w}%`, height: `${L.island.h}%`, zIndex: 2 }} />
      </div>

      {/* 위: 코인·마트·카페 */}
      <div className="absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-1.5">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-[#8a4b2a] shadow">{tx.title}</span>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm shadow"><CoinIcon /> <b>{farm.coins}</b></span>
          <button onClick={() => { playTap(); setPantry(true) }} className="h-9 rounded-full bg-white/90 px-3 text-sm font-bold shadow">{tx.pantry}</button>
          <button onClick={() => { playTap(); onGo('cafe') }} className="h-9 rounded-full bg-white/90 px-3 text-sm font-bold shadow">{tx.cafe}</button>
        </div>
      </div>

      {/* 주문서 보드 */}
      <div className="absolute inset-x-2 top-14 z-20 flex gap-2 overflow-x-auto pb-1">
        {tickets.length === 0 && <p className="m-0 rounded-2xl bg-white/90 px-3 py-2 text-sm font-bold text-[#8a4b2a] shadow">📝 {tx.noTickets}</p>}
        {tickets.map((t) => {
          const m = menuById(t.menu)!
          const on = sel === t.seat
          return (
            <button key={t.seat} aria-pressed={on} aria-label={`${CALL_ANIMALS[t.seat].name} ${m[lang]}`} disabled={!!cooking}
              onClick={() => { playTap(); setDone(null); setSel(t.seat) }}
              className={`relative flex w-[4.6rem] shrink-0 flex-col items-center rounded-2xl bg-[#fffaf0] px-1 pt-1 pb-1.5 shadow-md ring-2 transition active:scale-95 ${on ? 'ring-[#ef8d99]' : 'ring-transparent'} ${cooking && !on ? 'opacity-50' : ''}`}>
              <span aria-hidden className="absolute top-0 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ef6f86] shadow" />
              <span className="flex w-full items-center justify-between">
                <img src={face(t.seat)} alt="" draggable={false} className="h-7 w-7 object-contain" />
                <Ico id={m.id} className="h-9 w-9" />
              </span>
              <span className="mt-0.5 w-full truncate text-center text-[11px] leading-tight font-bold text-[#8a4b2a]">{m[lang]}</span>
              {t.ready && <span aria-hidden className="absolute -top-1.5 -right-1.5 text-lg">✅</span>}
            </button>
          )
        })}
      </div>

      {/* 아래: 고른 주문서의 레시피 · 요리 단계 · 완성 */}
      <div className="absolute inset-x-2 bottom-2 z-20 mx-auto max-w-md rounded-3xl bg-white/95 p-3 shadow-xl">
        {done !== null && doneMenu ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="m-0 text-lg font-black text-[#c04a5a]">{tx.done(doneMenu[lang])}</p>
            <div className="flex w-full gap-2">
              <button onClick={() => { playTap(); onGo('cafe') }} className={`${btn} flex-[1.3] bg-[#ef8d99] text-white`}><span className="text-sm">{tx.serve}</span></button>
              {kitchen.tickets.some((t) => !t.ready) && <button onClick={nextOrder} className={`${btn} flex-1 bg-[#fff1e0] text-[#8a4b2a]`}><span className="text-sm">{tx.next}</span></button>}
            </div>
          </div>
        ) : cooking && menu && step ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Ico id={menu.id} className={short ? 'h-8 w-8' : 'h-10 w-10'} />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-xs font-bold text-black/45">{menu[lang]} · {tx.step(cooking.step + 1, menu.steps.length)}</p>
                <p className="m-0 flex items-center gap-1 text-base font-black text-[#8a4b2a]"><StepIcon id={menu.steps[cooking.step]} className="h-6 w-6" /> {step.how[lang]}</p>
              </div>
              {short && <Dots n={step.taps} k={cooking.taps} />}
            </div>
            {!short && <Dots n={step.taps} k={cooking.taps} />}
            {!short && (
              <p className="m-0 flex flex-wrap justify-center gap-1 text-xs text-black/50">
                {menu.steps.map((s, k) => <span key={k} className={k === cooking.step ? 'font-black text-[#c04a5a]' : k < cooking.step ? 'line-through' : ''}><StepIcon id={s} className="inline-block h-4 w-4 align-[-2px]" /> {STEPS[s][lang]}{k < menu.steps.length - 1 ? ' →' : ''}</span>)}
              </p>
            )}
          </div>
        ) : selTicket && menu ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <img src={face(selTicket.seat)} alt="" draggable={false} className="h-9 w-9 object-contain" />
              <Ico id={menu.id} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-xs font-bold text-black/45">{tx.order(CALL_ANIMALS[selTicket.seat].name)}</p>
                <p className="m-0 truncate text-base font-black text-[#8a4b2a]">{menu[lang]} <span className="text-sm font-bold text-[#c9751f]">+{menu.price}<CoinIcon /></span></p>
              </div>
            </div>
            {selTicket.ready ? (
              <>
                <p className="m-0 text-center text-sm font-bold text-[#c04a5a]">✅ {tx.ready}</p>
                <button onClick={() => { playTap(); onGo('cafe') }} className={`${btn} bg-[#ef8d99] text-white`}>{tx.serve}</button>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5" aria-label={tx.need}>
                  {needList(menu).map(({ id, n }) => {
                    const ing = ingredient(id)
                    const have = isCrop(id) ? farm.inventory[id] : kitchen.pantry[id]
                    const ok = have >= n
                    return <span key={id} className={`flex items-center gap-1 rounded-full py-0.5 pr-2.5 pl-1 text-sm font-bold ${ok ? 'bg-[#e6f6e3] text-[#3d7a35]' : 'bg-[#ffe3e3] text-[#c0392b]'}`}><Ing id={id} className="h-6 w-6" /> {ing[lang]} {have}/{n} {ok ? '✔' : '✖'}</span>
                  })}
                </div>
                <p className="m-0 text-xs text-black/45">{tx.how}: {menu.steps.map((s, k) => <span key={k}>{k > 0 && ' → '}<StepIcon id={s} className="inline-block h-4 w-4 align-[-2px]" /> {STEPS[s][lang]}</span>)}</p>
                {lacks.length ? (
                  <div className="flex gap-2">
                    {lacks.some(({ id }) => isCrop(id)) && <button onClick={() => { playTap(); onGo('farm') }} className={`${btn} flex-1 bg-[#e6f6e3] text-[#3d7a35]`}>{tx.farm}</button>}
                    {lacks.some(({ id }) => !isCrop(id)) && <button onClick={() => { playTap(); setPantry(true) }} className={`${btn} flex-1 bg-[#fff1e0] text-[#8a4b2a]`}>{tx.buy}</button>}
                  </div>
                ) : <button onClick={start} className={`${btn} bg-[#ef8d99] text-lg text-white`}>{tx.start}</button>}
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 text-sm font-bold text-[#8a4b2a]">{tickets.length ? tx.pick : `📝 ${tx.noTickets}`}</p>
            {!tickets.length && <button onClick={() => { playTap(); onGo('cafe') }} className={`${btn} bg-[#ef8d99] text-white`}>{tx.cafe}</button>}
          </div>
        )}
      </div>

      {pantry && (
        <div role="dialog" aria-modal aria-label={tx.pantryTitle} className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-3" onClick={(e) => { if (e.target === e.currentTarget) setPantry(false) }}>
          <div className="sheet-in flex max-h-full w-full max-w-sm flex-col rounded-3xl bg-[#fffaf0] p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="m-0 text-lg font-black text-[#8a4b2a]">{tx.pantryTitle}</p>
              <span className="rounded-full bg-white px-3 py-1 text-sm shadow-sm"><CoinIcon /> <b>{farm.coins}</b></span>
            </div>
            <p className="mt-1 mb-2 text-xs text-black/45">{tx.pantryNote}</p>
            <div className="grid min-h-0 grid-cols-4 gap-2 overflow-y-auto">
              {PANTRY.map((p) => (
                <div key={p.id} className={`flex flex-col items-center rounded-2xl bg-white p-1.5 ${lackMart.has(p.id) ? 'kitchen-neon' : 'ring-1 ring-black/5'}`}>
                  <Ing id={p.id} className="h-10 w-10" />
                  <span className="text-[11px] font-bold text-[#8a4b2a]">{p[lang]}</span>
                  <span className="text-xs text-black/50">× {kitchen.pantry[p.id]}</span>
                  <button aria-label={`${p[lang]} ${PACK}개 사기`} disabled={farm.coins < PACK_PRICE}
                    onClick={() => { if (buyPantry(p.id)) playCoin(); else say(tx.noCoins) }}
                    className="mt-1 flex w-full items-center justify-center gap-0.5 rounded-full bg-[#ef8d99] py-1 font-bold whitespace-nowrap text-white disabled:opacity-40"><span style={{ fontSize: 12 }}>+{PACK} · {PACK_PRICE}</span><CoinIcon /></button>
                </div>
              ))}
            </div>
            <p className="mt-3 mb-1 text-xs text-black/45">{tx.farmNote}</p>
            <div className="flex items-center gap-2">
              {CROPS.map((c) => <span key={c.id} className="flex items-center gap-1 rounded-full bg-white py-0.5 pr-2.5 pl-1 text-sm font-bold ring-1 ring-black/5"><Ing id={c.id} className="h-6 w-6" /> × {farm.inventory[c.id]}</span>)}
              <button onClick={() => { playTap(); setPantry(false); onGo('farm') }} className="ml-auto rounded-full bg-[#e6f6e3] px-3 py-1.5 text-xs font-bold text-[#3d7a35]">🥕 →</button>
            </div>
            <button onClick={() => setPantry(false)} className={`${btn} mt-3 bg-white text-[#8a4b2a]`}>{tx.close}</button>
          </div>
        </div>
      )}
      {toast && <div role="status" className="absolute bottom-40 left-1/2 z-50 max-w-[90%] -translate-x-1/2 rounded-full bg-[#8a4b55] px-5 py-3 text-center text-sm text-[#fff9e9] shadow-lg">{toast}</div>}
    </section>
  )
}


/** 몇 번 더 눌러야 하는지 보여 주는 점 */
function Dots({ n, k }: { n: number; k: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5" aria-label={`${k} / ${n}`}>
      {Array.from({ length: n }, (_, i) => <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < k ? 'bg-[#ef8d99]' : 'bg-[#f3e2cf]'}`} />)}
    </div>
  )
}

/** 재료 그림: 농장 재료는 농장 수확 그림, 기본 재료는 public/kitchen/ing/<id>.webp. 그림을 못 읽으면 이모지 */
function Ing({ id, className }: { id: IngId; className: string }) {
  const [failed, setFailed] = useState(false)
  const src = isCrop(id) ? `assets/farm/harvest_${id}.webp` : `kitchen/ing/${id}.webp`
  if (failed) return <span aria-hidden className={`flex items-center justify-center leading-none ${className}`} style={{ fontSize: '1.4rem' }}>{ingredient(id).emoji}</span>
  return <img src={assetUrl(src)} alt="" draggable={false} onError={() => setFailed(true)} className={`object-contain ${className}`} />
}

/** 단계 아이콘: 굽기 불, 썰기 칼, 믹서 돌리기 믹서기, 갈기 그라인더, 섞기·말기 두 손(public/kitchen), 나머지는 이모지 */
const STEP_IMG: Partial<Record<StepId, string>> = { bake: 'kitchen/fire.webp', cut: 'kitchen/knife.webp', blend: 'kitchen/blender.webp', mix: 'kitchen/hands.webp', grind: 'kitchen/grinder.webp', roll: 'kitchen/hands.webp', pour: 'kitchen/pitcher.webp', chill: 'kitchen/ice.webp' }
/** 도마 위에 놓는 도구 그림과 크기(도마 폭에 대한 비율) */
const BOARD_TOOL: Partial<Record<StepId, { img: string; w: number }>> = { roll: { img: 'kitchen/hands.webp', w: 0.3 }, mix: { img: 'kitchen/hands.webp', w: 0.3 }, blend: { img: 'kitchen/blender.webp', w: 0.3 }, grind: { img: 'kitchen/grinder.webp', w: 0.3 }, cut: { img: 'kitchen/knife.webp', w: 0.3 }, pour: { img: 'kitchen/pitcher.webp', w: 0.3 } }
/** 칼 그림은 대각선으로 길어 같은 칸에서 작아 보여서 2배로 그린다(다른 그림과 비슷한 크기로) */
const STEP_SCALE: Partial<Record<StepId, number>> = { cut: 2 }
function StepIcon({ id, className = 'h-full w-full' }: { id: StepId; className?: string }) {
  const img = STEP_IMG[id]
  const k = STEP_SCALE[id]
  return img ? <img src={assetUrl(img)} alt="" draggable={false} className={`object-contain ${className}`} style={k ? { transform: `scale(${k})`, margin: '0 0.25em' } : undefined} /> : <span aria-hidden>{STEPS[id].emoji}</span>
}
