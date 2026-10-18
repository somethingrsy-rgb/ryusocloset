import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { actFarm, getFarm, subscribeFarm } from '../lib/farm'
import { assetUrl } from '../lib/items'

type Menu = { id: string; ko: string; en: string; price: number }
/** 메뉴 그림은 public/cafe/menu/<id>.webp */
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
  return <img src={assetUrl(`cafe/menu/${id}.webp`)} alt="" draggable={false} className={`select-none object-contain ${className}`} />
}
/** 배경 그림 속 손님 세 마리의 자리(그림 크기에 대한 %). 눌러서 주문을 받는다 */
const SEATS = [
  { animal: '🐻', name: '곰이', box: { left: 0, top: 57, width: 17, height: 17 } },
  { animal: '🐥', name: '삐약', box: { left: 27, top: 79, width: 16, height: 13 } },
  { animal: '🐰', name: '몽실', box: { left: 75, top: 63, width: 19, height: 18 } },
] as const
/** 동시에 만들 수 있는 칸 수 */
const SLOTS = 3
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
const newGuest = (i: number) => ({ animal: SEATS[i].animal, name: SEATS[i].name, wish: pick(MENU.length), taken: false })

const T = {
  ko: {
    title: '딸기 카페', open: '딸기 카페 영업 중', happy: (n: number) => `오늘의 행복 ${n}잔`,
    welcome: '주문서', hint: '손님을 눌러 주문을 받고, 주문서를 눌러 만들어요. 다 되면 눌러서 들고 손님에게 건네요.',
    empty: '손님을 눌러 주문을 받아 보세요 💬', taken: (n: string) => `${n}의 주문을 받았어요! 주문서를 눌러 만들어 보세요.`,
    already: (n: string) => `${n}의 주문은 이미 받았어요.`, full: '조리대가 가득 찼어요. 하나가 끝나길 기다려요 🍳',
    tapCook: '눌러서 만들기', cooking: '만드는 중…', ready: '완성! 눌러서 들기', holding: '들고 있어요 · 손님을 눌러요',
    hold: (m: string) => `${m}을(를) 들었어요. 주문한 손님을 눌러 건네 주세요.`, notReady: '아직 만드는 중이에요.',
    wrong: (n: string) => `이건 ${n}의 주문이 아니에요 💛`, nothing: '먼저 완성된 메뉴를 눌러서 들어 주세요.',
    paid: (p: number) => `${p}코인을 받았어요. 새로운 손님이 앉았어요!`, joy: (p: number) => `행복한 손님 한 명, +${p} 코인 ✨`, bonus: `🎉 첫 단골 달성! 보너스 ${BONUS}코인!`,
    mission: '첫 단골 만들기', missionDone: '첫 단골 만들기 완료!', missionText: `손님 ${GOAL}명에게 행복을 전해 주세요`,
    count: (n: number) => `${n} / ${GOAL}명 · 달성 보너스 ${BONUS}코인`, countDone: `달성 완료 · 보너스 ${BONUS}코인을 받았어요!`,
    diaryTitle: '모모의 카페 일기', diary0: '달콤한 딸기 향을 따라 친구들이 찾아왔어요. 첫 주문을 받아 볼까요? 🍓',
    diary: (a: string, n: string, m: string) => `${a} ${n}: “${m}, 정말 맛있어요! 다음에 또 올게요.” 오늘도 작은 행복을 나눴어요.`,
    lv: ['🍓 새싹 사장님', '🍓🍓 다정한 사장님', '🍓🍓🍓 인기 딸기 카페'], note: '🌷 서두르지 않아도 괜찮아요', sound: ['효과음 켜기', '효과음 끄기'], order: '주문',
  },
  en: {
    title: 'Strawberry Cafe', open: 'Strawberry cafe is open', happy: (n: number) => `${n} happy cups today`,
    welcome: 'Orders', hint: 'Tap a guest to take the order, tap the ticket to cook. When done, tap to pick it up and hand it to the guest.',
    empty: 'Tap a guest to take an order 💬', taken: (n: string) => `Took ${n}'s order! Tap the ticket to cook.`,
    already: (n: string) => `You already took ${n}'s order.`, full: 'All cooking spots are busy. Wait for one to finish 🍳',
    tapCook: 'Tap to cook', cooking: 'Cooking…', ready: 'Done! Tap to pick up', holding: 'Holding · tap the guest',
    hold: (m: string) => `Holding ${m}. Tap the guest who ordered it.`, notReady: 'Still cooking.',
    wrong: (n: string) => `That is not ${n}'s order 💛`, nothing: 'Pick up a finished dish first.',
    paid: (p: number) => `Got ${p} coins. A new guest sat down!`, joy: (p: number) => `One happy guest, +${p} coins ✨`, bonus: `🎉 First regular! Bonus ${BONUS} coins!`,
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
  const [guests, setGuests] = useState(() => [newGuest(0), newGuest(1), newGuest(2)])
  /** 받은 주문서: guest = 손님 자리, doneAt = 요리가 끝나는 시각(아직 안 만들었으면 null) */
  const [tickets, setTickets] = useState<{ guest: number; doneAt: number | null }[]>([])
  const [held, setHeld] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [sound, setSound] = useState(false)
  const [status, setStatus] = useState(tx.empty)
  const [diary, setDiary] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number>(0)

  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const cooking = tickets.some((t) => t.doneAt !== null && t.doneAt > now)
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
    toastTimer.current = window.setTimeout(() => setToast(''), 3000)
  }
  const beep = () => { if (sound) tone() }
  const name = (m: { ko: string; en: string }) => m[lang]
  const level = st.served >= 15 ? 2 : st.served >= 5 ? 1 : 0
  const ticketOf = (guest: number) => tickets.find((t) => t.guest === guest)
  const isReady = (t: { doneAt: number | null }) => t.doneAt !== null && t.doneAt <= now
  const cookingCount = tickets.filter((t) => t.doneAt !== null && t.doneAt > now).length

  /** 손님을 누르면: 들고 있는 게 있으면 건네고, 아니면 주문을 받는다 */
  const tapGuest = (i: number) => {
    const g = guests[i]
    if (held !== null) {
      if (held !== i) { say(tx.wrong(g.name)); return }
      const m = MENU[g.wish]
      const bonus = st.served + 1 >= GOAL && !st.reward
      save({ served: st.served + 1, reward: st.reward || bonus })
      actFarm({ type: 'earn', amount: m.price + (bonus ? BONUS : 0) })
      beep()
      setDiary(tx.diary(g.animal, g.name, name(m)))
      setGuests((gs) => gs.map((x, k) => (k === i ? newGuest(i) : x)))
      setTickets((ts) => ts.filter((t) => t.guest !== i))
      setHeld(null)
      setStatus(tx.paid(m.price))
      say(bonus ? tx.bonus : tx.joy(m.price))
      return
    }
    if (g.taken) { say(tx.already(g.name)); return }
    setGuests((gs) => gs.map((x, k) => (k === i ? { ...x, taken: true } : x)))
    setTickets((ts) => [...ts, { guest: i, doneAt: null }])
    setStatus(tx.taken(g.name))
    beep()
  }
  /** 주문서를 누르면: 만들기 시작 → (완성되면) 들기 */
  const tapTicket = (guest: number) => {
    const t = ticketOf(guest)
    if (!t) return
    if (t.doneAt === null) {
      if (cookingCount >= SLOTS) { say(tx.full); return }
      const at = Date.now()
      setNow(at)
      setTickets((ts) => ts.map((x) => (x.guest === guest ? { ...x, doneAt: at + cookMs(MENU[guests[guest].wish].price) } : x)))
      return
    }
    if (!isReady(t)) { say(tx.notReady); return }
    const next = held === guest ? null : guest
    setHeld(next)
    setStatus(next === null ? tx.nothing : tx.hold(name(MENU[guests[guest].wish])))
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
          {guests.map((x, i) => (
            <button
              key={i}
              aria-label={`${x.name} ${tx.order}`}
              onClick={() => tapGuest(i)}
              className={`absolute rounded-3xl border-0 bg-transparent p-0 ${held !== null ? 'ring-4 ring-white/90 ring-offset-2 ring-offset-[#e8707f]/60' : ''}`}
              style={{ left: `${SEATS[i].box.left}%`, top: `${SEATS[i].box.top}%`, width: `${SEATS[i].box.width}%`, height: `${SEATS[i].box.height}%` }}
            >
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-[#fff8f4]/95 px-2 py-0.5 text-[10px] whitespace-nowrap">{x.name}</span>
            </button>
          ))}
          {guests.map((x, i) => {
            const bx = SEATS[i].box
            return (
              <span
                key={`bubble${i}`}
                aria-hidden
                className="pointer-events-none absolute z-[2] -translate-x-1/2 -translate-y-full rounded-3xl bg-[#fffdf8] p-1.5 shadow-[0_4px_0_#f0c6cd]"
                style={{ left: `${Math.min(Math.max(bx.left + bx.width / 2, 14), 86)}%`, top: `${bx.top}%` }}
              
              >{x.taken ? <Ico id={MENU[x.wish].id} className="h-14 w-14" /> : <span className="block h-14 w-14 animate-pulse text-center text-5xl leading-[3.5rem]">💬</span>}</span>
            )
          })}
        </div>
        <div className="flex justify-between gap-2 bg-[#fff8f4] px-4 py-3 text-xs"><span>{tx.note}</span><span>{tx.happy(st.served)}</span></div>
      </div>

      <section className={`${panel} mt-3`}>
        <h2 className={h2} style={{ fontFamily: FONT }}>{tx.welcome} <span className="text-xs text-[#a58d76]">{cookingCount} / {SLOTS}</span></h2>
        <p className="m-0 text-xs leading-relaxed text-[#a58d76]">{tx.hint}</p>
        <div className="my-3 flex flex-col gap-2">
          {tickets.length === 0 && <p className="m-0 rounded-2xl border border-dashed border-[#d8bfa2] bg-[#fffdf8] p-4 text-center text-xs text-[#a48a70]">{tx.empty}</p>}
          {tickets.map((t) => {
            const g = guests[t.guest]
            const m = MENU[g.wish]
            const ready = isReady(t)
            const left = t.doneAt === null ? 1 : Math.max(0, (t.doneAt - now) / cookMs(m.price))
            return (
              <button
                key={t.guest}
                aria-label={`${g.name} · ${name(m)}`}
                onClick={() => tapTicket(t.guest)}
                className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left ${held === t.guest ? 'border-[#e8707f] bg-[#fde3e6]' : ready ? 'border-[#9bd0a0] bg-[#eaf6e6]' : 'border-[#d8bfa2] bg-[#fffdf8]'}`}
              >
                <Ico id={m.id} className={`h-14 w-14 ${t.doneAt === null ? 'opacity-70' : ''} ${ready && held !== t.guest ? 'animate-pulse' : ''}`} />
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">{g.animal} {g.name}</strong>
                  <span className="mt-0.5 block text-[11px] text-[#a48a70]">{held === t.guest ? tx.holding : ready ? tx.ready : t.doneAt === null ? tx.tapCook : tx.cooking}</span>
                  {t.doneAt !== null && !ready && <span className="mt-1.5 block h-[6px] overflow-hidden rounded-full bg-[#eee4d3]"><i className="block h-full bg-[#ef8d99]" style={{ width: `${(1 - left) * 100}%` }} /></span>}
                </span>
                <span className="shrink-0 text-xs font-bold text-[#c9855a]">🪙 {m.price}</span>
              </button>
            )
          })}
        </div>
        <p className="m-0 min-h-9 text-xs leading-relaxed text-[#7c8b69]" role="status" aria-live="polite">{status}</p>
      </section>

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
