/**
 * 말로 채팅하기: 브라우저 음성 인식(Web Speech API, 크롬·사파리)으로 한국어 말을 글로 바꾼다.
 * 지원하지 않는 브라우저면 speechSupported 가 false(마이크 단추를 숨긴다). 소리는 브라우저가 처리하고 앱은 글만 받는다.
 */
type Rec = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }
import { setMicQuiet } from '../sound'

const Ctor = typeof window !== 'undefined' ? ((window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition) : undefined
export const speechSupported = !!Ctor

/** 듣기 시작. 말하는 동안 onText(지금까지 들은 글), 끝나면 onDone(최종 글, 없으면 빈 글). 멈추는 함수를 돌려준다 */
export function listen(onText: (t: string) => void, onDone: (t: string, error?: string) => void): () => void {
  if (!Ctor) { onDone('', 'unsupported'); return () => {} }
  // 듣는 동안 앱 소리(노래·효과음)를 끈다: 조용한 곳에서도 말로 채팅하게
  setMicQuiet(true)
  const done = onDone
  onDone = (t, e) => { setMicQuiet(false); done(t, e) }
  const r = new Ctor()
  r.lang = 'ko-KR'
  r.interimResults = true
  r.continuous = false
  r.maxAlternatives = 1
  let text = '', err: string | undefined
  r.onresult = (e) => {
    let s = ''
    for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript
    text = s.trim()
    onText(text)
  }
  r.onerror = (e) => { err = e.error }
  r.onend = () => onDone(text, err)
  try { r.start() } catch { onDone('', 'start') }
  return () => { try { r.stop() } catch { /* 이미 끝남 */ } }
}
