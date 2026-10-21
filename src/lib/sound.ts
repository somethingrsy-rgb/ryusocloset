/** "찰칵" 효과음: 에셋 없이 WebAudio 로 합성 (노이즈 클릭 + 저음 톡) */
let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function click(c: AudioContext, at: number, freq: number, gain: number) {
  const len = Math.floor(c.sampleRate * 0.04)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  const src = c.createBufferSource()
  src.buffer = buf
  const hp = c.createBiquadFilter()
  hp.type = 'bandpass'
  hp.frequency.value = freq
  hp.Q.value = 0.8
  const g = c.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.05)
  src.connect(hp).connect(g).connect(c.destination)
  src.start(at)

  const osc = c.createOscillator()
  const og = c.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq / 3, at)
  osc.frequency.exponentialRampToValueAtTime(freq / 6, at + 0.05)
  og.gain.setValueAtTime(gain * 0.5, at)
  og.gain.exponentialRampToValueAtTime(0.001, at + 0.06)
  osc.connect(og).connect(c.destination)
  osc.start(at)
  osc.stop(at + 0.07)
}

export function playSnap() {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  click(c, t, 3200, 0.5)
  click(c, t + 0.07, 1800, 0.4)
}

/* ---------- 놀이 효과음 (모두 합성음, 설정의 효과음 켜기/끄기를 따른다) ---------- */
let enabled = true
export const setSoundEnabled = (on: boolean) => { enabled = on }

/** 톤 하나: 시작 주파수 → 끝 주파수로 미끄러지며 사라진다 */
function tone(c: AudioContext, at: number, f0: number, f1: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, at)
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(c.destination)
  o.start(at)
  o.stop(at + dur + 0.02)
}

const play = (fn: (c: AudioContext, t: number) => void) => {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  fn(c, c.currentTime)
}
const jitter = (n: number) => n * (0.97 + Math.random() * 0.06)

/** 점프: 말이 폴짝 떠오른다 */
export const playHop = () => play((c, t) => { tone(c, t, jitter(360), jitter(640), 0.14, 0.22); tone(c, t, jitter(720), jitter(1280), 0.1, 0.05, 'triangle') })
/** 점프: 뛰어넘은 말이 톡 사라진다 */
export const playPop = () => play((c, t) => { tone(c, t, jitter(820), jitter(260), 0.09, 0.22); click(c, t, 2600, 0.25) })
/** 점프: 말이 내려앉는다 */
export const playLand = () => play((c, t) => { tone(c, t, jitter(240), jitter(140), 0.1, 0.28, 'triangle'); click(c, t, 1400, 0.3) })
/** 세트를 완성했다 */
export const playSetDone = () => play((c, t) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.09, f, f * 1.01, 0.22, 0.2, 'triangle')) })
/** 이겼다 */
export const playWin = () => play((c, t) => { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.11, f, f * 1.01, 0.26, 0.22, 'triangle')) })
/** 졌다(부드럽게) */
export const playLose = () => play((c, t) => { [392, 330, 262].forEach((f, i) => tone(c, t + i * 0.16, f, f * 0.99, 0.3, 0.16, 'sine')) })
/** 별비: 별을 받았다 */
export const playStar = () => play((c, t) => { tone(c, t, jitter(1320), jitter(1760), 0.12, 0.2); tone(c, t + 0.06, jitter(1760), jitter(2200), 0.14, 0.12, 'triangle') })
/** 별비: 금빛 별(5점)을 받았다 */
export const playGold = () => play((c, t) => { [1047, 1319, 1568, 2093].forEach((f, i) => tone(c, t + i * 0.055, f, f * 1.01, 0.2, 0.18, 'triangle')) })
/** 별비: 구름에 부딪혔다 */
export const playCloud = () => play((c, t) => { tone(c, t, 180, 90, 0.22, 0.3, 'sawtooth') })
