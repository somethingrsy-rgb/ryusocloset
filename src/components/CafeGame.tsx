import { playBell, playCook, playOrder, playServe, startBgm, stopBgm } from '../lib/sound'
import { AnimalCall, unlockSpeech } from './AnimalCall'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { FarmFx } from './FarmFx'
import { useI18n } from '../i18n'
import { actFarm, getFarm, subscribeFarm } from '../lib/farm'
import { assetUrl } from '../lib/items'
import type { Outfit, Tweaks } from '../lib/types'
import { FigureLayers } from './FigureLayers'
import { CoinIcon } from './Icons'

type Menu = { id: string; ko: string; en: string; price: number }
/** 메뉴 그림은 public/cafe/menu2/<id>.webp */
const MENU: Menu[] = [
  { id: 'latte', ko: '카페라테', en: 'Cafe latte', price: 3 },
  { id: 'coffee', ko: '아이스 커피', en: 'Iced coffee', price: 3 },
  { id: 'shake', ko: '딸기 우유 쉐이크', en: 'Strawberry shake', price: 4 },
  { id: 'ade', ko: '딸기 에이드', en: 'Strawberry ade', price: 4 },
  { id: 'macaron', ko: '마카롱', en: 'Macaron', price: 5 },
  { id: 'cupcake', ko: '딸기 컵케이크', en: 'Strawberry cupcake', price: 5 },
  { id: 'slice', ko: '딸기 케이크', en: 'Strawberry cake', price: 6 },
  { id: 'roll', ko: '딸기 롤케이크', en: 'Strawberry roll cake', price: 6 },
  { id: 'choco', ko: '초코 딸기', en: 'Choco strawberries', price: 7 },
  { id: 'jelly', ko: '딸기 젤리 케이크', en: 'Jelly cake', price: 8 },
]
function Ico({ id, className }: { id: string; className: string }) {
  return <img src={assetUrl(`cafe/menu2/${id}.webp`)} alt="" draggable={false} className={`select-none object-contain ${className}`} />
}
/** 정원 그림 속 손님 8마리. 머리 가운데 위치(그림 크기에 대한 %)이고, 세로 그림(폰)과 가로 그림(패드)이 다르다. 눌러서 주문을 받는다 */
const SEATS = [
  { animal: '🐻', name: '곰이', portrait: [15.4, 51.7], wide: [28.1, 53.7] },
  { animal: '🐰', name: '몽실', portrait: [34.6, 50.8], wide: [37.4, 54.2] },
  { animal: '🐱', name: '냥이', portrait: [64.4, 52], wide: [63.4, 54.2] },
  { animal: '🐶', name: '멍멍', portrait: [84, 52], wide: [72.7, 54.7] },
  { animal: '🐥', name: '삐약', portrait: [17, 71.5], wide: [28.1, 76.5] },
  { animal: '🦆', name: '꽥꽥', portrait: [35.1, 71.5], wide: [37.7, 77] },
  { animal: '🐿️', name: '다람', portrait: [68, 71.2], wide: [63.7, 76] },
  { animal: '🐼', name: '판다', portrait: [85, 71.2], wide: [73.9, 76] },
] as const
const BONUS = 15
const GOAL = 5
/** 만드는 시간: 메뉴 값이 클수록 조금 더 걸린다(3코인 30초 ~ 8코인 40초) */
const cookMs = (price: number) => 24000 + price * 2000
const KEY = 'ryuso.cafe.v1'

type Saved = { served: number; reward: boolean }
const loadSaved = (): Saved => {
  const base: Saved = { served: 0, reward: false }
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (s && Number.isFinite(s.served) && s.served >= 0) return { served: s.served, reward: !!s.reward }
  } catch { /* 저장소를 못 읽어도 새로 시작 */ }
  return base
}

const pick = (n: number) => Math.floor(Math.random() * n)
type Stage = 'new' | 'ordered' | 'cooking'
interface Guest { animal: string; name: string; wish: number; stage: Stage; doneAt: number }
const newGuest = (i: number): Guest => ({ animal: SEATS[i].animal, name: SEATS[i].name, wish: pick(MENU.length), stage: 'new', doneAt: 0 })

const T = {
  ko: {
    title: '딸기 카페', open: '딸기 카페 영업 중', happy: (n: number) => `오늘의 행복 ${n}잔`,
    hint: '💬 눌러 주문받기 → 눌러서 만들기 → 완성되면 눌러서 서빙 · 동물을 누르면 📞 전화',
    askOrder: '주문받기', tapCook: '눌러서 만들기', cooking: '만드는 중', ready: '완성!', notReady: '아직 만드는 중이에요',
    bonus: `🎉 첫 단골 달성! 보너스 ${BONUS}코인!`,
    mission: '첫 단골 만들기', missionDone: '첫 단골 만들기 완료!', missionText: `손님 ${GOAL}명에게 행복을 전해 주세요`,
    count: (n: number) => `${n} / ${GOAL}명 · 달성 보너스 ${BONUS}코인`, countDone: `달성 완료 · 보너스 ${BONUS}코인을 받았어요!`,
    diaryTitle: '모모의 카페 일기', diary0: '달콤한 딸기 향을 따라 친구들이 찾아왔어요. 첫 주문을 받아 볼까요? 🍓',
    diary: (a: string, n: string, m: string) => `${a} ${n}: “${m}, 정말 맛있어요! 다음에 또 올게요.” 오늘도 작은 행복을 나눴어요.`,
    lv: ['🍓 새싹 사장님', '🍓🍓 다정한 사장님', '🍓🍓🍓 인기 딸기 카페'], note: '🌷 서두르지 않아도 괜찮아요', sound: ['효과음 켜기', '효과음 끄기'], order: '주문',
  },
  en: {
    title: 'Strawberry Cafe', open: 'Strawberry cafe is open', happy: (n: number) => `${n} happy cups today`,
    hint: 'Tap 💬 to take an order → tap to cook → tap when done to serve · tap an animal to 📞 call',
    askOrder: 'Take order', tapCook: 'Tap to cook', cooking: 'Cooking', ready: 'Done!', notReady: 'Still cooking',
    bonus: `🎉 First regular! Bonus ${BONUS} coins!`,
    mission: 'Make a first regular', missionDone: 'First regular made!', missionText: `Make ${GOAL} guests happy`,
    count: (n: number) => `${n} / ${GOAL} guests · ${BONUS} bonus coins`, countDone: `Done · you got ${BONUS} bonus coins!`,
    diaryTitle: "Momo's cafe diary", diary0: 'Friends followed the sweet strawberry smell. Shall we take the first order? 🍓',
    diary: (a: string, n: string, m: string) => `${a} ${n}: “${m} is so yummy! I'll come again.” Shared a little happiness today.`,
    lv: ['🍓 Sprout boss', '🍓🍓 Kind boss', '🍓🍓🍓 Popular cafe'], note: '🌷 No need to rush', sound: ['Sound on', 'Sound off'], order: 'Order',
  },
}

/**
 * 아바타는 가운데 잔디 길(x=50%)로만 다닌다: 카운터 앞 → 윗줄 테이블 사이 → 아랫줄 테이블 사이.
 * h = 아바타 키(그림 높이에 대한 %, 화면에서 농장 아바타와 같은 크기가 되도록 맞춤), feet = 발 위치(그림 높이에 대한 %): 카운터 앞, 윗줄, 아랫줄. 테이블·동물과 겹치지 않는 자리다.
 */
const AVATAR = {
  portrait: { h: 16, w: 1024 / 1536 / (940 / 1672), feet: [40, 61, 79] },
  wide: { h: 21.3, w: 1024 / 1536 / (1672 / 941), feet: [43, 62, 86] },
} as const

/** 다른 탭(농장·여행 등)에 다녀와도 손님·주문·아바타 자리가 그대로 남도록 화면 밖에 기억해 둔다 (앱을 완전히 닫으면 새로 시작) */
let kept: { guests: Guest[]; pos: { x: number; y: number; wide: boolean } | null; hold: string | null } | null = null

export function CafeGame({ outfit, tweaks }: { outfit: Outfit; tweaks: Tweaks }) {
  const { lang } = useI18n()
  const tx = T[lang]
  const [st, setSt] = useState<Saved>(loadSaved)
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const [guests, setGuests] = useState<Guest[]>(() => kept?.guests ?? SEATS.map((_, i) => newGuest(i)))
  const [now, setNow] = useState(() => Date.now())
  const [sound, setSound] = useState(true) // 이 화면에서만 끄고 켤 수 있는 소리(설정의 효과음이 꺼져 있으면 어차피 안 남)
  const [toast, setToast] = useState('')
  const [floats, setFloats] = useState<{ id: number; seat: number; amount: number }[]>([])
  const toastTimer = useRef<number>(0)
  const secRef = useRef<HTMLElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number; wide: boolean } | null>(() => kept?.pos ?? null)
  const [walking, setWalking] = useState(false)
  const [hold, setHold] = useState<string | null>(() => kept?.hold ?? null) // 들고 있는 메뉴 그림
  useEffect(() => { kept = { guests, pos, hold } }, [guests, pos, hold])
  // 메뉴 그림을 미리 받아 둔다: 서빙하려고 처음 들 때 그림이 늦게 떠서 안 보이던 것을 막는다
  // 카페에 있는 동안 배경 음악(카페의 🔊 를 끄면 음악도 꺼진다)
  // 동물과 전화하는 동안: 동물 목소리가 잘 들리게 음악을 멈춘다
  const [calling, setCalling] = useState<number | null>(null)
  useEffect(() => { if (!sound || calling !== null) return; startBgm('cafe'); return stopBgm }, [sound, calling])
  useEffect(() => { MENU.forEach((m) => { new Image().src = assetUrl(`cafe/menu2/${m.id}.webp`) }) }, [])
  const timers = useRef<number[]>([])
  const pending = useRef(new Set<number>())
  const [pad, setPad] = useState(false) // 패드 세로처럼 폰보다 넓은 세로 화면: 세로 그림을 가로폭에 꽉 채우고 위아래를 조금 자른다
  const [wide, setWide] = useState(false) // 가로로 넓은 화면(패드 가로 등): 가로 그림을 쓴다
  useEffect(() => {
    const el = secRef.current
    if (!el) return
    const ro = new ResizeObserver(() => { setWide(el.clientWidth > el.clientHeight * 1.2); setPad(el.clientWidth / el.clientHeight > 0.6) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const floatId = useRef(0)

  useEffect(() => () => { clearTimeout(toastTimer.current); timers.current.forEach(clearTimeout) }, [])
  const cooking = guests.some((g) => g.stage === 'cooking' && g.doneAt > now)
  useEffect(() => {
    if (!cooking) return
    const id = window.setInterval(() => setNow(Date.now()), 150)
    return () => clearInterval(id)
  }, [cooking])

  const save = (s: Saved) => {
    setSt(s)
    try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 저장 실패는 무시 */ }
  }
  const say = (t: string) => {
    setToast(t)
    clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2500)
  }
  const sfx = (fn: () => void) => { if (sound) fn() }
  const isReady = (g: Guest) => g.stage === 'cooking' && g.doneAt <= now
  // 음식이 다 되면 딩동(손님마다 처음 다 됐을 때 한 번만)
  const readyBefore = useRef<boolean[]>([])
  useEffect(() => {
    guests.forEach((g, i) => {
      const r = g.stage === 'cooking' && g.doneAt <= now
      if (r && readyBefore.current[i] === false) { if (sound) playBell() }
      readyBefore.current[i] = r
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, guests])

  const A = wide ? AVATAR.wide : AVATAR.portrait
  const aw = A.h * A.w
  const lane = (row: 0 | 1 | 2) => ({ x: 50 - aw / 2, y: A.feet[row] - A.h, wide })
  const here = pos && pos.wide === wide ? pos : lane(0)

  /** 말풍선(또는 손님)을 누르면 아바타가 걸어가서 다음 단계를 한다: 주문 받기(손님 자리) → 만들기 시작(카운터) → (완성되면) 서빙(손님 자리) */
  const tap = (i: number) => {
    const g = guests[i]
    const m = MENU[g.wish]
    if (g.stage === 'cooking' && !isReady(g)) { say(tx.notReady); return }
    if (pending.current.has(i)) return // 같은 손님을 연달아 두 번 누르는 것만 막는다
    pending.current.add(i)
    const toSeat = lane(i < 4 ? 1 : 2)
    const toCounter = lane(0)
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)) }
    const stage = g.stage
    // 아바타가 걸어가는 도중(0.4초 뒤)에 결과(주문 받기·만들기 시작·서빙)가 나타난다
    setWalking(true)
    setPos(stage === 'ordered' ? toCounter : toSeat)
    later(() => setWalking(false), 800)
    if (stage === 'cooking') setHold(m.id)
    later(() => {
      pending.current.delete(i)
      if (stage === 'new') {
        setGuests((gs) => gs.map((x, k) => (k === i ? { ...x, stage: 'ordered' } : x)))
        sfx(playOrder)
      } else if (stage === 'ordered') {
        const at = Date.now()
        setNow(at)
        setGuests((gs) => gs.map((x, k) => (k === i ? { ...x, stage: 'cooking', doneAt: at + cookMs(m.price) } : x)))
        sfx(playCook)
      } else {
        const bonus = st.served + 1 >= GOAL && !st.reward
        save({ served: st.served + 1, reward: st.reward || bonus })
        actFarm({ type: 'earn', amount: m.price + (bonus ? BONUS : 0) })
        sfx(playServe)
        setHold(null)
        setGuests((gs) => gs.map((x, k) => (k === i ? newGuest(i) : x)))
        const id = ++floatId.current
        setFloats((f) => [...f, { id, seat: i, amount: m.price + (bonus ? BONUS : 0) }])
        later(() => setFloats((f) => f.filter((x) => x.id !== id)), 1300)
        if (bonus) say(tx.bonus)
      }
    }, 400)
  }

  return (
    <section ref={secRef} aria-label={tx.title} className="relative h-full overflow-hidden rounded-3xl bg-[#b9c97a] ring-1 ring-black/5" style={{ containerType: 'size' }}>
      {/* 그림 아래 남는 자리(폰 세로): 그림 맨 아래 덤불·풀밭 부분을 위아래로 뒤집고 늘려 이어 붙여서 정원이 끝까지 이어져 보이게 한다 */}
      {!wide && !pad && (
        <div aria-hidden className="absolute left-1/2 -translate-x-1/2 overflow-hidden" style={{ width: 'min(100cqw, calc(100cqh / 1.7787))', top: 'calc(min(100cqw, 100cqh / 1.7787) * 1.7787 - 1px)', bottom: 0 }}>
          <div className="h-full w-full" style={{ backgroundImage: `url(${assetUrl('cafe/garden2_portrait.webp')})`, backgroundSize: '100% calc((100cqh - min(100cqw, 100cqh / 1.7787) * 1.7787) / 0.16)', backgroundPosition: 'bottom', backgroundRepeat: 'no-repeat', transform: 'scaleY(-1)' }} />
        </div>
      )}
      <div
        className={`absolute overflow-hidden select-none ${wide || pad ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : 'top-0 left-1/2 -translate-x-1/2'}`}
        style={wide ? { width: 'max(100cqw, calc(100cqh * 1672 / 941))', aspectRatio: '1672 / 941' } : { width: pad ? '100cqw' : 'min(100cqw, calc(100cqh / 1.7787))', aspectRatio: '940 / 1672' }}
      >
        <img src={assetUrl(wide ? 'cafe/garden2_wide.webp' : 'cafe/garden2_portrait.webp')} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
        <FarmFx roam />
        {guests.map((x, i) => {
          const [cx, cy] = SEATS[i][wide ? 'wide' : 'portrait']
          const m = MENU[x.wish]
          const ready = isReady(x)
          const frac = x.stage === 'cooking' ? Math.min(1, 1 - (x.doneAt - now) / cookMs(m.price)) : 0
          const label = x.stage === 'new' ? tx.askOrder : x.stage === 'ordered' ? tx.tapCook : ready ? tx.ready : tx.cooking
          return (
            <div key={i}>
              {/* 동물을 누르면 그 동물에게 전화를 건다(주문은 말풍선으로) */}
              <button aria-label={`${x.name}에게 전화하기`} onClick={() => { unlockSpeech(); setCalling(i) }} className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-0 bg-transparent p-0" style={{ left: `${cx}%`, top: `${cy + 2}%`, width: wide ? '9%' : '14%', height: wide ? '16%' : '11%' }}>
                <span aria-hidden className="absolute -right-1 bottom-0 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm shadow">📞</span>
              </button>
              <button
                aria-label={`${x.name} · ${label}`}
                onClick={() => tap(i)}
                className="absolute z-[5] -translate-x-1/2 -translate-y-full rounded-[20px] border-0 bg-[#fffdf8] p-1 shadow-[0_3px_0_#f0c6cd] active:scale-95"
                style={{ left: `${cx}%`, top: `${cy - 3.5}%` }}
              >
                {x.stage === 'new'
                  ? <span className="block h-11 w-11 animate-pulse text-center text-4xl leading-[2.75rem]">💬</span>
                  : <span className="relative block h-11 w-11">
                      <Ico id={m.id} className={`h-11 w-11 ${x.stage === 'ordered' || (x.stage === 'cooking' && !ready) ? 'opacity-60' : ready ? 'animate-bounce' : ''}`} />
                      {x.stage === 'ordered' && <img aria-hidden src={assetUrl('assets/tabs/bunny.webp')} alt="" draggable={false} className="absolute -right-2 -bottom-2 h-6 w-6 object-contain" />}
                      {ready && <span aria-hidden className="absolute -top-2 -right-2 text-lg">✨</span>}
                    </span>}
                {x.stage === 'cooking' && !ready && <span className="mt-0.5 block h-1.5 w-11 overflow-hidden rounded-full bg-[#eee4d3]"><i className="block h-full bg-[#ef8d99]" style={{ width: `${frac * 100}%` }} /></span>}
                {ready && <span className="block text-center text-[10px] leading-tight font-bold text-[#c04a5a]">{tx.ready}</span>}
              </button>
            </div>
          )
        })}
        {/* 내 아바타: 손님 자리까지 걸어가서 주문을 받고, 카운터에서 만들고, 음식을 들고 가서 서빙한다 */}
        <div aria-hidden className="pointer-events-none absolute" style={{ left: `${here.x}%`, top: `${here.y}%`, width: `${aw}%`, aspectRatio: '1024 / 1536', zIndex: 4, transition: 'left 0.8s ease-in-out, top 0.8s ease-in-out' }}>
          <div className={walking ? 'farm-walk' : ''} style={{ width: '100%', height: '100%', position: 'relative' }}>
            <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
            {hold && <img src={assetUrl(`cafe/menu2/${hold}.webp`)} alt="" draggable={false} className="absolute object-contain" style={{ left: '56%', top: '42%', width: '41%', zIndex: 1000 }} />}
          </div>
        </div>
        {floats.map((f) => {
          const [cx, cy] = SEATS[f.seat][wide ? 'wide' : 'portrait']
          return <span key={f.id} aria-hidden className="cafe-float pointer-events-none absolute z-[6] -translate-x-1/2 text-lg font-extrabold text-[#c9751f] drop-shadow-[0_1px_0_#fff]" style={{ left: `${cx}%`, top: `${cy - 6}%` }}>+{f.amount} <CoinIcon /></span>
        })}
      </div>

      <div className="absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-2">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold shadow">🎁 {st.reward ? tx.missionDone : `${Math.min(st.served, GOAL)} / ${GOAL}`}</span>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm shadow"><CoinIcon /> <b>{farm.coins}</b></span>
          <button aria-label={tx.sound[sound ? 1 : 0]} aria-pressed={sound} onClick={() => { const v = !sound; setSound(v); if (v) playOrder() }} className="h-9 w-9 rounded-full bg-white/90 shadow">{sound ? '🔊' : '🔇'}</button>
        </div>
      </div>
      <p className="absolute inset-x-3 bottom-2 z-20 m-0 rounded-full bg-white/90 px-3 py-1.5 text-center text-[11px] shadow">{tx.hint}</p>

      {calling !== null && <AnimalCall animal={calling} emoji={SEATS[calling].animal} muted={!sound} onClose={() => setCalling(null)} />}
      {toast && <div role="status" className="absolute bottom-12 left-1/2 z-30 max-w-[90%] -translate-x-1/2 rounded-full bg-[#8a4b55] px-5 py-3 text-center text-sm text-[#fff9e9] shadow-lg">{toast}</div>}
    </section>
  )
}
