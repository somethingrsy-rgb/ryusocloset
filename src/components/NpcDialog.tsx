import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { SOLVED_PER_BONUS, addSolved, eventDone, getGame } from '../lib/game'
import { RPS_ICON, rpsResult, type Npc, type Rps } from '../lib/npcs'
import { pickQuestion, type Question } from '../lib/questions'

const TEXT = {
  ko: { hint: '💡 힌트 듣기', close: '닫기', practice: '📚 영어 문제 풀기', right: '정답! 🎉', wrong: '아쉬워, 다시 생각해 봐!', win: '내가 졌네! 🎉', lose: '내가 이겼다~ 다시 해볼래?', draw: '비겼어! 한 번 더!', done: '선물은 이미 줬잖아~ 또 놀러 와!', hinted: '반짝이는 곳 근처에 💡 표시를 해 뒀어!', nohint: '이 곳은 이미 다 찾았어!', chest: '선물 상자를 찾아서 눌러 봐!', chestDone: '선물은 마음에 들었니?', next: '다음 문제', bonus: '정답을 {n}개 맞혀서 보너스 선물을 줄게! 🎁', toBonus: '{n}개 더 맞히면 보너스 선물!', vocab: '단어', grammar: '문법', noQ: '낼 문제가 없어요' },
  en: { hint: '💡 Hear a hint', close: 'Close', practice: '📚 English question', right: 'Correct! 🎉', wrong: 'Not quite, try again!', win: 'You win! 🎉', lose: 'I win~ try again?', draw: 'A draw! Once more!', done: 'I already gave you a gift~ come again!', hinted: 'I marked a spot with 💡!', nohint: 'You found everything here!', chest: 'Find the gift box and tap it!', chestDone: 'Did you like the gift?', next: 'Next question', bonus: 'That is {n} correct answers! Here is a bonus gift! 🎁', toBonus: '{n} more for a bonus gift!', vocab: 'Vocab', grammar: 'Grammar', noQ: 'No questions available' },
}

interface Props {
  npc: Npc
  placeId: string
  /** 이벤트 성공 보상 (이 장소의 아이템) */
  onReward: () => void
  /** 영어 문제를 5개 맞힐 때마다 주는 보너스 (아무 장소의 아이템) */
  onBonus: () => void
  /** 힌트: 표시한 게 있으면 true */
  onHint: () => boolean
  onClose: () => void
}

export function NpcDialog({ npc, onReward, onBonus, onHint, onClose, placeId }: Props) {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  const [line, setLine] = useState(() => npc.lines[Math.floor(Math.random() * npc.lines.length)][lang])
  const [mode, setMode] = useState<'talk' | 'quiz' | 'rps'>('talk')
  const [question, setQuestion] = useState<Question | null>(null)
  /** 지금 문제가 이벤트(이 장소 보상)인지 연습인지 */
  const forEvent = useRef(false)
  const recent = useRef<string[]>([])
  const [answered, setAnswered] = useState(false)
  const done = eventDone(placeId)

  const ask = (event: boolean) => {
    const q = pickQuestion(placeId, recent.current)
    if (!q) return setLine(tx.noQ)
    recent.current = [...recent.current.slice(-30), q.id]
    forEvent.current = event
    setQuestion(q)
    setAnswered(false)
    setMode('quiz')
    setLine(event ? npc.pitch[lang] : tx.practice.replace('📚 ', ''))
  }

  const startEvent = () => {
    if (done) return setLine(tx.done)
    if (npc.event === 'gift') return setLine(tx.chest)
    if (npc.event === 'quiz') return ask(true)
    setLine(npc.pitch[lang])
    setMode('rps')
  }

  const choose = (i: number) => {
    if (!question || answered) return
    if (i !== question.answer) return setLine(tx.wrong)
    setAnswered(true)
    const why = question.explain ? ` ${question.explain}` : ''
    if (forEvent.current && !done) {
      setLine(`${tx.right}${why}`)
      onReward()
    } else {
      const bonus = addSolved()
      setLine(bonus ? `${tx.right}${why}\n${tx.bonus.replace('{n}', String(getGame().solved))}` : `${tx.right}${why}\n${tx.toBonus.replace('{n}', String(SOLVED_PER_BONUS - (getGame().solved % SOLVED_PER_BONUS)))}`)
      if (bonus) onBonus()
    }
  }

  const play = (me: Rps) => {
    const all: Rps[] = ['rock', 'paper', 'scissors']
    const r = rpsResult(me, all[Math.floor(Math.random() * 3)])
    setLine(tx[r])
    if (r === 'win') {
      setMode('talk')
      onReward()
    }
  }

  const btn = 'min-h-11 rounded-full px-4 text-sm font-bold'
  return (
    <div className="absolute inset-x-2 bottom-2 z-20 max-h-[75%] overflow-y-auto rounded-3xl bg-white/95 p-3 shadow-2xl ring-1 ring-black/10">
      <div className="flex items-start gap-3">
        <span className="text-4xl" aria-hidden>{npc.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-blush-deep">{npc.name[lang]}</p>
          <p className="text-sm font-bold whitespace-pre-line">{line}</p>
        </div>
        <button className="h-9 w-9 shrink-0 rounded-full bg-petal text-sm" aria-label={tx.close} onClick={onClose}>✕</button>
      </div>

      {mode === 'quiz' && question && (
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-sm font-bold">
            <span className="mr-1 rounded-full bg-petal px-2 py-0.5 text-[11px]">{question.type === 'vocab' ? tx.vocab : tx.grammar}</span>
            {question.q}
          </p>
          {question.choices.map((c, i) => (
            <button
              key={i}
              disabled={answered && i !== question.answer}
              className={`${btn} text-left ${answered && i === question.answer ? 'bg-emerald-100' : 'bg-petal'}`}
              onClick={() => choose(i)}
            >
              {i + 1}. {c}
            </button>
          ))}
          {answered && (
            <button
              className={`${btn} bg-blush text-white`}
              onClick={() => {
                if (forEvent.current) {
                  forEvent.current = false
                  setMode('talk')
                } else ask(false)
              }}
            >
              {forEvent.current ? tx.close : tx.next}
            </button>
          )}
        </div>
      )}
      {mode === 'rps' && (
        <div className="mt-2 flex justify-center gap-3">
          {(['rock', 'paper', 'scissors'] as Rps[]).map((r) => (
            <button key={r} className={`${btn} bg-petal text-2xl`} aria-label={r} onClick={() => play(r)}>
              {RPS_ICON[r]}
            </button>
          ))}
        </div>
      )}
      {mode === 'talk' && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={`${btn} bg-petal`} onClick={() => setLine(onHint() ? tx.hinted : tx.nohint)}>
            {tx.hint}
          </button>
          <button className={`${btn} bg-petal`} onClick={() => ask(false)}>
            {tx.practice}
          </button>
          <button className={`${btn} bg-blush text-white`} onClick={startEvent}>
            {npc.event === 'quiz' ? '❓' : npc.event === 'rps' ? '✊' : '🎁'} {done ? tx.chestDone : npc.pitch[lang]}
          </button>
        </div>
      )}
    </div>
  )
}
