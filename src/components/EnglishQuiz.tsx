import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { ENGLISH_LESSONS } from '../lib/englishLessons'
import { englishDone } from '../lib/game'
import type { Npc } from '../lib/npcs'

const TEXT = {
  ko: { title: '영어로 대화하기', choose: '자연스러운 대답을 골라 주세요', meaning: '한국어 뜻', listen: '영어 듣기', right: '맞았어요!', wrong: '다시 골라 볼까요?', next: '다음 대화', finish: '학습 완료', back: '주민 대화로', complete: '대화 3개를 모두 연습했어요!', gift: '첫 완료 선물을 받았어요!', practice: '언제든 다시 복습할 수 있어요.', retry: '다시 연습하기' },
  en: { title: 'English conversation', choose: 'Choose a natural reply', meaning: 'Korean meaning', listen: 'Listen', right: 'Correct!', wrong: 'Try another reply', next: 'Next conversation', finish: 'Finish lesson', back: 'Back to resident', complete: 'You practiced all three conversations!', gift: 'You earned your first-completion gift!', practice: 'You can practice again anytime.', retry: 'Practice again' },
}

export function EnglishQuiz({ placeId, npc, onComplete, onBack }: {
  placeId: string
  npc: Npc
  onComplete: () => boolean
  onBack: () => void
}) {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  const questions = ENGLISH_LESSONS[placeId]
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [meaning, setMeaning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [earned, setEarned] = useState(false)
  const claimed = useRef(false)
  const question = questions[index]
  const correct = selected === question.answer
  const canListen = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  useEffect(() => () => { if (canListen) window.speechSynthesis.cancel() }, [canListen])
  const speak = (text: string) => {
    if (!canListen) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }
  const button = 'min-h-11 rounded-2xl px-3 py-2 text-sm font-bold'
  return (
    <section aria-label={tx.title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-extrabold text-blush-deep">💬 {tx.title}</h2>
        <span className="rounded-full bg-petal px-3 py-1 text-xs font-bold">
          {finished ? '✓ 3 / 3' : `${index + 1} / ${questions.length}`}
        </span>
      </div>
      {finished ? (
        <div className="rounded-2xl bg-cream p-4 text-center">
          <p className="m-0 text-3xl" aria-hidden>🌟</p>
          <p className="text-sm font-bold">{tx.complete}</p>
          <p className="text-xs">{earned ? tx.gift : tx.practice}</p>
          <button className={`${button} bg-petal`} onClick={() => {
            setIndex(0); setSelected(null); setMeaning(false); setFinished(false); setEarned(false)
          }}>{tx.retry}</button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-cream p-3">
            <p className="mt-0 mb-1 text-xs font-bold text-cocoa-soft">{npc.emoji} {npc.name[lang]}</p>
            <p lang="en" className="m-0 text-base font-extrabold leading-relaxed">{question.line}</p>
            {meaning && <p lang="ko" className="mt-1 mb-0 text-xs text-cocoa-soft">{question.meaning}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {canListen && <button className="min-h-11 rounded-full bg-white px-3 text-xs font-bold"
                aria-label={`${tx.listen}: ${question.line}`} onClick={() => speak(question.line)}>🔊 {tx.listen}</button>}
              <button className="min-h-11 rounded-full bg-white px-3 text-xs font-bold" aria-pressed={meaning}
                onClick={() => setMeaning(!meaning)}>🌐 {tx.meaning}</button>
            </div>
          </div>
          <p className="my-2 text-xs font-bold">{tx.choose}</p>
          <div className="flex flex-col gap-2">
            {question.choices.map((choice, i) => <button key={i} disabled={correct}
              className={`${button} text-left ${selected === i ? correct ? 'bg-green-100 ring-2 ring-green-400' : 'bg-rose-100 ring-2 ring-rose-300' : 'bg-petal'}`}
              onClick={() => setSelected(i)}>
              <span lang="en">{i + 1}. {choice.en}</span>
              {meaning && <span lang="ko" className="mt-1 block text-xs font-normal text-cocoa-soft">{choice.ko}</span>}
            </button>)}
          </div>
          {selected !== null && <div role="status" className="mt-3 rounded-2xl bg-cream p-3">
            <p className="m-0 text-sm font-bold">{correct ? '✓ ' + tx.right : tx.wrong}</p>
            <p className="mt-1 mb-0 text-xs leading-relaxed">{correct ? question.explanation[lang] : lang === 'ko' ? '주민이 한 말을 다시 읽고, 질문에 어울리는 답을 찾아보세요.' : 'Read the resident’s words again and look for a reply that fits.'}</p>
            {correct && canListen && <button className="mt-2 min-h-11 rounded-full bg-white px-3 text-xs font-bold"
              onClick={() => speak(question.choices[question.answer].en)}>🔊 {tx.listen}</button>}
          </div>}
          {correct && <button className={`${button} mt-3 w-full bg-blush text-white`} onClick={() => {
            window.speechSynthesis?.cancel()
            if (index + 1 < questions.length) {
              setIndex(index + 1); setSelected(null); setMeaning(false)
            } else {
              setFinished(true)
              if (!claimed.current) {
                claimed.current = true
                setEarned(onComplete())
              }
            }
          }}>{index + 1 < questions.length ? tx.next : tx.finish}</button>}
        </>
      )}
      <button className={`${button} mt-2 w-full bg-white text-cocoa-soft`} onClick={onBack}>{tx.back}</button>
      {!finished && englishDone(placeId) && <p className="mb-0 text-center text-xs text-cocoa-soft">✓ {tx.practice}</p>}
    </section>
  )
}
