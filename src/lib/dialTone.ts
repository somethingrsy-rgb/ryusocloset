import { soundOn } from './sound'

/** 전화 번호판 누르는 소리: 숫자마다 두 음이 섞인 진짜 전화기 소리(DTMF). 설정의 효과음 끄기를 따른다 */
const DTMF: Record<string, [number, number]> = { 1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477], 7: [852, 1209], 8: [852, 1336], 9: [852, 1477], 0: [941, 1336] }
let ctx: AudioContext | null = null

export function playDial(key: string) {
  if (!soundOn() || typeof window === 'undefined') return
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state !== 'running') void ctx.resume()
    const t = ctx.currentTime
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    g.connect(ctx.destination)
    for (const f of DTMF[key] ?? DTMF[0]) {
      const o = ctx.createOscillator()
      o.frequency.value = f
      o.connect(g)
      o.start(t)
      o.stop(t + 0.18)
    }
  } catch { /* 소리를 못 내도 번호는 눌린다 */ }
}
