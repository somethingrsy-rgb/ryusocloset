import { useEffect, useRef, useState } from 'react'
import { CALL_ANIMALS, lineId, planCall, type CallPlan } from '../lib/animalCalls'
import { assetUrl } from '../lib/items'
import { playBell, playTap, playVoiceFile, soundOn } from '../lib/sound'

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

/** 미리 녹음한 대사 목록(public/cafe/voice/manifest.json: 동물 그림 이름 → 녹음된 대사 번호). 없으면 기기 음성으로 읽는다 */
let recorded: Promise<Record<string, string[]>> | null = null
const loadRecorded = (): Promise<Record<string, string[]>> => (recorded ??= fetch(assetUrl('cafe/voice/manifest.json')).then((r) => (r.ok ? r.json() : {})).catch(() => ({})))

const VOICE_KEY = 'ryuso.callVoice.v1'
const voiceScore = (v: SpeechSynthesisVoice) => (/premium|프리미엄/i.test(v.name) ? 4 : 0) + (/enhanced|향상|고품질/i.test(v.name) ? 3 : 0) + (/neural|natural|online|google/i.test(v.name) ? 2 : 0) + (/yuna|유나/i.test(v.name) ? 1 : 0)
/** 기기에 있는 한국어 목소리: 자연스러운 것(아이폰 프리미엄·고품질, 구글·신경망)부터 */
function koreanVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return []
  const seen = new Set<string>()
  return window.speechSynthesis.getVoices()
    .filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ko') && !seen.has(v.name) && seen.add(v.name))
    .sort((x, y) => voiceScore(y) - voiceScore(x) || x.name.localeCompare(y.name))
}
// 동물마다 기본 목소리를 정하면서 예전에 고른 목소리는 새로 시작한다
const SAVED_KEY = `${VOICE_KEY}.3`
const readSaved = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '{}') ?? {} } catch { return {} } }
/** 같은 목소리라도 높낮이·빠르기를 바꿔 다른 느낌으로(아이폰 웹 앱은 받은 목소리를 하나만 보여 주는 경우가 많다) */
const TONES = [
  { label: '', pitch: 1, rate: 1 },
  { label: '높게', pitch: 1.3, rate: 1.05 },
  { label: '낮게', pitch: 0.75, rate: 0.95 },
  { label: '빠르게', pitch: 1.05, rate: 1.2 },
  { label: '느리게', pitch: 0.95, rate: 0.82 },
]
interface VoiceChoice { voice?: SpeechSynthesisVoice; tone: number }
/** 고를 수 있는 목소리: 아이폰 설정 목소리(설정 → 손쉬운 사용 → 읽기 및 말하기에서 고른 것) 먼저, 그다음 앱이 볼 수 있는 한국어 목소리들 × 높낮이 느낌 */
const choices = (): VoiceChoice[] => {
  const voices: (SpeechSynthesisVoice | undefined)[] = [undefined, ...koreanVoices()]
  return voices.flatMap((voice) => TONES.map((_, tone) => ({ voice, tone })))
}
const keyOf = (c: VoiceChoice) => `${c.voice?.name ?? ''}|${c.tone}`
export const voiceLabel = (c: VoiceChoice) => [c.voice?.name ?? '기기 설정 목소리', TONES[c.tone].label].filter(Boolean).join(' · ')
/** 동물마다 정한 목소리(카페 자리 순서: 곰·토끼·고양이·강아지·병아리·오리·다람쥐·판다). 곰·강아지·판다는 민수, 토끼는 지안, 나머지는 기기 설정 목소리 */
const ANIMAL_VOICE: (RegExp | null)[] = [/minsu|민수/i, /jian|지안/i, null, /minsu|민수/i, null, null, null, /minsu|민수/i]
/** 동물마다 목소리: 고른 게 있으면 그것, 없으면 동물마다 정한 목소리. 앱이 그 목소리를 볼 수 없으면 기기 설정 목소리를 쓴다 */
function voiceFor(animal: number): VoiceChoice {
  const saved = readSaved()[animal]
  const picked = choices().find((c) => keyOf(c) === saved)
  if (picked) return picked
  const want = ANIMAL_VOICE[animal]
  return { voice: want ? koreanVoices().find((v) => want.test(v.name)) : undefined, tone: 0 }
}
/** 이 동물의 목소리를 다음 것으로 바꿔 저장하고 새 목소리를 돌려준다 */
function nextVoice(animal: number): VoiceChoice {
  const list = choices()
  const now = keyOf(voiceFor(animal))
  const next = list[(list.findIndex((c) => keyOf(c) === now) + 1) % list.length]
  try { localStorage.setItem(SAVED_KEY, JSON.stringify({ ...readSaved(), [animal]: keyOf(next) })) } catch { /* 저장 못 해도 이번 통화에는 쓴다 */ }
  return next
}

/** 동물 목소리로 한 줄 읽기. 다 읽거나(혹은 못 읽으면 글 길이만큼 기다린 뒤) 끝난다 */
function speakLine(text: string, pitch: number, rate: number, muted: boolean, voice?: SpeechSynthesisVoice): { done: Promise<void>; cancel: () => void } {
  let timer = 0
  let finish = () => {}
  const done = new Promise<void>((res) => { finish = () => { clearTimeout(timer); res() } })
  // 음성이 끝났다는 소식이 안 오는 기기도 있어 글 길이만큼 지나면 넘어간다
  timer = window.setTimeout(finish, muted ? 700 + text.length * 45 : 1500 + text.length * 140)
  if (!muted && canSpeak()) {
    try {
      const u = new SpeechSynthesisUtterance(text.replace(/[~]/g, ''))
      u.lang = 'ko-KR'
      if (voice) u.voice = voice
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
export function AnimalCall({ animal, kid, muted, onClose }: { animal: number; kid?: string; muted: boolean; onClose: () => void }) {
  const a = CALL_ANIMALS[animal]
  const [plan] = useState<CallPlan>(() => planCall(animal, Math.random, kid))
  const [phase, setPhase] = useState<'ring' | 'talk' | 'bye'>('ring')
  const [lines, setLines] = useState<Line[]>([])
  const [topic, setTopic] = useState(0)
  const [asking, setAsking] = useState(false) // 대답 버튼을 보여 주는 중
  const [secs, setSecs] = useState(0)
  const alive = useRef(true)
  const current = useRef<{ cancel: () => void } | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const quiet = muted || !soundOn()
  const face = assetUrl(`cafe/call/${a.img}.webp`)
  const [voiceName, setVoiceName] = useState(() => voiceLabel(voiceFor(animal)))
  const [voiceCount, setVoiceCount] = useState(() => koreanVoices().length)
  // 목소리 목록은 늦게 오는 기기가 있다
  useEffect(() => {
    if (!canSpeak()) return
    const on = () => { setVoiceName(voiceLabel(voiceFor(animal))); setVoiceCount(koreanVoices().length) }
    window.speechSynthesis.addEventListener('voiceschanged', on)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', on)
  }, [animal])
  const changeVoice = () => {
    const v = nextVoice(animal)
    setVoiceName(voiceLabel(v))
    window.speechSynthesis.cancel()
    speakLine(`안녕! 나 ${a.me}!`, a.pitch * TONES[v.tone].pitch, a.rate * TONES[v.tone].rate, false, v.voice)
  }

  /** 동물이 여러 줄을 차례로 말한다 */
  const say = async (texts: string[]) => {
    for (const text of texts) {
      if (!alive.current) return
      setLines((l) => [...l, { who: 'animal', text }])
      // 녹음 파일이 있으면 그걸 틀고, 없거나 못 틀면 기기 음성으로 읽는다
      const id = lineId(animal, text)
      if (!quiet && (await loadRecorded())[a.img]?.includes(id)) {
        const f = playVoiceFile(`cafe/voice/${a.img}/${id}.mp3`)
        current.current = { cancel: f.stop }
        if (await f.done) continue
        if (!alive.current) return
      }
      const v = voiceFor(animal)
      const s = speakLine(text, a.pitch * TONES[v.tone].pitch, a.rate * TONES[v.tone].rate, quiet, v.voice)
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
          <div className={`relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg ring-4 ring-[#f6c3cf] ${phase === 'ring' ? 'call-shake' : ''}`}><img src={face} alt="" draggable={false} className="h-[88%] w-[88%] object-contain" /></div>
        </div>
        <p className="mt-2 mb-0 text-xl font-black text-[#8a4b55]">{a.name}</p>
        <p className="m-0 text-sm text-black/50">{phase === 'ring' ? '따르릉… 전화 거는 중' : `📞 통화 중 ${time}`}</p>
        {quiet && phase !== 'ring' && <p className="m-0 text-xs text-black/40">🔇 소리가 꺼져 있어서 글로 이야기해요</p>}
        {!quiet && canSpeak() && <button onClick={changeVoice} className="mt-1 min-h-9 rounded-full bg-white/80 px-3 text-xs font-bold text-[#8a4b55] shadow-sm active:scale-95">🔈 목소리 바꾸기 · {voiceName}</button>}
        {!quiet && canSpeak() && <p className="m-0 mt-0.5 text-[10px] text-black/35">이 기기에서 쓸 수 있는 한국어 목소리 {voiceCount}개</p>}
      </div>

      <div ref={logRef} className="mt-3 flex min-h-0 w-full max-w-md flex-1 flex-col gap-2 overflow-y-auto px-1">
        {lines.map((l, k) => (
          <p key={k} className={`m-0 max-w-[85%] rounded-3xl px-4 py-2 text-base leading-snug shadow-sm ${l.who === 'animal' ? 'self-start rounded-bl-md bg-white' : 'self-end rounded-br-md bg-[#ff8fab] text-white'}`}>
            {l.who === 'animal' && <img src={face} alt="" aria-hidden draggable={false} className="mr-1 inline-block h-6 w-6 align-[-0.35em] object-contain" />}{l.text}
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
