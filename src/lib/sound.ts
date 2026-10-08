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
  const c = getCtx()
  if (!c) return
  const t = c.currentTime
  click(c, t, 3200, 0.5)
  click(c, t + 0.07, 1800, 0.4)
}
