import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { FarmFx } from './FarmFx'
import { useI18n } from '../i18n'
import { actFarm, getFarm, subscribeFarm } from '../lib/farm'
import { assetUrl } from '../lib/items'

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
  { animal: '🐻', name: '곰이', portrait: [16.6, 47.9], wide: [24.2, 50.2] },
  { animal: '🐰', name: '몽실', portrait: [38.1, 46.6], wide: [36.5, 50.6] },
  { animal: '🐱', name: '냥이', portrait: [63.5, 45.9], wide: [64.2, 50.6] },
  { animal: '🐶', name: '멍멍', portrait: [83.5, 47.9], wide: [76.3, 51.6] },
  { animal: '🐥', name: '삐약', portrait: [18.6, 71], wide: [24.2, 75.5] },
  { animal: '🦆', name: '꽥꽥', portrait: [37.6, 71.3], wide: [36, 76.4] },
  { animal: '🐿️', name: '다람', portrait: [64, 71], wide: [64.6, 76.4] },
  { animal: '🐼', name: '판다', portrait: [85, 70.6], wide: [76.3, 75] },
] as const
const BONUS = 15
const GOAL = 5
const cookMs = (price: number) => 2000 + price * 300
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
    hint: '💬 눌러 주문받기 → 눌러서 만들기 → 완성되면 눌러서 서빙',
    askOrder: '주문받기', tapCook: '눌러서 만들기', cooking: '만드는 중', ready: '완성!', notReady: '아직 만드는 중이에요 🍳',
    bonus: `🎉 첫 단골 달성! 보너스 ${BONUS}코인!`,
    mission: '첫 단골 만들기', missionDone: '첫 단골 만들기 완료!', missionText: `손님 ${GOAL}명에게 행복을 전해 주세요`,
    count: (n: number) => `${n} / ${GOAL}명 · 달성 보너스 ${BONUS}코인`, countDone: `달성 완료 · 보너스 ${BONUS}코인을 받았어요!`,
    diaryTitle: '모모의 카페 일기', diary0: '달콤한 딸기 향을 따라 친구들이 찾아왔어요. 첫 주문을 받아 볼까요? 🍓',
    diary: (a: string, n: string, m: string) => `${a} ${n}: “${m}, 정말 맛있어요! 다음에 또 올게요.” 오늘도 작은 행복을 나눴어요.`,
    lv: ['🍓 새싹 사장님', '🍓🍓 다정한 사장님', '🍓🍓🍓 인기 딸기 카페'], note: '🌷 서두르지 않아도 괜찮아요', sound: ['효과음 켜기', '효과음 끄기'], order: '주문',
  },
  en: {
    title: 'Strawberry Cafe', open: 'Strawberry cafe is open', happy: (n: number) => `${n} happy cups today`,
    hint: 'Tap 💬 to take an order → tap to cook → tap when done to serve',
    askOrder: 'Take order', tapCook: 'Tap to cook', cooking: 'Cooking', ready: 'Done!', notReady: 'Still cooking 🍳',
    bonus: `🎉 First regular! Bonus ${BONUS} coins!`,
    mission: 'Make a first regular', missionDone: 'First regular made!', missionText: `Make ${GOAL} guests happy`,
    count: (n: number) => `${n} / ${GOAL} guests · ${BONUS} bonus coins`, countDone: `Done · you got ${BONUS} bonus coins!`,
    diaryTitle: "Momo's cafe diary", diary0: 'Friends followed the sweet strawberry smell. Shall we take the first order? 🍓',
    diary: (a: string, n: string, m: string) => `${a} ${n}: “${m} is so yummy! I'll come again.” Shared a little happiness today.`,
    lv: ['🍓 Sprout boss', '🍓🍓 Kind boss', '🍓🍓🍓 Popular cafe'], note: '🌷 No need to rush', sound: ['Sound on', 'Sound off'], order: 'Order',
  },
}

function tone() {
  try {
    const c = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const g = c.createGain()
    g.connect(c.destination)
    g.gain.value = 0.045
    ;[523, 659, 784].forEach((f, i) => {
      const o = c.createOscillator()
      o.frequency.value = f
      o.connect(g)
      o.start(c.currentTime + i * 0.09)
      o.stop(c.currentTime + i * 0.09 + 0.13)
    })
    setTimeout(() => c.close(), 600)
  } catch { /* 소리 실패는 무시 */ }
}

export function CafeGame() {
  const { lang } = useI18n()
  const tx = T[lang]
  const [st, setSt] = useState<Saved>(loadSaved)
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const [guests, setGuests] = useState<Guest[]>(() => SEATS.map((_, i) => newGuest(i)))
  const [now, setNow] = useState(() => Date.now())
  const [sound, setSound] = useState(false)
  const [toast, setToast] = useState('')
  const [floats, setFloats] = useState<{ id: number; seat: number; amount: number }[]>([])
  const toastTimer = useRef<number>(0)
  const secRef = useRef<HTMLElement>(null)
  const [wide, setWide] = useState(false) // 가로로 넓은 화면(패드 가로 등): 가로 그림을 쓴다
  useEffect(() => {
    const el = secRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWide(el.clientWidth > el.clientHeight * 1.2))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const floatId = useRef(0)

  useEffect(() => () => clearTimeout(toastTimer.current), [])
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
  const beep = () => { if (sound) tone() }
  const isReady = (g: Guest) => g.stage === 'cooking' && g.doneAt <= now

  /** 말풍선(또는 손님)을 누르면 다음 단계로: 주문 받기 → 만들기 시작 → (완성되면) 서빙 */
  const tap = (i: number) => {
    const g = guests[i]
    const m = MENU[g.wish]
    if (g.stage === 'new') {
      setGuests((gs) => gs.map((x, k) => (k === i ? { ...x, stage: 'ordered' } : x)))
      beep()
    } else if (g.stage === 'ordered') {
      const at = Date.now()
      setNow(at)
      setGuests((gs) => gs.map((x, k) => (k === i ? { ...x, stage: 'cooking', doneAt: at + cookMs(m.price) } : x)))
    } else if (!isReady(g)) {
      say(tx.notReady)
    } else {
      const bonus = st.served + 1 >= GOAL && !st.reward
      save({ served: st.served + 1, reward: st.reward || bonus })
      actFarm({ type: 'earn', amount: m.price + (bonus ? BONUS : 0) })
      beep()
      setGuests((gs) => gs.map((x, k) => (k === i ? newGuest(i) : x)))
      const id = ++floatId.current
      setFloats((f) => [...f, { id, seat: i, amount: m.price + (bonus ? BONUS : 0) }])
      window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1300)
      if (bonus) say(tx.bonus)
    }
  }

  return (
    <section ref={secRef} aria-label={tx.title} className="relative h-full overflow-hidden rounded-3xl bg-[#b9c97a] ring-1 ring-black/5" style={{ containerType: 'size' }}>
      {/* 그림 아래 남는 자리(폰 세로): 그림 맨 아래 덤불·풀밭 부분을 위아래로 뒤집고 늘려 이어 붙여서 정원이 끝까지 이어져 보이게 한다 */}
      {!wide && (
        <div aria-hidden className="absolute left-1/2 -translate-x-1/2 overflow-hidden" style={{ width: 'min(100cqw, calc(100cqh / 1.5))', top: 'calc(min(100cqw, 100cqh / 1.5) * 1.5 - 1px)', bottom: 0 }}>
          <div className="h-full w-full" style={{ backgroundImage: `url(${assetUrl('cafe/garden_portrait.webp')})`, backgroundSize: '100% calc((100cqh - min(100cqw, 100cqh / 1.5) * 1.5) / 0.16)', backgroundPosition: 'bottom', backgroundRepeat: 'no-repeat', transform: 'scaleY(-1)' }} />
        </div>
      )}
      <div
        className={`absolute overflow-hidden select-none ${wide ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : 'top-0 left-1/2 -translate-x-1/2'}`}
        style={wide ? { width: 'max(100cqw, calc(100cqh * 1448 / 1086))', aspectRatio: '1448 / 1086' } : { width: 'min(100cqw, calc(100cqh / 1.5))', aspectRatio: '1024 / 1536' }}
      >
        <img src={assetUrl(wide ? 'cafe/garden_wide.webp' : 'cafe/garden_portrait.webp')} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
        <FarmFx />
        {guests.map((x, i) => {
          const [cx, cy] = SEATS[i][wide ? 'wide' : 'portrait']
          const m = MENU[x.wish]
          const ready = isReady(x)
          const frac = x.stage === 'cooking' ? Math.min(1, 1 - (x.doneAt - now) / cookMs(m.price)) : 0
          const label = x.stage === 'new' ? tx.askOrder : x.stage === 'ordered' ? tx.tapCook : ready ? tx.ready : tx.cooking
          return (
            <div key={i}>
              <button aria-hidden tabIndex={-1} onClick={() => tap(i)} className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-0 bg-transparent p-0" style={{ left: `${cx}%`, top: `${cy + 2}%`, width: wide ? '9%' : '14%', height: wide ? '16%' : '11%' }} />
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
                      {x.stage === 'ordered' && <span aria-hidden className="absolute -right-1.5 -bottom-1.5 rounded-full bg-[#e8707f] px-1 text-xs leading-5 text-white">🍳</span>}
                      {ready && <span aria-hidden className="absolute -top-2 -right-2 text-lg">✨</span>}
                    </span>}
                {x.stage === 'cooking' && !ready && <span className="mt-0.5 block h-1.5 w-11 overflow-hidden rounded-full bg-[#eee4d3]"><i className="block h-full bg-[#ef8d99]" style={{ width: `${frac * 100}%` }} /></span>}
                {ready && <span className="block text-center text-[10px] leading-tight font-bold text-[#c04a5a]">{tx.ready}</span>}
              </button>
            </div>
          )
        })}
        {floats.map((f) => {
          const [cx, cy] = SEATS[f.seat][wide ? 'wide' : 'portrait']
          return <span key={f.id} aria-hidden className="cafe-float pointer-events-none absolute z-[6] -translate-x-1/2 text-lg font-extrabold text-[#c9751f] drop-shadow-[0_1px_0_#fff]" style={{ left: `${cx}%`, top: `${cy - 6}%` }}>+{f.amount} 🪙</span>
        })}
      </div>

      <div className="absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-2">
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold shadow">🎁 {st.reward ? tx.missionDone : `${Math.min(st.served, GOAL)} / ${GOAL}`}</span>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm shadow">🪙 <b>{farm.coins}</b></span>
          <button aria-label={tx.sound[sound ? 1 : 0]} aria-pressed={sound} onClick={() => { const v = !sound; setSound(v); if (v) tone() }} className="h-9 w-9 rounded-full bg-white/90 shadow">{sound ? '🔊' : '🔇'}</button>
        </div>
      </div>
      <p className="absolute inset-x-3 bottom-2 z-20 m-0 rounded-full bg-white/90 px-3 py-1.5 text-center text-[11px] shadow">{tx.hint}</p>

      {toast && <div role="status" className="absolute bottom-12 left-1/2 z-30 max-w-[90%] -translate-x-1/2 rounded-full bg-[#8a4b55] px-5 py-3 text-center text-sm text-[#fff9e9] shadow-lg">{toast}</div>}
    </section>
  )
}
