import { useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { REACTIONS, SCENARIOS, heartsLeft, shuffled, starsFor, type Scenario } from '../lib/conversations'
import { finishMission, getGame } from '../lib/game'
import { canSpeak, speak, stopSpeaking } from '../lib/speech'
import { useEffect } from 'react'

const TEXT = {
  ko: { title: '영어 대화 미션', intro: '상대의 말을 듣고 알맞은 대답을 골라요. 틀리면 하트가 줄어요 (별 3개 = 한 번도 안 틀림).', daily: '일상', business: '직장', listen: '듣기', hide: '번역 숨기기', show: '번역 보기', pick: '알맞은 대답을 골라 보세요', again: '다시 골라 보세요', done: '미션 완료!', again2: '한 번 더', list: '목록으로', back: '← 목록', gift1: '처음 마쳐서 선물을 받았어요 🎁', gift2: '별 3개 첫 달성 보너스 선물! 🎁', close: '닫기' },
  en: { title: 'English missions', intro: 'Listen and choose the best reply. Wrong answers cost a heart (3 stars = no mistakes).', daily: 'Daily', business: 'Work', listen: 'Listen', hide: 'Hide translation', show: 'Show translation', pick: 'Pick the best reply', again: 'Try again', done: 'Mission complete!', again2: 'Play again', list: 'Back to list', back: '← List', gift1: 'First clear: you got a gift 🎁', gift2: 'First 3 stars: bonus gift! 🎁', close: 'Close' },
}

interface Props {
  /** 보상 아이템 개수만큼 호출된다 (첫 완료 1, 별 3개 첫 달성 1) */
  onReward: () => void
  onClose: () => void
}

interface Line {
  who: 'npc' | 'me'
  text: string
  ko?: string
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)

export function MissionGame({ onReward, onClose }: Props) {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [version, setVersion] = useState(0) // 같은 미션을 다시 할 때 처음부터
  useEffect(() => stopSpeaking, [])
  return (
    <div className="absolute inset-x-2 bottom-2 z-20 max-h-[92%] overflow-y-auto rounded-3xl bg-white/95 p-3 shadow-2xl ring-1 ring-black/10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-extrabold text-blush-deep">💼 {tx.title}</h2>
        <button className="h-9 w-9 rounded-full bg-petal text-sm" aria-label={tx.close} onClick={onClose}>
          ✕
        </button>
      </div>
      {scenario ? (
        <Play key={`${scenario.id}-${version}`} scenario={scenario} tx={tx} onReward={onReward} onList={() => setScenario(null)} onAgain={() => setVersion((v) => v + 1)} />
      ) : (
        <div className="mt-2 flex flex-col gap-1.5">
          <p className="text-xs">{tx.intro}</p>
          {SCENARIOS.map((s) => {
            const best = getGame().missions[s.id] ?? 0
            return (
              <button key={s.id} className="flex min-h-12 items-center justify-between gap-2 rounded-2xl bg-petal px-4 text-left text-sm font-bold" onClick={() => setScenario(s)}>
                <span>
                  {s.emoji} {s.title}
                  <span className="ml-1 text-[11px] font-normal">· {s.kind === 'daily' ? tx.daily : tx.business}</span>
                </span>
                <span className="shrink-0 text-amber-500" aria-label={`${best}/3`}>
                  {stars(best)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Play({ scenario, tx, onReward, onList, onAgain }: { scenario: Scenario; tx: (typeof TEXT)['ko']; onReward: () => void; onList: () => void; onAgain: () => void }) {
  const [turn, setTurn] = useState(0)
  const [log, setLog] = useState<Line[]>(() => [{ who: 'npc', text: scenario.turns[0].npc, ko: scenario.turns[0].ko }])
  const [tip, setTip] = useState<{ ok: boolean; text: string } | null>(null)
  const [react, setReact] = useState<string | null>(null)
  const [mistakes, setMistakes] = useState(0)
  const [showKo, setShowKo] = useState(true)
  const [result, setResult] = useState<{ stars: number; first: boolean; perfect: boolean } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const voice = canSpeak()
  const options = useMemo(() => shuffled(scenario.turns[Math.min(turn, scenario.turns.length - 1)].options), [scenario, turn])

  useEffect(() => {
    speak(scenario.turns[0].npc)
  }, [scenario])
  useEffect(() => endRef.current?.scrollIntoView?.({ block: 'nearest' }), [log, tip, result])

  const choose = (i: number) => {
    const opt = options[i]
    if (!opt.ok) {
      setMistakes((m) => m + 1)
      setTip({ ok: false, text: opt.tip })
      setReact(REACTIONS[Math.floor(Math.random() * REACTIONS.length)])
      return
    }
    setReact(null)
    const lines: Line[] = [...log, { who: 'me', text: opt.text }]
    setTip({ ok: true, text: opt.tip })
    const next = turn + 1
    if (next >= scenario.turns.length) {
      setLog(lines)
      const s = starsFor(mistakes)
      const r = finishMission(scenario.id, s)
      setResult({ stars: s, ...r })
      if (r.first) onReward()
      if (r.perfect) onReward()
      return
    }
    const n = scenario.turns[next]
    setLog([...lines, { who: 'npc', text: n.npc, ko: n.ko }])
    setTurn(next)
    window.setTimeout(() => speak(n.npc), 350)
  }

  const hearts = heartsLeft(mistakes)
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <b className="min-w-0 truncate">
          {scenario.emoji} {scenario.npcName} · {scenario.title}
        </b>
        <span aria-label={`hearts ${hearts}/3`} className="shrink-0 text-base text-red-500">
          {'♥'.repeat(hearts)}
          <span className="text-black/20">{'♥'.repeat(3 - hearts)}</span>
        </span>
      </div>
      <button className="min-h-9 self-end rounded-full bg-petal px-3 text-xs font-bold" onClick={() => setShowKo((v) => !v)}>
        {showKo ? tx.hide : tx.show}
      </button>
      <div className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-2xl bg-petal/40 p-2" aria-live="polite">
        {log.map((l, i) => (
          <div key={i} className={`max-w-[88%] rounded-2xl px-3 py-1.5 text-sm ${l.who === 'npc' ? 'self-start bg-white' : 'self-end bg-blush text-white'}`}>
            <span lang="en">{l.text}</span>
            {l.who === 'npc' && voice && (
              <button aria-label={tx.listen} className="ml-1 align-middle text-base" onClick={() => speak(l.text)}>
                🔊
              </button>
            )}
            {l.who === 'npc' && showKo && l.ko && <span className="block text-[11px] text-cocoa-soft">{l.ko}</span>}
          </div>
        ))}
        {react && (
          <div className="max-w-[88%] self-start rounded-2xl bg-white px-3 py-1.5 text-sm" lang="en">
            🤔 {react}
          </div>
        )}
        <div ref={endRef} />
      </div>
      {tip && <p className={`rounded-xl p-2 text-xs font-bold ${tip.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{tip.ok ? '✅ ' : '💡 '}{tip.text}</p>}
      {result ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-bold">
            🎉 {tx.done} <span className="text-amber-500">{stars(result.stars)}</span>
            {result.first && <span className="block text-xs text-blush-deep">{tx.gift1}</span>}
            {result.perfect && <span className="block text-xs text-blush-deep">{tx.gift2}</span>}
          </p>
          <div className="flex gap-2">
            <button className="min-h-11 flex-1 rounded-full bg-petal text-sm font-bold" onClick={onList}>
              {tx.list}
            </button>
            <button className="min-h-11 flex-1 rounded-full bg-blush text-sm font-bold text-white" onClick={onAgain}>
              {tx.again2}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-cocoa-soft">{tip && !tip.ok ? tx.again : tx.pick}</p>
          {options.map((o) => (
            <div key={o.text} className="flex gap-1.5">
              <button lang="en" className="min-h-11 flex-1 rounded-full bg-petal px-4 text-left text-sm font-bold" onClick={() => choose(options.indexOf(o))}>
                {o.text}
              </button>
              {voice && (
                <button aria-label={tx.listen} className="h-11 w-11 shrink-0 rounded-full bg-white text-lg ring-1 ring-black/10" onClick={() => speak(o.text)}>
                  🔈
                </button>
              )}
            </div>
          ))}
          <button className="min-h-9 self-start rounded-full bg-white px-3 text-xs font-bold ring-1 ring-black/10" onClick={onList}>
            {tx.back}
          </button>
        </>
      )}
    </div>
  )
}
