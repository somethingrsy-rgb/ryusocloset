import { useState } from 'react'
import { useI18n } from '../i18n'
import { travelItem } from '../lib/game'
import { assetUrl } from '../lib/items'
import { GOAL, LEVELS, addCorrect, claimGift, countOf, isCleared, isUnlocked, readMath, writeMath, type MathProgress, type Question } from '../lib/mathGame'
import { playSnap } from '../lib/sound'
import { Modal } from './Modal'

const T = {
  ko: { title: '수학 놀이터', intro: `문제를 ${GOAL}개 맞히면 선물을 받아요. 틀려도 괜찮아요, 다시 풀면 돼요!`, start: '시작', locked: '앞 단계를 먼저 깨요', cleared: '클리어', levels: '단계 고르기', right: '정답! 🎉', again: '다시 풀어볼까?', next: '다음 문제', gift: '선물이 도착했어요!', wear: '옷장에서 입어보기', later: '나중에', allFound: '모든 선물을 이미 받았어요 ⭐', nextLevel: '다음 단계로' },
  en: { title: 'Math Playground', intro: `Answer ${GOAL} questions right to get a gift. Mistakes are fine, just try again!`, start: 'Start', locked: 'Clear the level before first', cleared: 'Cleared', levels: 'Levels', right: 'Correct! 🎉', again: 'Try again?', next: 'Next', gift: 'A gift for you!', wear: 'Try it on', later: 'Later', allFound: 'You already have every gift ⭐', nextLevel: 'Next level' },
}

/** 단계별 수학 놀이: 한 번에 맞힌 문제 GOAL 개를 채우면 선물 아이템을 준다 */
export function MathGame({ onClose, onWear }: { onClose: () => void; onWear: (id: string) => void }) {
  const { lang } = useI18n()
  const tx = T[lang]
  const [progress, setProgress] = useState<MathProgress>(readMath)
  const [level, setLevel] = useState<number | null>(null)
  const [q, setQ] = useState<Question | null>(null)
  const [picked, setPicked] = useState<number[]>([])
  const [right, setRight] = useState(false)
  const [gift, setGift] = useState<{ id: string | null } | null>(null)
  const lv = LEVELS.find((l) => l.id === level)
  const giftItem = gift?.id ? travelItem(gift.id) : undefined

  const ask = (id: number) => {
    setQ(LEVELS.find((l) => l.id === id)!.make(Math.random))
    setPicked([])
    setRight(false)
  }
  const open = (id: number) => {
    setLevel(id)
    setGift(null)
    ask(id)
  }
  const answer = (n: number) => {
    if (!q || !lv || right) return
    if (n !== q.answer) return setPicked((p) => [...p, n])
    playSnap()
    setRight(true)
    if (picked.length) return // 틀렸다가 맞힌 문제는 세지 않는다
    const { next, justCleared } = addCorrect(progress, lv.id)
    let saved = next
    if (justCleared) {
      const c = claimGift(next, lv.id)
      saved = c.next
      setGift({ id: c.gift })
    }
    setProgress(saved)
    writeMath(saved)
  }

  const btn = 'min-h-12 rounded-2xl px-4 py-2 text-sm font-bold'
  const count = lv ? countOf(progress, lv.id) : 0
  const cleared = lv ? isCleared(progress, lv.id) : false
  const hasNext = lv ? lv.id < LEVELS.length : false

  return (
    <Modal title={tx.title} onClose={onClose}>
      {!lv ? (
        <>
          <p className="text-sm leading-relaxed">{tx.intro}</p>
          <div className="mt-3 flex flex-col gap-3">
            {LEVELS.map((l) => {
              const open_ = isUnlocked(progress, l.id)
              return (
                <button key={l.id} disabled={!open_} onClick={() => open(l.id)} className={`${btn} flex items-center justify-between bg-petal text-left disabled:opacity-50`}>
                  <span>
                    {open_ ? l.icon : '🔒'} {l.id}. {l.title[lang]}
                    <span className="mt-1 block text-xs font-normal">{open_ ? l.hint[lang] : tx.locked}</span>
                  </span>
                  <span className="text-xs">{isCleared(progress, l.id) ? `⭐ ${tx.cleared}` : open_ ? `${countOf(progress, l.id)}/${GOAL}` : ''}</span>
                </button>
              )
            })}
          </div>
        </>
      ) : gift ? (
        <div className="py-2 text-center">
          <p className="text-lg font-extrabold text-blush-deep">🎁 {tx.gift}</p>
          {giftItem ? (
            <>
              <img src={assetUrl(giftItem.thumb)} alt="" className="mx-auto my-3 h-32 w-32 object-contain" />
              <p className="mb-3 font-bold">{giftItem.name[lang]}</p>
              <button className={`${btn} mb-2 w-full bg-blush text-white`} onClick={() => { onClose(); onWear(giftItem.id) }}>{tx.wear}</button>
            </>
          ) : (
            <p className="my-4 font-bold">{tx.allFound}</p>
          )}
          <div className="flex gap-2">
            <button className={`${btn} flex-1 bg-petal`} onClick={() => { setLevel(null); setGift(null) }}>{tx.levels}</button>
            {hasNext && <button className={`${btn} flex-1 bg-petal`} onClick={() => open(lv.id + 1)}>{tx.nextLevel}</button>}
          </div>
        </div>
      ) : q ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">{lv.icon} {lv.id}. {lv.title[lang]}</h2>
            <button className={`${btn} bg-petal`} onClick={() => setLevel(null)}>{tx.levels}</button>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-petal">
            <div className="h-full rounded-full bg-blush transition-all" style={{ width: `${(count / GOAL) * 100}%` }} />
          </div>
          <p className="mt-1 text-right text-xs font-bold">{count}/{GOAL}{cleared ? ' ⭐' : ''}</p>
          <p className="my-5 text-center text-4xl font-extrabold">{q.text}</p>
          <div className="grid grid-cols-2 gap-3">
            {q.choices.map((n) => (
              <button
                key={n}
                disabled={picked.includes(n) || (right && n !== q.answer)}
                onClick={() => answer(n)}
                className={`min-h-16 rounded-2xl text-2xl font-extrabold ${right && n === q.answer ? 'bg-mint text-white' : 'bg-petal'} disabled:opacity-40`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-4 min-h-6 text-center text-sm font-bold" aria-live="polite">
            {right ? tx.right : picked.length ? tx.again : ''}
          </p>
          {right && <button className={`${btn} mt-2 w-full bg-blush text-white`} onClick={() => ask(lv.id)}>{tx.next}</button>}
        </div>
      ) : null}
    </Modal>
  )
}
