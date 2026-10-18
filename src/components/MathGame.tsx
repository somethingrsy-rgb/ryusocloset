import { useState } from 'react'
import { useI18n } from '../i18n'
import { travelItem } from '../lib/game'
import { assetUrl } from '../lib/items'
import {
  AGES, GOAL, MAX_PROFILES, addCorrect, addProfile, claimGift, countOf, isCleared, isUnlocked, levelsFor, readMath, removeProfile, updateProfile, writeMath,
  type Age, type MathState, type Profile, type Question, type Visual,
} from '../lib/mathGame'
import { playSnap } from '../lib/sound'

const T = {
  ko: {
    title: '수학 놀이터', who: '누가 할까요?', add: '새 친구', name: '이름', age: '나이', age6: '6살', age8: '8살', make: '만들기', cancel: '취소', del: '지우기',
    delAsk: '이 친구의 기록을 지울까요?', intro: `문제를 ${GOAL}개 맞히면 선물을 받아요. 틀려도 괜찮아요, 다시 해보면 돼요!`, locked: '앞 단계를 먼저 깨요', cleared: '클리어', levels: '단계 고르기',
    right: ['잘했어요! 🎉', '맞아요! ⭐', '대단해요! 👏', '정답이에요! 🌟'], again: '괜찮아요, 다시 해볼까요? 💪', next: '다음 문제', gift: '선물이 도착했어요!', wear: '옷장에서 입어보기',
    allFound: '모든 선물을 이미 받았어요 ⭐', nextLevel: '다음 단계로', close: '닫기', back: '뒤로', read: '읽어 주기', full: '친구는 4명까지 만들 수 있어요',
  },
  en: {
    title: 'Math Playground', who: 'Who is playing?', add: 'New friend', name: 'Name', age: 'Age', age6: '6 years', age8: '8 years', make: 'Create', cancel: 'Cancel', del: 'Delete',
    delAsk: "Delete this friend's progress?", intro: `Answer ${GOAL} questions right to get a gift. Mistakes are fine, just try again!`, locked: 'Clear the level before first', cleared: 'Cleared', levels: 'Levels',
    right: ['Great job! 🎉', 'Correct! ⭐', 'Awesome! 👏', "You got it! 🌟"], again: "That's okay, try again! 💪", next: 'Next', gift: 'A gift for you!', wear: 'Try it on',
    allFound: 'You already have every gift ⭐', nextLevel: 'Next level', close: 'Close', back: 'Back', read: 'Read it', full: 'Up to 4 friends',
  },
}

function Pictures({ v }: { v: Visual }) {
  const row = (n: number, faded = 0) => (
    <span className="inline-flex max-w-full flex-wrap justify-center gap-1 text-4xl leading-none">
      {Array.from({ length: n }, (_, i) => {
        const gone = i >= n - faded
        return <span key={i} className={`relative ${gone ? 'opacity-30' : ''}`}>{v.emoji}{gone && <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-red-500">✕</span>}</span>
      })}
    </span>
  )
  if (v.op === '+') return <div className="flex flex-wrap items-center justify-center gap-3">{row(v.a)}<span className="text-3xl font-black">+</span>{row(v.b ?? 0)}</div>
  if (v.op === '−') return <div className="flex justify-center">{row(v.a, v.b ?? 0)}</div>
  return <div className="flex justify-center">{row(v.a)}</div>
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

/** 아이용 수학 놀이터: 친구(이름·나이)를 고르면 나이에 맞는 단계가 나오고, 한 번에 맞힌 문제를 GOAL 개 채우면 선물을 준다 */
export function MathGame({ onClose, onWear }: { onClose: () => void; onWear: (id: string) => void }) {
  const { lang } = useI18n()
  const tx = T[lang]
  const [state, setState] = useState<MathState>(readMath)
  const [pid, setPid] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [age, setAge] = useState<Age>(6)
  const [level, setLevel] = useState<number | null>(null)
  const [q, setQ] = useState<Question | null>(null)
  const [picked, setPicked] = useState<number[]>([])
  const [right, setRight] = useState<string | null>(null)
  const [gift, setGift] = useState<{ id: string | null } | null>(null)

  const profile: Profile | undefined = state.profiles.find((p) => p.id === pid)
  const lv = levelsFor(profile?.age ?? 6).find((l) => l.id === level)
  const giftItem = gift?.id ? travelItem(gift.id) : undefined
  const save = (s: MathState) => { setState(s); writeMath(s) }

  const ask = (id: number) => {
    const l = levelsFor(profile?.age ?? 6).find((x) => x.id === id)!
    const next = l.make(Math.random)
    setQ(next)
    setPicked([])
    setRight(null)
    return next
  }
  const open = (id: number) => { setLevel(id); setGift(null); ask(id) }
  const answer = (n: number) => {
    if (!q || !lv || !profile || right) return
    if (n !== q.answer) return setPicked((p) => [...p, n])
    playSnap()
    setRight(tx.right[Math.floor(Math.random() * tx.right.length)])
    if (picked.length) return // 틀렸다가 맞힌 문제는 세지 않는다
    const { next, justCleared } = addCorrect(profile, lv.id)
    let saved = next
    if (justCleared) {
      const c = claimGift(next, lv.id)
      saved = c.next
      setGift({ id: c.gift })
    }
    save(updateProfile(state, saved))
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
  const count = profile && lv ? countOf(profile, lv.id) : 0
  const levels = profile ? levelsFor(profile.age) : []
  const hasNext = lv ? levels.findIndex((l) => l.id === lv.id) < levels.length - 1 : false
  const goBack = () => { if (gift || level !== null) { setLevel(null); setGift(null) } else if (pid) setPid(null); else onClose() }

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden rounded-3xl bg-[#faf9f2] text-[#213f35] ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-2 border-b border-[#e2e7dc] px-4 py-3">
        <button onClick={goBack} aria-label={tx.back} className="flex h-12 w-12 items-center justify-center rounded-full border border-[#dce4d7] bg-white text-xl text-[#246f55]">←</button>
        <h2 className="m-0 flex items-center gap-2 text-xl font-normal [font-family:Jua,'Noto_Sans_KR',sans-serif]"><span className="rounded-2xl bg-[#e2eddb] px-2 py-1 text-2xl">🌱</span>{tx.title}</h2>
        <button onClick={onClose} aria-label={tx.close} className="flex h-12 w-12 items-center justify-center rounded-full border border-[#dce4d7] bg-white text-xl text-[#246f55]">✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-5">
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
        ) : gift ? (
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
              <button className={`${big} flex-1 bg-white`} onClick={() => { setLevel(null); setGift(null) }}>{tx.levels}</button>
              {hasNext && lv && <button className={`${big} flex-1 bg-white`} onClick={() => open(levels[levels.findIndex((l) => l.id === lv.id) + 1].id)}>{tx.nextLevel}</button>}
            </div>
          </div>
        ) : lv && q ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="m-0 text-base font-bold">{lv.icon} {lv.title[lang]}</p>
              <span className="text-sm font-extrabold">{count}/{GOAL}{isCleared(profile, lv.id) ? ' ⭐' : ''}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#edf0e7]">
              <div className="h-full rounded-full bg-[#8db674] transition-all" style={{ width: `${(count / GOAL) * 100}%` }} />
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <p className="m-0 text-center text-xl font-extrabold">{q.prompt[lang]}</p>
              <button aria-label={tx.read} onClick={() => speak(`${q.prompt[lang]} ${q.visual ? '' : q.text.replace(/[=?]/g, '')}`, lang)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow">🔊</button>
            </div>
            <div className="my-4 rounded-[30px] bg-[#e8efdc] p-5 text-center [font-family:Jua,'Noto_Sans_KR',sans-serif]">
              {q.visual && <Pictures v={q.visual} />}
              {(!q.visual || q.visual.op) && <p className={`m-0 font-extrabold ${q.visual ? 'mt-3 text-2xl text-[#6b8a78]' : 'text-5xl'}`}>{q.text}{q.visual ? ' = ?' : ''}</p>}
            </div>
            <div className={`grid gap-3 ${q.choices.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
              {q.choices.map((n) => (
                <button
                  key={n}
                  disabled={picked.includes(n) || (!!right && n !== q.answer)}
                  onClick={() => answer(n)}
                  className={`math-choice min-h-20 rounded-[20px] border-2 border-b-[6px] text-[#246f55] [font-family:Jua,'Noto_Sans_KR',sans-serif] ${right && n === q.answer ? 'animate-bounce border-[#7caf69] bg-[#d0edbd]' : picked.includes(n) ? 'border-[#edb4a6] bg-[#ffe2dc]' : 'border-[#e0e7d7] border-b-[#dce5d0] bg-white active:scale-95'} disabled:opacity-60`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-4 min-h-8 text-center text-lg font-extrabold" aria-live="polite">{right ?? (picked.length ? tx.again : '')}</p>
            {right && <button className={`${big} mt-1 w-full bg-[#246f55] text-white`} onClick={() => ask(lv.id)}>{tx.next}</button>}
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
                    <span className="shrink-0 text-sm">{isCleared(profile, l.id) ? `⭐ ${tx.cleared}` : ok ? `${countOf(profile, l.id)}/${GOAL}` : ''}</span>
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
