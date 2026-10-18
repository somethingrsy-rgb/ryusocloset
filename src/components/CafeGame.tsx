import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
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
/** 배경 그림 속 손님 세 마리의 자리(그림 크기에 대한 %). 눌러서 주문을 받는다 */
const SEATS = [
  { animal: '🐻', name: '곰이', box: { left: 0, top: 57, width: 17, height: 17 } },
  { animal: '🐥', name: '삐약', box: { left: 27, top: 79, width: 16, height: 13 } },
  { animal: '🐰', name: '몽실', box: { left: 75, top: 63, width: 19, height: 18 } },
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

const FONT = "Jua,'Noto Sans KR',sans-serif"

export function CafeGame() {
  const { lang } = useI18n()
  const tx = T[lang]
  const [st, setSt] = useState<Saved>(loadSaved)
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  const [guests, setGuests] = useState<Guest[]>(() => [newGuest(0), newGuest(1), newGuest(2)])
  const [now, setNow] = useState(() => Date.now())
  const [sound, setSound] = useState(false)
  const [diary, setDiary] = useState('')
  const [toast, setToast] = useState('')
  const [floats, setFloats] = useState<{ id: number; seat: number; amount: number }[]>([])
  const toastTimer = useRef<number>(0)
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
  const name = (m: { ko: string; en: string }) => m[lang]
  const level = st.served >= 15 ? 2 : st.served >= 5 ? 1 : 0
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
      setDiary(tx.diary(g.animal, g.name, name(m)))
      setGuests((gs) => gs.map((x, k) => (k === i ? newGuest(i) : x)))
      const id = ++floatId.current
      setFloats((f) => [...f, { id, seat: i, amount: m.price + (bonus ? BONUS : 0) }])
      window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1300)
      if (bonus) say(tx.bonus)
    }
  }

  const panel = 'rounded-3xl border border-[#f4d3d6] bg-[#fffaf8] p-4 shadow-sm'
  const h2 = 'm-0 mb-1 text-xl font-normal'

  return (
    <div className="relative h-full overflow-y-auto rounded-3xl bg-[#fff3f0] p-3 text-[#6b4a45]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className="rounded-2xl bg-[#fff8e9] p-1.5 text-2xl shadow-[0_3px_0_#e4d3bc]">🍓</span>
          <p className="m-0 text-lg leading-tight" style={{ fontFamily: FONT }}>{tx.title}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-[#e4d4bc] bg-[#fffaf0] px-3 py-1.5 text-sm">🪙 <b>{farm.coins}</b></span>
          <button
            aria-label={tx.sound[sound ? 1 : 0]}
            aria-pressed={sound}
            onClick={() => { const v = !sound; setSound(v); if (v) tone() }}
            className="h-10 w-10 rounded-full border border-[#e4d4bc] bg-[#fffaf0]"
          >{sound ? '🔊' : '🔇'}</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[27px] border-[6px] border-[#fff8f4] shadow-md">
        <div className="relative w-full" style={{ aspectRatio: '853 / 1280' }}>
          <img src={assetUrl('cafe/strawberry_cafe.webp')} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
          <span aria-hidden className={`absolute top-[55%] left-[29%] text-3xl ${cooking ? 'animate-bounce' : 'hidden'}`}>🍓</span>
          <p className="absolute top-2 left-2 m-0 rounded-xl bg-[#fffaf1]/90 px-2.5 py-1 text-[10px]"><i className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-[#e8707f]" />{tx.open}</p>
          {guests.map((x, i) => {
            const bx = SEATS[i].box
            const m = MENU[x.wish]
            const ready = isReady(x)
            const frac = x.stage === 'cooking' ? Math.min(1, 1 - (x.doneAt - now) / cookMs(m.price)) : 0
            const label = x.stage === 'new' ? tx.askOrder : x.stage === 'ordered' ? tx.tapCook : ready ? tx.ready : tx.cooking
            return (
              <div key={i}>
                <button
                  aria-label={`${x.name} · ${label}`}
                  onClick={() => tap(i)}
                  className="absolute z-[3] -translate-x-1/2 -translate-y-full rounded-3xl border-0 bg-[#fffdf8] p-1.5 shadow-[0_4px_0_#f0c6cd] active:scale-95"
                  style={{ left: `${Math.min(Math.max(bx.left + bx.width / 2, 14), 86)}%`, top: `${bx.top}%` }}
                >
                  {x.stage === 'new'
                    ? <span className="block h-14 w-14 animate-pulse text-center text-5xl leading-[3.5rem]">💬</span>
                    : <span className="relative block h-14 w-14">
                        <Ico id={m.id} className={`h-14 w-14 ${x.stage === 'ordered' || (x.stage === 'cooking' && !ready) ? 'opacity-60' : ready ? 'animate-bounce' : ''}`} />
                        {x.stage === 'ordered' && <span aria-hidden className="absolute -right-1 -bottom-1 rounded-full bg-[#e8707f] px-1.5 text-sm leading-5 text-white">🍳</span>}
                        {ready && <span aria-hidden className="absolute -top-2 -right-2 text-xl">✨</span>}
                      </span>}
                  {x.stage === 'cooking' && !ready && <span className="mt-1 block h-1.5 w-14 overflow-hidden rounded-full bg-[#eee4d3]"><i className="block h-full bg-[#ef8d99]" style={{ width: `${frac * 100}%` }} /></span>}
                  {ready && <span className="mt-0.5 block text-center text-[10px] font-bold text-[#c04a5a]">{tx.ready}</span>}
                </button>
                <button
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => tap(i)}
                  className="absolute rounded-3xl border-0 bg-transparent p-0"
                  style={{ left: `${bx.left}%`, top: `${bx.top}%`, width: `${bx.width}%`, height: `${bx.height}%` }}
                >
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-[#fff8f4]/95 px-2 py-0.5 text-[10px] whitespace-nowrap">{x.name}</span>
                </button>
              </div>
            )
          })}
          {floats.map((f) => (
            <span key={f.id} aria-hidden className="cafe-float pointer-events-none absolute z-[4] -translate-x-1/2 text-lg font-extrabold text-[#c9751f] drop-shadow-[0_1px_0_#fff]" style={{ left: `${Math.min(Math.max(SEATS[f.seat].box.left + SEATS[f.seat].box.width / 2, 14), 86)}%`, top: `${SEATS[f.seat].box.top}%` }}>+{f.amount} 🪙</span>
          ))}
        </div>
        <div className="flex justify-between gap-2 bg-[#fff8f4] px-3 py-3 text-[11px]"><span>{tx.hint}</span><span className="shrink-0">{tx.happy(st.served)}</span></div>
      </div>

      <section className={`${panel} mt-3`}>
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-4xl">🎁</span>
          <div>
            <strong className="text-sm">{st.reward ? tx.missionDone : tx.mission}</strong>
            <p className="m-0 mt-1 text-[11px] text-[#9d886f]">{tx.missionText}</p>
          </div>
        </div>
        <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-[#eee4d3]"><i className="block h-full bg-[#ef8d99]" style={{ width: `${Math.min(st.served / GOAL, 1) * 100}%` }} /></div>
        <p className="mt-2 mb-0 text-xs text-[#a58d76]">{st.reward ? tx.countDone : tx.count(Math.min(st.served, GOAL))}</p>
      </section>

      <section className={`${panel} mt-3`}>
        <h2 className={h2} style={{ fontFamily: FONT }}>{tx.diaryTitle} <span className="text-xs text-[#a58d76]">{tx.lv[level]}</span></h2>
        <p className="m-0 text-xs leading-loose">{diary || tx.diary0}</p>
      </section>

      {toast && <div role="status" className="fixed bottom-6 left-1/2 z-20 max-w-[90%] -translate-x-1/2 rounded-full bg-[#8a4b55] px-5 py-3 text-center text-sm text-[#fff9e9] shadow-lg">{toast}</div>}
    </div>
  )
}
