import { useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { PLACES } from '../lib/game'
import { addCustomQuestions, customQuestions, parseQuestions, questionsVersion, removeCustomQuestion, subscribeQuestions } from '../lib/questions'
import { Modal } from './Modal'

const EXAMPLE = `단어 | He is ___ at math. | good / well / nice | 1 | be good at ~: ~을 잘하다
문법 | She ___ here since 2020. | lives / has lived / lived | 2 | since → 현재완료 | 봄소풍`

const TEXT = {
  ko: {
    title: '내 영어 문제',
    help: '한 줄에 한 문제를 이렇게 적어요. 정답번호는 1부터, 장소는 비워 두면 어디서나 나와요.',
    format: '유형(단어/문법) | 문제 | 보기1 / 보기2 / 보기3 | 정답번호 | 해설 | 장소(선택)',
    places: '장소: ',
    add: '문제 추가',
    added: '개 추가했어요',
    mine: '내가 추가한 문제',
    none: '아직 없어요',
    del: '삭제',
  },
  en: {
    title: 'My English questions',
    help: 'One question per line. The answer number starts at 1. Leave the place empty to use it anywhere.',
    format: 'type(vocab/grammar) | question | choice1 / choice2 / choice3 | answer# | explanation | place(optional)',
    places: 'Places: ',
    add: 'Add questions',
    added: ' added',
    mine: 'My questions',
    none: 'None yet',
    del: 'Delete',
  },
}

export function QuestionEditor({ onClose }: { onClose: () => void }) {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  useSyncExternalStore(subscribeQuestions, questionsVersion)
  const [text, setText] = useState('')
  const [msg, setMsg] = useState<string[]>([])
  const mine = customQuestions()

  const submit = () => {
    const { ok, errors } = parseQuestions(text, PLACES)
    if (ok.length) addCustomQuestions(ok)
    setMsg([ok.length ? `✅ ${ok.length}${tx.added}` : '', ...errors].filter(Boolean))
    if (!errors.length) setText('')
  }

  return (
    <Modal title={tx.title} onClose={onClose}>
      <p className="text-sm">{tx.help}</p>
      <p className="mt-1 rounded-xl bg-petal p-2 text-xs font-bold">{tx.format}</p>
      <p className="mt-1 text-[11px] text-cocoa-soft">
        {tx.places}
        {PLACES.map((p) => p.ko).join(', ')}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={EXAMPLE}
        rows={6}
        className="mt-2 w-full rounded-2xl border border-black/10 p-3 text-sm"
      />
      <button className="mt-2 h-11 w-full rounded-full bg-blush font-bold text-white disabled:opacity-40" disabled={!text.trim()} onClick={submit}>
        {tx.add}
      </button>
      {msg.map((m, i) => (
        <p key={i} className="mt-1 text-xs font-bold text-blush-deep">{m}</p>
      ))}
      <h3 className="mt-4 text-sm font-extrabold">
        {tx.mine} ({mine.length})
      </h3>
      {mine.length === 0 && <p className="text-xs text-cocoa-soft">{tx.none}</p>}
      <ul className="mt-1 flex flex-col gap-1.5">
        {mine.map((q) => (
          <li key={q.id} className="flex items-start gap-2 rounded-xl bg-petal/60 p-2 text-xs">
            <span className="min-w-0 flex-1">
              <b>{q.q}</b>
              <br />
              {q.choices.map((c, i) => (i === q.answer ? `✅${c}` : c)).join(' / ')}
            </span>
            <button className="shrink-0 rounded-full bg-white px-3 py-1 font-bold" onClick={() => removeCustomQuestion(q.id)}>
              {tx.del}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
