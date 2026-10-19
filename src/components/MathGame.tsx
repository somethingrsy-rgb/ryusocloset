import { useLayoutEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { travelItem } from '../lib/game'
import { assetUrl } from '../lib/items'
import {
  AGES, MAX_PROFILES, addCorrect, addProfile, claimGift, countOf, isCleared, isUnlocked, levelsFor, readMath, removeProfile, totalOf, updateProfile, writeMath,
  type Age, type Choice, type MathState, type Pic, type Profile, type Question, type Shape, type Visual,
} from '../lib/mathGame'
import { playSnap } from '../lib/sound'
import { StarIcon } from './Icons'

const T = {
  ko: {
    title: '수학 놀이터', who: '누가 할까요?', add: '새 친구', name: '이름', age: '나이', age6: '6살', age8: '8살', make: '만들기', cancel: '취소', del: '지우기',
    delAsk: '이 친구의 기록을 지울까요?', intro: '문제를 모두 풀면 선물을 받아요. 틀려도 괜찮아요, 다시 해보면 돼요!', locked: '앞 단계를 먼저 깨요', cleared: '클리어', levels: '단계 고르기',
    right: ['잘했어요! 🎉', '맞아요! ⭐', '대단해요! 👏', '정답이에요! 🌟'], again: '괜찮아요, 다시 해볼까요? 💪', next: '다음 문제', gift: '선물이 도착했어요!', wear: '옷장에서 입어보기',
    allFound: '모든 선물을 이미 받았어요 ⭐', nextLevel: '다음 단계로', close: '닫기', back: '뒤로', read: '읽어 주기', calc: '계산해서 알맞은 수를 찾아요', ok: '확인', erase: '지우기', done: '다 풀었어요!', full: '친구는 4명까지 만들 수 있어요',
  },
  en: {
    title: 'Math Playground', who: 'Who is playing?', add: 'New friend', name: 'Name', age: 'Age', age6: '6 years', age8: '8 years', make: 'Create', cancel: 'Cancel', del: 'Delete',
    delAsk: "Delete this friend's progress?", intro: 'Finish every question to get a gift. Mistakes are fine, just try again!', locked: 'Clear the level before first', cleared: 'Cleared', levels: 'Levels',
    right: ['Great job! 🎉', 'Correct! ⭐', 'Awesome! 👏', "You got it! 🌟"], again: "That's okay, try again! 💪", next: 'Next', gift: 'A gift for you!', wear: 'Try it on',
    allFound: 'You already have every gift ⭐', nextLevel: 'Next level', close: 'Close', back: 'Back', read: 'Read it', calc: 'Work it out and find the number', ok: 'OK', erase: 'Erase', done: 'All done!', full: 'Up to 4 friends',
  },
}

const SHAPE_COLOR = '#f4a259'
function ShapeSvg({ shape, size = 56 }: { shape: Shape; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden>
      {shape === 'circle' && <circle cx="28" cy="28" r="24" fill={SHAPE_COLOR} />}
      {shape === 'tri' && <polygon points="28,5 52,50 4,50" fill={SHAPE_COLOR} />}
      {shape === 'square' && <rect x="6" y="6" width="44" height="44" rx="3" fill={SHAPE_COLOR} />}
    </svg>
  )
}
function CupSvg({ level }: { level: number }) {
  const h = 54 * level
  return (
    <svg width="52" height="70" viewBox="0 0 52 70" aria-hidden>
      <rect x="8" y={62 - h} width="36" height={h} fill="#8cc8f0" />
      <path d="M6 6 L10 64 H42 L46 6" fill="none" stroke="#5b7f8c" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}
function PicView({ pic }: { pic: Pic }) {
  if ('shape' in pic) return <ShapeSvg shape={pic.shape} size={58} />
  if ('bar' in pic) return <span className="block h-4 rounded-full bg-[#8db674]" style={{ width: `${pic.bar * 100}%` }} />
  if ('cup' in pic) return <CupSvg level={pic.cup} />
  return (
    <span className="inline-flex flex-wrap items-end justify-center leading-none" style={{ fontSize: `${2.1 * (pic.scale ?? 1)}rem`, gap: '0.1em' }}>
      {Array.from({ length: pic.n ?? 1 }, (_, i) => <span key={i}>{pic.emoji}</span>)}
    </span>
  )
}
function ClockSvg({ h, m }: { h: number; m: number }) {
  const hourAngle = ((h % 12) + m / 60) * 30
  const minAngle = m * 6
  const hand = (deg: number, len: number, w: number) => <line x1="100" y1="100" x2={100 + len * Math.sin((deg * Math.PI) / 180)} y2={100 - len * Math.cos((deg * Math.PI) / 180)} stroke="#213f35" strokeWidth={w} strokeLinecap="round" />
  return (
    <svg viewBox="0 0 200 200" className="mx-auto h-[min(11rem,24dvh)] w-[min(11rem,24dvh)]" role="img" aria-label="clock">
      <circle cx="100" cy="100" r="94" fill="#fff" stroke="#246f55" strokeWidth="6" />
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1
        const a = (n * 30 * Math.PI) / 180
        return <text key={n} x={100 + 76 * Math.sin(a)} y={100 - 76 * Math.cos(a) + 7} textAnchor="middle" fontSize="20" fontWeight="700" fill="#213f35">{n}</text>
      })}
      {hand(hourAngle, 44, 8)}
      {hand(minAngle, 68, 5)}
      <circle cx="100" cy="100" r="6" fill="#246f55" />
    </svg>
  )
}
function Faded({ emoji, gone }: { emoji: string; gone: boolean }) {
  return <span className={`relative ${gone ? 'opacity-30' : ''}`}>{emoji}{gone && <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-red-500">✕</span>}</span>
}
function BalanceSvg({ left, right, heavier }: { left: string; right: string; heavier: 'left' | 'right' }) {
  const tilt = heavier === 'left' ? -10 : 10 // 무거운 쪽이 아래로
  const dy = Math.sin((Math.abs(tilt) * Math.PI) / 180) * 70
  const ly = 50 + (heavier === 'left' ? dy : -dy)
  const ry = 50 + (heavier === 'right' ? dy : -dy)
  return (
    <svg viewBox="0 0 240 150" className="mx-auto h-[min(9rem,20dvh)] w-[min(15rem,33dvh)]" role="img" aria-label="balance">
      <rect x="116" y="40" width="8" height="90" rx="3" fill="#8a6a4a" />
      <rect x="90" y="128" width="60" height="10" rx="4" fill="#8a6a4a" />
      <line x1="50" y1={ly} x2="190" y2={ry} stroke="#8a6a4a" strokeWidth="7" strokeLinecap="round" />
      <path d={`M30 ${ly + 28} Q50 ${ly + 44} 70 ${ly + 28} Z`} fill="#c9a24a" />
      <path d={`M170 ${ry + 28} Q190 ${ry + 44} 210 ${ry + 28} Z`} fill="#c9a24a" />
      <text x="50" y={ly + 22} textAnchor="middle" fontSize="30">{left}</text>
      <text x="190" y={ry + 22} textAnchor="middle" fontSize="30">{right}</text>
    </svg>
  )
}
function VisualView({ v }: { v: Visual }) {
  if (v.kind === 'clock') return <ClockSvg h={v.h} m={v.m} />
  if (v.kind === 'balance') return <BalanceSvg left={v.left} right={v.right} heavier={v.heavier} />
  if (v.kind === 'shapes') return <div className="flex flex-wrap items-center justify-center gap-3">{v.list.map((sh, i) => <ShapeSvg key={i} shape={sh} size={64} />)}</div>
  if (v.kind === 'seq') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {v.items.map((it, i) => it === '?'
          ? <span key={i} className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-[#9bbd87] bg-white text-3xl">?</span>
          : <span key={i} className="flex h-14 min-w-14 items-center justify-center rounded-2xl bg-white px-2 text-4xl">{it}</span>)}
      </div>
    )
  }
  if (v.kind === 'tens') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        {Array.from({ length: v.tens }, (_, i) => (
          <span key={i} className="grid grid-cols-5 gap-0.5 rounded-xl border-2 border-[#9bbd87] bg-white p-1.5 text-xl leading-none">{Array.from({ length: 10 }, (_, k) => <span key={k}>{v.emoji}</span>)}</span>
        ))}
        {v.ones > 0 && <span className="flex max-w-[14rem] flex-wrap justify-center gap-1 text-2xl leading-none">{Array.from({ length: v.ones }, (_, k) => <span key={k}>{v.emoji}</span>)}</span>}
      </div>
    )
  }
  return (
    <div className={v.op || v.groups.length < 2 ? 'flex flex-wrap items-center justify-center gap-3' : 'grid grid-cols-2 items-center gap-3'}>
      {v.groups.map((g, gi) => (
        <span key={gi} className="contents">
          {gi > 0 && v.op && <span className="text-3xl font-black">{v.op}</span>}
          <span className="flex h-full min-h-24 max-w-full flex-wrap content-center items-center justify-center gap-2 rounded-2xl bg-white/70 px-2 py-3 text-4xl leading-none">
            {Array.from({ length: g.n }, (_, i) => <Faded key={i} emoji={g.emoji} gone={i >= g.n - (g.cross ?? 0)} />)}
          </span>
        </span>
      ))}
    </div>
  )
}

function speak(text: string, lang: string) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang === 'ko' ? 'ko-KR' : 'en-US'
    u.rate = 0.9
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  } catch { /* 소리를 못 내는 기기는 그냥 넘어간다 */ }
}

/** 아이용 수학 놀이터: 친구(이름·나이)를 고르면 나이에 맞는 단계가 나오고, 단계의 문제를 모두 풀면 선물을 준다 */
export function MathGame({ onClose, onWear }: { onClose: () => void; onWear: (id: string) => void }) {
  const { lang } = useI18n()
  const tx = T[lang]
  const [state, setState] = useState<MathState>(readMath)
  const [pid, setPid] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // 문제 화면이 화면보다 길면 스크롤 대신 통째로 줄여서 한 화면에 맞춘다(기기·글꼴이 달라도). 너무 작아지면(60% 아래) 스크롤로 둔다
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null)
  const [innerEl, setInnerEl] = useState<HTMLDivElement | null>(null)
  const [fit, setFit] = useState(1)
  useLayoutEffect(() => {
    if (!boxEl || !innerEl) { setFit(1); return }
    const calc = () => {
      const cs = getComputedStyle(boxEl)
      const avail = boxEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      const next = innerEl.offsetHeight > 0 ? Math.min(1, Math.max(0.6, avail / innerEl.offsetHeight)) : 1
      if (next < 1 && next > 0.6) boxEl.scrollTop = 0
      setFit(next)
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(boxEl)
    ro.observe(innerEl)
    return () => ro.disconnect()
  }, [boxEl, innerEl])
  const [name, setName] = useState('')
  const [age, setAge] = useState<Age>(6)
  const [level, setLevel] = useState<number | null>(null)
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number[]>([])
  const [typed, setTyped] = useState('')
  const [placed, setPlaced] = useState<number[]>([])
  const [wrong, setWrong] = useState(false)
  const [right, setRight] = useState<string | null>(null)
  const [gifted, setGifted] = useState(false)
  const [gift, setGift] = useState<{ id: string | null } | null>(null)

  const profile: Profile | undefined = state.profiles.find((p) => p.id === pid)
  const lv = levelsFor(profile?.age ?? 6).find((l) => l.id === level)
  const giftItem = gift?.id ? travelItem(gift.id) : undefined
  const save = (s: MathState) => { setState(s); writeMath(s) }

  const q: Question | null = lv ? lv.questions[idx] ?? null : null
  const reset = () => { setPicked([]); setTyped(''); setPlaced([]); setWrong(false); setRight(null) }
  const open = (id: number) => {
    const l = levelsFor(profile?.age ?? 6).find((x) => x.id === id)!
    const done = profile ? countOf(profile, id) : 0
    setLevel(id); setGift(null); setGifted(false); reset()
    setIdx(done >= l.questions.length ? 0 : done)
  }
  /** 문제를 맞혔을 때: 소리·칭찬·기록 */
  const solved = () => {
    if (!q || !lv || !profile) return
    playSnap()
    setWrong(false)
    setRight(tx.right[Math.floor(Math.random() * tx.right.length)])
    const { next, justCleared } = addCorrect(profile, lv.id, idx + 1)
    let saved = next
    if (justCleared) {
      const c = claimGift(next, lv.id)
      saved = c.next
      setGift({ id: c.gift })
    }
    if (saved !== profile) save(updateProfile(state, saved))
  }
  const pickChoice = (i: number) => {
    if (!q || q.kind !== 'choice' || right || picked.includes(i)) return
    if (i !== q.answer) { setPicked((p) => [...p, i]); return setWrong(true) }
    solved()
  }
  const submitInput = () => {
    if (!q || q.kind !== 'input' || right || !typed) return
    if (Number(typed) === q.answer) solved(); else { setWrong(true); setTyped('') }
  }
  const tapCard = (c: number) => {
    if (!q || q.kind !== 'order' || right || placed.includes(c)) return
    const sorted = [...q.cards].sort((x, y) => x - y)
    if (c !== sorted[placed.length]) return setWrong(true)
    setWrong(false)
    const now = [...placed, c]
    setPlaced(now)
    if (now.length === q.cards.length) solved()
  }
  const nextQuestion = () => {
    if (!lv) return
    if (idx + 1 < lv.questions.length) { setIdx(idx + 1); reset(); return }
    if (gift && !gifted) { setGifted(true); return } // 선물 화면으로
    setLevel(null); setGift(null); setGifted(false); reset()
  }
  const create = () => {
    const r = addProfile(state, name, age)
    if (!r.id) return
    save(r.next)
    setPid(r.id)
    setAdding(false)
    setName('')
  }

  const big = 'math-btn min-h-14 rounded-3xl border border-[#e5e8df] px-4 py-3 text-lg font-bold text-[#213f35] active:scale-95'
  const total = lv ? lv.questions.length : 0
  const calcAll = q && (q.kind === 'choice' || q.kind === 'input') ? q.text.match(/^(\d+) ([+−]) (\d+) = □$/) : null
  const calc = calcAll && (calcAll[1].length > 1 || calcAll[3].length > 1) ? calcAll : null
  const row4 = !!q && q.kind === 'choice' && q.choices.length === 4 && q.choices.every((c) => !c.pic && /^[\d.,\s]{1,3}$/.test(c.label ?? ''))
  const flat = calcAll && !calc ? calcAll : null
  const answerText = q && q.kind === 'input' ? typed : q && right && q.kind === 'choice' ? q.choices[q.answer].label : ''
  const levels = profile ? levelsFor(profile.age) : []
  const hasNext = lv ? levels.findIndex((l) => l.id === lv.id) < levels.length - 1 : false
  const goBack = () => { if (gift || level !== null) { setLevel(null); setGift(null); setGifted(false); reset() } else if (pid) setPid(null); else onClose() }

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden rounded-3xl bg-[#faf9f2] text-[#213f35] ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-2 border-b border-[#e2e7dc] px-4 py-3">
        <button onClick={goBack} aria-label={tx.back} className="flex h-12 w-12 items-center justify-center rounded-full border border-[#dce4d7] bg-white text-xl text-[#246f55]">←</button>
        <h2 className="m-0 flex items-center gap-2 text-xl font-normal [font-family:Jua,'Noto_Sans_KR',sans-serif]"><span className="rounded-2xl bg-[#e2eddb] px-2 py-1 text-2xl">🌱</span>{tx.title}</h2>
        <button onClick={onClose} aria-label={tx.close} className="flex h-12 w-12 items-center justify-center rounded-full border border-[#dce4d7] bg-white text-xl text-[#246f55]">✕</button>
      </div>
      <div ref={setBoxEl} className={`min-h-0 flex-1 px-4 pt-4 pb-4 ${fit < 1 && fit > 0.6 ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
        {!profile ? (
          <>
            <div className="relative mb-4 flex min-h-36 items-center overflow-hidden rounded-3xl bg-[#e8efdc] px-5 py-4">
              <div className="z-10"><p className="m-0 text-xs font-extrabold tracking-widest text-[#6b9278]">LITTLE FOREST</p><p className="mt-1 mb-0 text-2xl leading-tight [font-family:Jua,'Noto_Sans_KR',sans-serif]">{tx.who}</p></div>
              <span aria-hidden className="absolute -right-24 -bottom-24 h-48 w-80 rotate-[-12deg] rounded-full bg-[#c5dba9]" />
              <span aria-hidden className="absolute right-3 bottom-1 animate-bounce text-6xl">🦊</span>
              <span aria-hidden className="absolute top-2 right-4 text-3xl">☀️</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {state.profiles.map((p) => (
                <div key={p.id} className="relative">
                  <button onClick={() => setPid(p.id)} className={`${big} flex h-full min-h-28 w-full flex-col items-center justify-center bg-white`}>
                    <span className="text-4xl">{p.age === 6 ? '🐣' : '🦊'}</span>
                    <span>{p.name}</span>
                    <span className="text-sm font-bold text-[#6b8a78]">{p.age === 6 ? tx.age6 : tx.age8}</span>
                  </button>
                  <button aria-label={`${tx.del}: ${p.name}`} onClick={() => window.confirm(tx.delAsk) && save(removeProfile(state, p.id))} className="absolute top-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf0e3] text-xs">✕</button>
                </div>
              ))}
              {state.profiles.length < MAX_PROFILES ? (
                <button onClick={() => setAdding(true)} className={`${big} flex min-h-28 flex-col items-center justify-center border-2 border-dashed border-[#9bbd87] bg-white/60 text-[#246f55]`}>
                  <span className="text-4xl">＋</span>{tx.add}
                </button>
              ) : <p className="col-span-2 text-center text-xs">{tx.full}</p>}
            </div>
            {adding && (
              <div className="mt-4 rounded-3xl bg-white p-4 shadow">
                <label className="block text-sm font-bold">{tx.name}
                  <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-2xl border-2 border-petal px-3 py-3 text-lg" autoFocus />
                </label>
                <p className="mb-1 text-sm font-bold">{tx.age}</p>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={tx.age}>
                  {AGES.map((a) => (
                    <button key={a} role="radio" aria-checked={age === a} onClick={() => setAge(a)} className={`${big} ${age === a ? 'bg-[#246f55] text-white' : 'bg-[#eaf0e3]'}`}>{a === 6 ? '🐣 ' + tx.age6 : '🦊 ' + tx.age8}</button>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setAdding(false)} className={`${big} flex-1 bg-[#eaf0e3]`}>{tx.cancel}</button>
                  <button disabled={!name.trim()} onClick={create} className={`${big} flex-1 bg-[#246f55] text-white disabled:opacity-40`}>{tx.make}</button>
                </div>
              </div>
            )}
          </>
        ) : gift && gifted ? (
          <div className="py-2 text-center">
            <p className="text-2xl font-extrabold text-[#246f55]">🎁 {tx.gift}</p>
            {giftItem ? (
              <>
                <img src={assetUrl(giftItem.thumb)} alt="" className="mx-auto my-3 h-40 w-40 animate-bounce object-contain" />
                <p className="mb-3 text-lg font-bold">{giftItem.name[lang]}</p>
                <button className={`${big} mb-2 w-full bg-[#246f55] text-white`} onClick={() => { onClose(); onWear(giftItem.id) }}>{tx.wear}</button>
              </>
            ) : <p className="my-6 text-lg font-bold">{tx.allFound}</p>}
            <div className="flex gap-2">
              <button className={`${big} flex-1 bg-white`} onClick={() => { setLevel(null); setGift(null); setGifted(false); reset() }}>{tx.levels}</button>
              {hasNext && lv && <button className={`${big} flex-1 bg-white`} onClick={() => open(levels[levels.findIndex((l) => l.id === lv.id) + 1].id)}>{tx.nextLevel}</button>}
            </div>
          </div>
        ) : lv && q ? (
          <div ref={setInnerEl} className="flex min-h-full flex-col" style={fit < 1 ? { transform: `scale(${fit})`, transformOrigin: 'top center' } : undefined}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="m-0 text-base font-bold">{lv.icon} {lv.title[lang]}</p>
              <span className="text-sm font-extrabold">{idx + 1}/{total}{isCleared(profile, lv.id) ? <> <StarIcon /></> : null}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#edf0e7]">
              <div className="h-full rounded-full bg-[#8db674] transition-all" style={{ width: `${((right ? idx + 1 : idx) / total) * 100}%` }} />
            </div>
            <div className="flex flex-1 flex-col justify-evenly gap-3 pb-2">
            <div className="flex items-center justify-center gap-2">
              <p className="m-0 text-center text-xl leading-snug font-extrabold">{calcAll ? tx.calc : q.text}</p>
              <button aria-label={tx.read} onClick={() => speak(calcAll ? `${calcAll[1]} ${calcAll[2] === '+' ? '더하기' : '빼기'} ${calcAll[3]}` : q.text, lang)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg shadow">🔊</button>
            </div>
            {calc && (
              <div className="my-3 rounded-[24px] bg-[#e8efdc] px-2 py-3">
                <div className="mx-auto w-fit text-[3.25rem] leading-[1.05] font-normal [font-family:Jua,'Noto_Sans_KR',sans-serif]">
                  <div className="text-right">{calc[1]}</div>
                  <div className="flex items-center justify-between gap-8"><span className="text-[2.5rem]">{calc[2]}</span><span>{calc[3]}</span></div>
                  <div className="mt-1 min-w-[5rem] border-t-[5px] border-[#213f35] pt-0.5 text-right text-[#246f55]">
                    {q.kind === 'input' ? <>{typed || <span className="opacity-30">?</span>}<span className="animate-pulse">|</span></> : right && q.kind === 'choice' ? q.choices[q.answer].label : <span className="opacity-30">?</span>}
                  </div>
                </div>
              </div>
            )}
            {flat && (
              <div className="my-4 flex items-center justify-center gap-3 rounded-[24px] bg-[#e8efdc] px-4 py-7 text-[3.5rem] leading-none [font-family:Jua,'Noto_Sans_KR',sans-serif]">
                <span>{flat[1]}</span><span>{flat[2]}</span><span>{flat[3]}</span><span>=</span>
                <span className="inline-block min-w-[3.5rem] rounded-2xl bg-white/70 px-2 text-center text-[#246f55]">{answerText || <span className="opacity-30">?</span>}{q.kind === 'input' && !right && <span className="animate-pulse">|</span>}</span>
              </div>
            )}
            {!calc && !flat && (q.visual || q.kind === 'input') && (
              <div className="my-4 rounded-[24px] bg-[#e8efdc] p-4 text-center">
                {q.visual && <VisualView v={q.visual} />}
                {q.kind === 'input' && <p className={`m-0 text-5xl font-extrabold text-[#246f55] ${q.visual ? 'mt-2' : ''}`}>{typed || '　'}<span className="animate-pulse">|</span></p>}
              </div>
            )}
            {q.kind === 'choice' && (
              <div className={`mt-4 grid ${row4 ? 'grid-cols-4 gap-2' : `gap-4 ${q.choices.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}`}>
                {q.choices.map((c: Choice, i) => (
                  <button
                    key={i}
                    disabled={picked.includes(i) || (!!right && i !== q.answer)}
                    onClick={() => pickChoice(i)}
                    className={`math-choice flex ${row4 ? "min-h-[6rem]" : "min-h-[4.5rem]"} flex-col items-center justify-center gap-1 rounded-[20px] border-2 border-b-[6px] px-1 py-2 text-[#246f55] ${c.pic ? '' : `${/^[\d.,\s]{1,3}$/.test(c.label ?? '') ? (row4 ? 'text-4xl' : 'text-5xl') : 'text-xl leading-tight break-keep'} [font-family:Jua,'Noto_Sans_KR',sans-serif]`} ${right && i === q.answer ? 'animate-pulse border-[#7caf69] bg-[#d0edbd]' : picked.includes(i) ? 'border-[#edb4a6] bg-[#ffe2dc]' : 'border-[#e0e7d7] border-b-[#dce5d0] bg-white active:scale-95'} disabled:opacity-60`}
                  >
                    {c.pic && <span className="flex w-full items-end justify-center">{'bar' in c.pic ? <span className="block w-full px-2"><PicView pic={c.pic} /></span> : <PicView pic={c.pic} />}</span>}
                    {c.label && <span className={c.pic ? 'text-sm font-bold' : ''}>{c.label}</span>}
                  </button>
                ))}
              </div>
            )}
            {q.kind === 'input' && !right && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button key={d} onClick={() => { setWrong(false); setTyped((t) => (t.length < 3 ? t + d : t)) }} className="math-choice min-h-12 rounded-2xl border-2 border-b-4 border-[#e0e7d7] bg-white text-3xl text-[#246f55] active:scale-95">{d}</button>
                ))}
                <button onClick={() => setTyped((t) => t.slice(0, -1))} aria-label={tx.erase} className="min-h-12 rounded-2xl border-2 border-b-4 border-[#e0e7d7] bg-white text-2xl text-[#246f55] active:scale-95">⌫</button>
                <button onClick={() => { setWrong(false); setTyped((t) => (t.length < 3 ? t + '0' : t)) }} className="math-choice min-h-12 rounded-2xl border-2 border-b-4 border-[#e0e7d7] bg-white text-3xl text-[#246f55] active:scale-95">0</button>
                <button disabled={!typed} onClick={submitInput} className="min-h-12 rounded-2xl bg-[#246f55] text-lg font-bold text-white disabled:opacity-40 active:scale-95">{tx.ok}</button>
              </div>
            )}
            {q.kind === 'order' && (
              <div className="mt-3">
                <div className="mb-3 flex justify-center gap-2" aria-label="slots">
                  {q.cards.map((_, i) => <span key={i} className={`flex h-12 min-w-12 items-center justify-center rounded-2xl border-2 px-2 text-3xl font-extrabold ${placed[i] !== undefined ? 'border-[#7caf69] bg-[#d0edbd] text-[#246f55]' : 'border-dashed border-[#9bbd87] bg-white/60'}`}>{placed[i] ?? ''}</span>)}
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {q.cards.map((c) => (
                    <button key={c} disabled={placed.includes(c) || !!right} onClick={() => tapCard(c)} className="math-choice min-h-14 rounded-2xl border-2 border-b-[5px] border-[#e0e7d7] border-b-[#dce5d0] bg-white text-4xl text-[#246f55] active:scale-95 disabled:opacity-30">{c}</button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-3 min-h-7 text-center text-lg font-extrabold" aria-live="polite">{right ?? (wrong ? tx.again : '')}</p>
            {right && <p className="mt-0 mb-3 rounded-2xl bg-white px-3 py-2 text-center text-sm text-[#678071]">💡 {q.why}</p>}
            {right && <button className={`${big} mt-1 w-full !py-2 bg-[#246f55] text-white`} onClick={nextQuestion}>{idx + 1 < total ? tx.next : gift ? tx.gift : tx.done}</button>}
            </div>
          </div>
        ) : (
          <>
            <p className="mt-0 rounded-2xl bg-white px-4 py-3 text-center text-sm text-[#678071]">🌿 {tx.intro}</p>
            <div className="mt-3 flex flex-col gap-3">
              {levels.map((l, i) => {
                const ok = isUnlocked(profile, l.id)
                return (
                  <button key={l.id} disabled={!ok} onClick={() => open(l.id)} className={`${big} flex items-center justify-between bg-white text-left disabled:opacity-50`}>
                    <span className="flex items-center gap-3">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ background: ['#fce9e2', '#e9eedb', '#fff1cd', '#e4edf7'][i % 4] }}>{ok ? l.icon : '🔒'}</span>
                      <span>
                        <span className="text-xl font-normal [font-family:Jua,'Noto_Sans_KR',sans-serif]">{i + 1}. {l.title[lang]}</span>
                        <span className="mt-1 block text-sm font-bold text-[#6b8a78]">{ok ? l.hint[lang] : tx.locked}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-sm">{isCleared(profile, l.id) ? <><StarIcon /> {tx.cleared}</> : ok ? `${countOf(profile, l.id)}/${totalOf(l.id)}` : ''}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
