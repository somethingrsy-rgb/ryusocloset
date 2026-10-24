import { useEffect, useRef, useState } from 'react'
import { CALL_ANIMALS, planCall, type CallPlan } from '../lib/animalCalls'
import { playBell, playTap, soundOn } from '../lib/sound'

const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

/** 아이폰은 사용자가 누른 순간에 한 번 말을 시켜야 그 뒤 음성이 나온다: 전화를 거는 순간 소리 없는 말을 한 번 한다 */
export function unlockSpeech() {
  if (!canSpeak()) return
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
  } catch { /* 음성을 못 써도 글로 통화한다 */ }
}

/** 동물 목소리로 한 줄 읽기. 다 읽거나(혹은 못 읽으면 글 길이만큼 기다린 뒤) 끝난다 */
function speakLine(text: string, pitch: number, rate: number, muted: boolean): { done: Promise<void>; cancel: () => void } {
  let timer = 0
  let finish = () => {}
  const done = new Promise<void>((res) => { finish = () => { clearTimeout(timer); res() } })
  // 음성이 끝났다는 소식이 안 오는 기기도 있어 글 길이만큼 지나면 넘어간다
  timer = window.setTimeout(finish, muted ? 700 + text.length * 45 : 1500 + text.length * 140)
  if (!muted && canSpeak()) {
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[~]/g, ''))
      u.lang = 'ko-KR'
      const ko = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('ko'))
      if (ko) u.voice = ko
      u.pitch = pitch
      u.rate = rate
      u.onend = finish
      u.onerror = finish
      window.speechSynthesis.speak(u)
    } catch { /* 글로만 보여 준다 */ }
  }
  return { done, cancel: finish }
}

interface Line { who: 'animal' | 'me'; text: string }

/** 카페 동물에게 전화 걸기: 따르릉 → 받으면 인사 → 이야기 3개(동물이 묻고 아이가 대답 버튼을 고른다) → 끝인사 → 끊기 */
export function AnimalCall({ animal, emoji, muted, onClose }: { animal: number; emoji: string; muted: boolean; onClose: () => void }) {
  const a = CALL_ANIMALS[animal]
  const [plan] = useState<CallPlan>(() => planCall(animal))
  const [phase, setPhase] = useState<'ring' | 'talk' | 'bye'>('ring')
  const [lines, setLines] = useState<Line[]>([])
  const [topic, setTopic] = useState(0)
  const [asking, setAsking] = useState(false) // 대답 버튼을 보여 주는 중
  const [secs, setSecs] = useState(0)
  const alive = useRef(true)
  const current = useRef<{ cancel: () => void } | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const quiet = muted || !soundOn()

  /** 동물이 여러 줄을 차례로 말한다 */
  const say = async (texts: string[]) => {
    for (const text of texts) {
      if (!alive.current) return
      setLines((l) => [...l, { who: 'animal', text }])
      const s = speakLine(text, a.pitch, a.rate, quiet)
      current.current = s
      await s.done
    }
  }

  useEffect(() => {
    alive.current = true
    const timers: number[] = []
    // 따르릉 두 번 울리고 받는다
    if (!quiet) { playBell(); timers.push(window.setTimeout(playBell, 1200)) }
    timers.push(window.setTimeout(() => {
      if (!alive.current) return
      setPhase('talk')
      void say([plan.hello, plan.topics[0].ask]).then(() => { if (alive.current) setAsking(true) })
    }, 2400))
    const tick = window.setInterval(() => setSecs((s) => s + 1), 1000)
    return () => {
      alive.current = false
      timers.forEach(clearTimeout)
      clearInterval(tick)
      current.current?.cancel()
      if (canSpeak()) window.speechSynthesis.cancel()
    }
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }) }, [lines])

  const answer = (i: number) => {
    if (!asking) return
    playTap()
    setAsking(false)
    if (canSpeak()) window.speechSynthesis.cancel()
    current.current?.cancel()
    const tp = plan.topics[topic]
    const r = tp.replies[i]
    setLines((l) => [...l, { who: 'me', text: r.label }])
    const next = topic + 1
    if (next < plan.topics.length) {
      setTopic(next)
      void say([r.answer, plan.topics[next].ask]).then(() => { if (alive.current) setAsking(true) })
    } else {
      void say([r.answer, plan.bye]).then(() => { if (alive.current) setPhase('bye') })
    }
  }

  const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
  return (
    <div role="dialog" aria-modal aria-label={`${a.name}에게 전화`} className="absolute inset-0 z-40 flex flex-col items-center bg-gradient-to-b from-[#fde6ec] via-[#fff6ef] to-[#e8f4dc] p-4">
      <div className="mt-2 flex flex-col items-center">
        <div className="relative">
          {phase === 'ring' && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[#f6a6b8]/60" />}
          <div className={`relative flex h-28 w-28 items-center justify-center rounded-full bg-white text-7xl shadow-lg ring-4 ring-[#f6c3cf] ${phase === 'ring' ? 'call-shake' : ''}`}>{emoji}</div>
        </div>
        <p className="mt-2 mb-0 text-xl font-black text-[#8a4b55]">{a.name}</p>
        <p className="m-0 text-sm text-black/50">{phase === 'ring' ? '따르릉… 전화 거는 중' : `📞 통화 중 ${time}`}</p>
        {quiet && phase !== 'ring' && <p className="m-0 text-xs text-black/40">🔇 소리가 꺼져 있어서 글로 이야기해요</p>}
      </div>

      <div ref={logRef} className="mt-3 flex min-h-0 w-full max-w-md flex-1 flex-col gap-2 overflow-y-auto px-1">
        {lines.map((l, k) => (
          <p key={k} className={`m-0 max-w-[85%] rounded-3xl px-4 py-2 text-base leading-snug shadow-sm ${l.who === 'animal' ? 'self-start rounded-bl-md bg-white' : 'self-end rounded-br-md bg-[#ff8fab] text-white'}`}>
            {l.who === 'animal' && <span aria-hidden className="mr-1">{emoji}</span>}{l.text}
          </p>
        ))}
      </div>

      <div className="mt-3 flex w-full max-w-md flex-col gap-2">
        {asking && plan.topics[topic].replies.map((r, i) => (
          <button key={i} onClick={() => answer(i)} className="min-h-12 rounded-full border-2 border-[#f6c3cf] bg-white px-4 text-base font-bold text-[#8a4b55] shadow-sm active:scale-95">{r.label}</button>
        ))}
        <button onClick={onClose} className="mt-1 min-h-12 rounded-full bg-[#e5484d] px-4 text-base font-bold text-white shadow active:scale-95">📞 {phase === 'bye' ? '전화 끊기' : '끊기'}</button>
      </div>
    </div>
  )
}
