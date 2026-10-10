import { useEffect, useRef, useState } from 'react'
interface RecognitionResult { isFinal: boolean; [index: number]: { transcript: string } }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: { results: ArrayLike<RecognitionResult> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void; abort(): void
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
export function useSpeechPractice(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<Recognition | null>(null)
  const callback = useRef(onResult)
  callback.current = onResult
  const Constructor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition
  const canListen = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
  const stop = () => {
    const current = ref.current
    ref.current = null
    if (current) { current.onresult = null; current.onerror = null; current.onend = null; current.abort() }
    setListening(false)
    if (canListen) window.speechSynthesis.cancel()
  }
  useEffect(() => () => {
    const current = ref.current
    ref.current = null
    if (current) { current.onresult = null; current.onerror = null; current.onend = null; current.abort() }
    window.speechSynthesis?.cancel()
  }, [])
  const speak = (text: string) => {
    stop()
    if (!canListen) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'; utterance.rate = .8
    window.speechSynthesis.speak(utterance)
  }
  const start = () => {
    stop(); setError('')
    if (!Constructor) return
    const recognition = new Constructor()
    recognition.lang = 'en-US'; recognition.continuous = false; recognition.interimResults = false
    ref.current = recognition
    recognition.onresult = e => {
      if (ref.current !== recognition) return
      const result = Array.from(e.results).filter(r => r.isFinal).map(r => r[0].transcript).join(' ')
      if (result) callback.current(result)
    }
    recognition.onerror = e => {
      if (ref.current !== recognition) return
      setError(e.error); setListening(false)
    }
    recognition.onend = () => { if (ref.current === recognition) { ref.current = null; setListening(false) } }
    try { recognition.start(); setListening(true) } catch { ref.current = null; setError('start-failed') }
  }
  return { supported: !!Constructor, canListen, listening, error, start, stop, speak }
}
