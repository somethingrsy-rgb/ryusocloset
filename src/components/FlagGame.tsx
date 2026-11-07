import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { FLAG_ROUNDS, makeFlagQuiz } from '../lib/flagGame'
import { playOrder, playTap } from '../lib/sound'

// SVG를 코드와 함께 묶어서 외부 통신이나 기기별 국기 이모지 지원 없이 표시한다.
const artwork = import.meta.glob('../assets/flags/*.svg', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
const imageFor = (code: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(artwork[`../assets/flags/${code}.svg`])}`

export function FlagGame({ onExit }: { onExit: () => void }) {
  const { lang } = useI18n()
  const ko = lang === 'ko'
  const [questions, setQuestions] = useState(makeFlagQuiz)
  const [round, setRound] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const locked = useRef(false)
  const nextButton = useRef<HTMLButtonElement>(null)
  const questionTitle = useRef<HTMLHeadingElement>(null)
  const q = questions[round]
  const correct = selected === q.country.code
  const choose = (code: string) => {
    if (locked.current) return
    locked.current = true
    setSelected(code)
    if (code === q.country.code) { setScore(s => s + 1); playOrder() } else playTap()
    requestAnimationFrame(() => nextButton.current?.focus())
  }
  const next = () => {
    playTap()
    if (round + 1 === FLAG_ROUNDS) setDone(true)
    else { setRound(r => r + 1); setSelected(null); locked.current = false }
    requestAnimationFrame(() => questionTitle.current?.focus())
  }
  const again = () => {
    playTap(); setQuestions(makeFlagQuiz()); setRound(0); setSelected(null); setScore(0); setDone(false); locked.current = false
    requestAnimationFrame(() => questionTitle.current?.focus())
  }
  return <section aria-label={ko ? '국기 게임' : 'Flag quiz'} className="flex h-full flex-col overflow-y-auto rounded-3xl bg-[#fff7ee] p-3 text-cocoa sm:p-5">
    <header className="mx-auto flex w-full max-w-2xl shrink-0 items-center justify-between gap-3">
      <h1 className="m-0 text-lg font-black sm:text-2xl">🌏 {ko ? '국기 게임' : 'Flag quiz'}</h1>
      <button onClick={() => { playTap(); onExit() }} className="min-h-11 rounded-full bg-white px-4 text-sm font-bold shadow-sm">{ko ? '← 돌아가기' : '← Back'}</button>
    </header>
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-4">
      {done ? <div className="rounded-3xl bg-white p-6 text-center shadow-sm">
        <p aria-hidden className="m-0 text-5xl">{score === FLAG_ROUNDS ? '🏆' : '🌟'}</p>
        <h2 ref={questionTitle} tabIndex={-1} className="text-2xl font-black outline-none">{ko ? '국기 여행 완료!' : 'Flag trip complete!'}</h2>
        <p role="status" className="text-xl font-bold">{ko ? `${FLAG_ROUNDS}문제 중 ${score}문제 정답!` : `${score} out of ${FLAG_ROUNDS} correct!`}</p>
        <p className="text-sm text-cocoa-soft">{ko ? '다시 여행하며 다른 나라 국기도 만나봐요.' : 'Play again to discover more flags.'}</p>
        <button onClick={again} className="mt-3 min-h-12 w-full rounded-2xl bg-blush px-5 font-bold text-white">{ko ? '한 번 더 하기' : 'Play again'}</button>
      </div> : <>
        <div className="mb-3 flex items-center justify-between text-sm font-bold text-cocoa-soft"><span>{ko ? `문제 ${round + 1} / ${FLAG_ROUNDS}` : `Question ${round + 1} / ${FLAG_ROUNDS}`}</span><span>{ko ? `정답 ${score}개` : `${score} correct`}</span></div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-label={ko ? '완료한 문제' : 'Questions completed'} aria-valuemin={0} aria-valuemax={FLAG_ROUNDS} aria-valuenow={round + (selected ? 1 : 0)}><div className="h-full rounded-full bg-blush transition-all" style={{ width: `${((round + (selected ? 1 : 0)) / FLAG_ROUNDS) * 100}%` }} /></div>
        <h2 ref={questionTitle} tabIndex={-1} className="mt-0 mb-3 text-center text-xl font-black outline-none">{ko ? '어느 나라의 국기일까요?' : 'Which country has this flag?'}</h2>
        <div className="mb-4 flex items-center justify-center rounded-3xl bg-white p-5 shadow-sm">
          <img src={imageFor(q.country.code)} alt={selected ? (ko ? `${q.country.ko} 국기` : `Flag of ${q.country.en}`) : (ko ? '문제의 국기' : 'Mystery flag')} draggable={false} className="aspect-[3/2] w-full max-w-[270px] rounded-lg object-contain ring-1 ring-black/10" />
        </div>
        <div role="group" aria-label={ko ? '나라 이름 보기 4개' : 'Four country choices'} className="grid grid-cols-2 gap-3">
          {q.choices.map((c, i) => {
            const right = !!selected && c.code === q.country.code
            const wrong = selected === c.code && !correct
            return <button key={c.code} disabled={selected !== null} onClick={() => choose(c.code)} className={`flex min-h-16 items-center gap-2 rounded-2xl border-2 px-3 py-3 text-left text-sm font-bold transition sm:text-base ${right ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : wrong ? 'border-rose-400 bg-rose-50 text-rose-800' : 'border-transparent bg-white shadow-sm enabled:hover:border-[#ffc0d0] enabled:active:scale-95'}`}>
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5 text-xs">{right ? '✓' : wrong ? '✕' : i + 1}</span><span>{c[lang]}</span>
            </button>
          })}
        </div>
        <div className="mt-4 min-h-24">
          {selected ? <>
            <p role="status" className={`mt-0 mb-3 text-center text-sm font-bold ${correct ? 'text-emerald-700' : 'text-cocoa'}`}>{correct ? (ko ? `정답이에요! ${q.country.ko}의 국기예요.` : `Correct! This is the flag of ${q.country.en}.`) : (ko ? `괜찮아요! 정답은 ${q.country.ko}예요.` : `Good try! The answer is ${q.country.en}.`)}</p>
            <button ref={nextButton} onClick={next} className="min-h-12 w-full rounded-2xl bg-blush px-4 font-bold text-white">{round + 1 === FLAG_ROUNDS ? (ko ? '결과 보기' : 'See results') : (ko ? '다음 국기 →' : 'Next flag →')}</button>
          </> : <p className="text-center text-sm text-cocoa-soft">{ko ? '보기 4개 중 하나를 골라요. 시간제한은 없어요.' : 'Choose one of four answers. Take your time.'}</p>}
        </div>
      </>}
    </div>
  </section>
}
