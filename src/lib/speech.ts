/** 브라우저 음성 합성(TTS)으로 영어 문장을 읽어 준다. 지원하지 않으면 조용히 아무것도 하지 않는다. */
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

export function speak(text: string, rate = 0.9) {
  if (!canSpeak()) return
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = rate
    const voice = synth.getVoices().find((v) => v.lang.startsWith('en'))
    if (voice) u.voice = voice
    synth.speak(u)
  } catch {
    /* 소리를 못 내도 게임은 계속된다 */
  }
}

export const stopSpeaking = () => {
  try {
    if (canSpeak()) window.speechSynthesis.cancel()
  } catch {
    /* 무시 */
  }
}
