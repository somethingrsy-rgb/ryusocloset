import { useState } from 'react'
import { useI18n } from '../i18n'
import { eventDone } from '../lib/game'
import { RPS_ICON, rpsResult, type Npc, type Rps } from '../lib/npcs'

const TEXT = {
  ko: { hint: '💡 힌트 듣기', close: '닫기', right: '정답! 🎉', wrong: '아쉬워, 다시 생각해 봐!', win: '내가 졌네! 🎉', lose: '내가 이겼다~ 다시 해볼래?', draw: '비겼어! 한 번 더!', done: '선물은 이미 줬잖아~ 또 놀러 와!', hinted: '반짝이는 곳 근처에 💡 표시를 해 뒀어!', nohint: '이 곳은 이미 다 찾았어!', chest: '선물 상자를 찾아서 눌러 봐!', chestDone: '선물은 마음에 들었니?' },
  en: { hint: '💡 Hear a hint', close: 'Close', right: 'Correct! 🎉', wrong: 'Not quite, try again!', win: 'You win! 🎉', lose: 'I win~ try again?', draw: 'A draw! Once more!', done: 'I already gave you a gift~ come again!', hinted: 'I marked a spot with 💡!', nohint: 'You found everything here!', chest: 'Find the gift box and tap it!', chestDone: 'Did you like the gift?' },
}

interface Props {
  npc: Npc
  placeId: string
  /** 보상을 준다 (이벤트 성공) */
  onReward: () => void
  /** 힌트: 표시한 게 있으면 true */
  onHint: () => boolean
  onClose: () => void
}

export function NpcDialog({ npc, onReward, onHint, onClose, placeId }: Props) {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  const [line, setLine] = useState(() => npc.lines[Math.floor(Math.random() * npc.lines.length)][lang])
  const [mode, setMode] = useState<'talk' | 'quiz' | 'rps'>('talk')
  const done = eventDone(placeId)

  const startEvent = () => {
    if (done) return setLine(tx.done)
    setLine(npc.pitch[lang])
    if (npc.event === 'gift') return setLine(tx.chest)
    setMode(npc.event)
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
    <div className="absolute inset-x-2 bottom-2 z-20 rounded-3xl bg-white/95 p-3 shadow-2xl ring-1 ring-black/10">
      <div className="flex items-start gap-3">
        <span className="text-4xl" aria-hidden>{npc.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-blush-deep">{npc.name[lang]}</p>
          <p className="text-sm font-bold">{line}</p>
        </div>
        <button className="h-9 w-9 shrink-0 rounded-full bg-petal text-sm" aria-label={tx.close} onClick={onClose}>✕</button>
      </div>

      {mode === 'quiz' && npc.quiz && (
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-sm font-bold">❓ {npc.quiz.q[lang]}</p>
          {npc.quiz.choices.map((c, i) => (
            <button
              key={i}
              className={`${btn} bg-petal text-left`}
              onClick={() => {
                if (i === npc.quiz!.answer) {
                  setLine(tx.right)
                  setMode('talk')
                  onReward()
                } else setLine(tx.wrong)
              }}
            >
              {i + 1}. {c[lang]}
            </button>
          ))}
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
          <button
            className={`${btn} bg-petal`}
            onClick={() => setLine(onHint() ? tx.hinted : tx.nohint)}
          >
            {tx.hint}
          </button>
          <button className={`${btn} bg-blush text-white`} onClick={startEvent}>
            {npc.event === 'quiz' ? '❓' : npc.event === 'rps' ? '✊' : '🎁'} {done ? tx.chestDone : npc.pitch[lang]}
          </button>
        </div>
      )}
    </div>
  )
}
