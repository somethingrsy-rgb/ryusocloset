import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { assetUrl } from '../lib/items'

type Menu = { id: string; ko: string; en: string; price: number }
/** 메뉴 그림은 public/cafe/menu/<id>.webp */
const MENU: Menu[] = [
  { id: 'milk', ko: '딸기 우유', en: 'Strawberry milk', price: 20 },
  { id: 'tea', ko: '딸기 홍차', en: 'Strawberry tea', price: 25 },
  { id: 'jam', ko: '딸기 잼', en: 'Strawberry jam', price: 30 },
  { id: 'cup2', ko: '핑크 컵케이크', en: 'Pink cupcake', price: 30 },
  { id: 'cup3', ko: '곰젤리 컵케이크', en: 'Gummy cupcake', price: 30 },
  { id: 'slice', ko: '딸기 케이크', en: 'Strawberry cake', price: 35 },
  { id: 'cup1', ko: '하트 컵케이크', en: 'Heart cupcake', price: 35 },
  { id: 'cup4', ko: '스위트하트 컵케이크', en: 'Sweet heart cupcake', price: 35 },
  { id: 'cup6', ko: '러브 컵케이크', en: 'Love cupcake', price: 40 },
  { id: 'tart', ko: '딸기 타르트', en: 'Strawberry tart', price: 40 },
  { id: 'basket', ko: '딸기 바구니', en: 'Strawberry basket', price: 45 },
  { id: 'cup5', ko: '고양이 컵케이크', en: 'Kitty cupcake', price: 50 },
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
const ITEMS = [
  { id: 'vines', icon: '🍓', ko: '딸기 덩굴', en: 'Strawberry vines', price: 70 },
  { id: 'flowers', icon: '🌸', ko: '꽃 화분', en: 'Flower pots', price: 100 },
  { id: 'garland', icon: '🎀', ko: '리본 가랜드', en: 'Ribbon garland', price: 120 },
  { id: 'sparkle', icon: '✨', ko: '반짝이 별빛', en: 'Sparkles', price: 150 },
  { id: 'cat', icon: '🐱', ko: '고양이 친구', en: 'Cat friend', price: 200 },
]
const COOK_MS = 2400
const GOAL = 5
const KEY = 'ryuso.cafe.v1'

type Saved = { coins: number; served: number; owned: string[]; reward: boolean }
const loadSaved = (): Saved => {
  const base: Saved = { coins: 30, served: 0, owned: [], reward: false }
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (s && Number.isFinite(s.coins) && s.coins >= 0 && Number.isFinite(s.served) && Array.isArray(s.owned)) return { ...base, ...s }
  } catch { /* 저장소를 못 읽어도 새로 시작 */ }
  return base
}

const pick = (n: number) => Math.floor(Math.random() * n)
const newGuest = (i: number) => ({ animal: SEATS[i].animal, name: SEATS[i].name, order: pick(MENU.length) })

const T = {
  ko: {
    title: '딸기 카페', open: '딸기 카페 영업 중', happy: (n: number) => `오늘의 행복 ${n}잔`,
    tabOrder: '🍽 주문 만들기', tabShop: '🪴 카페 꾸미기', welcome: '어서 오세요, 딸기 카페예요!', hint: '손님을 누르고 주문한 메뉴를 만들어 주세요.',
    free: (p: number) => `완성하면 +${p} 코인 · 재료비 무료`, start: '요리 시작하기', cooking: '정성껏 만드는 중…', serve: '손님에게 내어 주기 ✨',
    pickFirst: '메뉴를 고르면 요리를 시작할 수 있어요.', picked: (m: string) => `${m} 선택! 요리를 시작해 볼까요?`,
    wrong: '주문서의 메뉴와 달라요. 손님이 고른 메뉴를 찾아 주세요 💛', wrongToast: '위 주문서의 그림과 같은 메뉴를 골라요',
    busy: '지금 만드는 주문을 먼저 마쳐 주세요 🍽', making: '모모가 맛있게 만들고 있어요… 🐱', done: '완성! 따뜻할 때 손님에게 내어 주세요 🍽',
    paid: (p: number) => `${p}코인을 받았어요. 새로운 친구가 찾아왔네요!`, joy: (p: number) => `행복한 손님 한 명, +${p} 코인 ✨`, bonus: '🎉 첫 단골 달성! 보너스 50코인!',
    shopTitle: '나만의 작은 카페', shopHint: '주문으로 번 코인으로 카페를 꾸며요.', placed: '배치 완료', more: (n: number) => `${n}코인을 더 모으면 살 수 있어요 🌱`,
    decorated: (n: string) => `${n}로 카페를 꾸몄어요!`, mission: '첫 단골 만들기', missionDone: '첫 단골 만들기 완료!', missionText: `손님 ${GOAL}명에게 행복을 전해 주세요`,
    count: (n: number) => `${n} / ${GOAL}명 · 달성 보너스 50코인`, countDone: '달성 완료 · 보너스 50코인을 받았어요!',
    diaryTitle: '모모의 카페 일기', diary0: '달콤한 딸기 향을 따라 친구들이 찾아왔어요. 첫 주문을 함께 만들어 볼까요? 🍓',
    diary: (a: string, n: string, m: string) => `${a} ${n}: “${m}, 정말 맛있어요! 다음에 또 올게요.” 오늘도 작은 행복을 나눴어요.`,
    lv: ['🍓 새싹 사장님', '🍓🍓 다정한 사장님', '🍓🍓🍓 인기 딸기 카페'], note: '🌷 서두르지 않아도 괜찮아요', sound: ['효과음 켜기', '효과음 끄기'], selected: ' · 선택', order: '주문',
  },
  en: {
    title: 'Strawberry Cafe', open: 'Strawberry cafe is open', happy: (n: number) => `${n} happy cups today`,
    tabOrder: '🍽 Orders', tabShop: '🪴 Decorate', welcome: 'Welcome to the Strawberry Cafe!', hint: 'Tap a guest, then make the dish they ordered.',
    free: (p: number) => `Finish for +${p} coins · free ingredients`, start: 'Start cooking', cooking: 'Cooking with care…', serve: 'Serve the guest ✨',
    pickFirst: 'Pick a dish to start cooking.', picked: (m: string) => `${m}! Ready to cook?`,
    wrong: "That's not on the order. Find what the guest picked 💛", wrongToast: 'Pick the same dish as the order above',
    busy: 'Please finish the current order first 🍽', making: 'Momo is cooking… 🐱', done: 'Done! Serve it while it is warm 🍽',
    paid: (p: number) => `Got ${p} coins. A new friend arrived!`, joy: (p: number) => `One happy guest, +${p} coins ✨`, bonus: '🎉 First regular! Bonus 50 coins!',
    shopTitle: 'My little cafe', shopHint: 'Decorate with the coins you earn.', placed: 'Placed', more: (n: number) => `${n} more coins to go 🌱`,
    decorated: (n: string) => `Decorated with ${n}!`, mission: 'Make a first regular', missionDone: 'First regular made!', missionText: `Make ${GOAL} guests happy`,
    count: (n: number) => `${n} / ${GOAL} guests · 50 bonus coins`, countDone: 'Done · you got 50 bonus coins!',
    diaryTitle: "Momo's cafe diary", diary0: 'Friends followed the sweet strawberry smell. Shall we make the first order? 🍓',
    diary: (a: string, n: string, m: string) => `${a} ${n}: “${m} is so yummy! I'll come again.” Shared a little happiness today.`,
    lv: ['🍓 Sprout boss', '🍓🍓 Kind boss', '🍓🍓🍓 Popular cafe'], note: '🌷 No need to rush', sound: ['Sound on', 'Sound off'], selected: ' · picked', order: 'Order',
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
  const [guests, setGuests] = useState(() => [newGuest(0), newGuest(1), newGuest(2)])
  const [active, setActive] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [phase, setPhase] = useState<'idle' | 'cooking' | 'ready'>('idle')
  const [sound, setSound] = useState(false)
  const [shop, setShop] = useState(false)
  const [status, setStatus] = useState(tx.pickFirst)
  const [diary, setDiary] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number>(0)
  const cookTimer = useRef<number>(0)

  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(cookTimer.current) }, [])
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

  const g = guests[active]
  const m = MENU[g.order]
  const level = st.served >= 15 ? 2 : st.served >= 5 ? 1 : 0

  const seat = (i: number) => {
    if (phase !== 'idle') { say(tx.busy); return }
    setActive(i)
    setSelected(null)
  }
  const act = () => {
    if (phase === 'cooking') return
    if (phase === 'ready') {
      const bonus = st.served + 1 >= GOAL && !st.reward
      save({ ...st, coins: st.coins + m.price + (bonus ? 50 : 0), served: st.served + 1, reward: st.reward || bonus })
      beep()
      setDiary(tx.diary(g.animal, g.name, name(m)))
      setGuests((gs) => gs.map((x, i) => (i === active ? newGuest(i) : x)))
      setPhase('idle')
      setSelected(null)
      setStatus(tx.paid(m.price))
      say(bonus ? tx.bonus : tx.joy(m.price))
      return
    }
    if (selected === null) return
    if (selected !== g.order) { setStatus(tx.wrong); say(tx.wrongToast); return }
    setPhase('cooking')
    setStatus(tx.making)
    cookTimer.current = window.setTimeout(() => {
      setPhase('ready')
      setStatus(tx.done)
      beep()
    }, COOK_MS)
  }
  const buy = (id: string) => {
    const item = ITEMS.find((x) => x.id === id)!
    if (st.owned.includes(id)) return
    if (st.coins < item.price) { say(tx.more(item.price - st.coins)); return }
    save({ ...st, coins: st.coins - item.price, owned: [...st.owned, id] })
    beep()
    say(tx.decorated(name(item)))
  }
  const has = (id: string) => st.owned.includes(id)

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
          <span className="rounded-full border border-[#e4d4bc] bg-[#fffaf0] px-3 py-1.5 text-sm">🪙 <b>{st.coins}</b></span>
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
          {has('vines') && <div aria-hidden className="absolute top-[1%] left-0 text-3xl leading-none drop-shadow">🍓🌸🍓🌸</div>}
          {has('vines') && <div aria-hidden className="absolute top-[1%] right-0 text-3xl leading-none drop-shadow">🌸🍓🌸🍓</div>}
          {has('flowers') && <div aria-hidden className="absolute bottom-[1%] left-[1%] text-4xl">🌸🌷</div>}
          {has('garland') && <div aria-hidden className="absolute inset-x-[12%] top-[66%] flex justify-around text-xl">🎀🍓🎀🍓🎀🍓🎀</div>}
          {has('sparkle') && <div aria-hidden className="absolute inset-0 animate-pulse text-2xl"><span className="absolute top-[8%] left-[8%]">✨</span><span className="absolute top-[30%] right-[6%]">✨</span><span className="absolute top-[52%] left-[48%]">✨</span><span className="absolute bottom-[10%] right-[12%]">✨</span></div>}
          {has('cat') && <div aria-hidden className="absolute bottom-[3%] left-[52%] text-5xl">🐱</div>}
          <span aria-hidden className={`absolute top-[55%] left-[29%] text-3xl ${phase === 'cooking' ? 'animate-bounce' : 'hidden'}`}>🍓</span>
          <p className="absolute top-2 left-2 m-0 rounded-xl bg-[#fffaf1]/90 px-2.5 py-1 text-[10px]"><i className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-[#e8707f]" />{tx.open}</p>
          {guests.map((x, i) => (
            <button
              key={i}
              aria-label={`${x.name} ${tx.order}: ${name(MENU[x.order])}`}
              aria-pressed={active === i}
              onClick={() => seat(i)}
              className={`absolute rounded-3xl border-0 bg-transparent p-0 ${active === i ? 'ring-4 ring-white/90 ring-offset-2 ring-offset-[#e8707f]/60' : ''}`}
              style={{ left: `${SEATS[i].box.left}%`, top: `${SEATS[i].box.top}%`, width: `${SEATS[i].box.width}%`, height: `${SEATS[i].box.height}%` }}
            >
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-2xl bg-[#fffdf8] px-2 py-0.5 whitespace-nowrap shadow-[0_3px_0_#f0c6cd]"><Ico id={MENU[x.order].id} className="h-9 w-9" /></span>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-[#fff8f4]/95 px-2 py-0.5 text-[10px] whitespace-nowrap">{x.name}{active === i ? tx.selected : ''}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-between gap-2 bg-[#fff8f4] px-4 py-3 text-xs"><span>{tx.note}</span><span>{tx.happy(st.served)}</span></div>
      </div>

      <section className={`${panel} mt-3`}>
        <div className="mb-3 flex gap-1.5">
          {[[false, tx.tabOrder], [true, tx.tabShop]].map(([v, label]) => (
            <button key={String(v)} onClick={() => setShop(v as boolean)} className={`flex-1 rounded-xl py-2.5 text-xs font-bold ${shop === v ? 'bg-[#fbd5da] text-[#b8424f]' : 'bg-[#f6ebe6]'}`}>{label}</button>
          ))}
        </div>
        {!shop ? (
          <>
            <h2 className={h2} style={{ fontFamily: FONT }}>{tx.welcome}</h2>
            <p className="m-0 text-xs leading-relaxed text-[#a58d76]">{tx.hint}</p>
            <div className="my-3 flex items-center gap-3 rounded-2xl border border-dashed border-[#d8bfa2] bg-[#fffdf8] p-3">
              <Ico id={m.id} className="h-14 w-14" />
              <div>
                <strong className="text-sm">{g.name} · {name(m)}</strong>
                <p className="m-0 mt-0.5 text-[11px] text-[#a48a70]">{tx.free(m.price)}</p>
              </div>
            </div>
            <div className="mb-3 grid grid-cols-4 gap-1.5">
              {MENU.map((x, i) => (
                <button
                  key={x.id}
                  disabled={phase !== 'idle'}
                  aria-pressed={selected === i}
                  onClick={() => { setSelected(i); setStatus(tx.picked(name(x))) }}
                  className={`rounded-2xl border border-b-[3px] px-0.5 py-2 text-[10px] leading-tight break-keep disabled:opacity-50 ${selected === i ? 'border-[#ea8c98] bg-[#fde3e6]' : 'border-[#e5d5bd] border-b-[#dfcaab] bg-[#f7efdf]'}`}
                ><Ico id={x.id} className="mx-auto mb-1 h-12 w-12" />{name(x)}</button>
              ))}
            </div>
            <button
              disabled={phase === 'cooking' || (phase === 'idle' && selected === null)}
              onClick={act}
              className="w-full rounded-2xl border-0 border-b-4 border-[#c04a5a] bg-[#e8707f] py-3 text-sm font-bold text-white disabled:opacity-50"
            >{phase === 'ready' ? tx.serve : phase === 'cooking' ? tx.cooking : tx.start}</button>
            <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-[#eee4d3]">
              <i className="block h-full bg-[#ef8d99]" style={{ width: phase === 'idle' ? '0%' : '100%', transition: phase === 'cooking' ? `width ${COOK_MS}ms linear` : 'none' }} />
            </div>
            <p className="mt-2 mb-0 min-h-9 text-xs leading-relaxed text-[#7c8b69]" role="status" aria-live="polite">{status}</p>
          </>
        ) : (
          <>
            <h2 className={h2} style={{ fontFamily: FONT }}>{tx.shopTitle}</h2>
            <p className="m-0 mb-2 text-xs text-[#a58d76]">{tx.shopHint}</p>
            {ITEMS.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-2 border-b border-[#eee2ce] py-3 text-xs last:border-0">
                <span><span aria-hidden className="mr-2 text-3xl">{x.icon}</span>{name(x)}</span>
                <button disabled={has(x.id)} onClick={() => buy(x.id)} className="rounded-lg bg-[#fbd5da] px-3 py-2 text-[11px] disabled:opacity-50">{has(x.id) ? tx.placed : `🪙 ${x.price}`}</button>
              </div>
            ))}
          </>
        )}
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
