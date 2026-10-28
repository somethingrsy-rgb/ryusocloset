import { assetUrl } from './items'

/** "찰칵" 효과음: 에셋 없이 WebAudio 로 합성 (노이즈 클릭 + 저음 톡) */
let ctx: AudioContext | null = null
const hiddenNow = () => typeof document !== 'undefined' && document.hidden

function getCtx(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!ctx) {
      // iOS: 무음 스위치가 켜져 있어도 소리가 나게 한다 (iOS 17+)
      try {
        const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession
        if (s) s.type = 'playback'
      } catch { /* 지원하지 않으면 무시 */ }
      ctx = new AC()
    }
    // 앱이 가려진 동안에는 다시 켜지 않는다(가려진 채 효과음·타이머가 소리를 깨우면 배경 음악이 뒤에서 계속 나온다)
    if (ctx.state !== 'running' && !hiddenNow()) void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** 효과음(배경 음악 제외) 전체 크기: 모든 효과음에 곱한다 */
const EFFECT_VOL = 2 / 3

/** iOS(특히 옛 아이패드): 소리 스위치·무음 모드에서도 웹 소리가 나도록, 화면을 처음 만질 때 짧은 무음을 <audio> 로 한 번 재생한다 */
const SILENT_WAV = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAGAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA'
let silentDone = false
function silentAudio() {
  if (silentDone) return
  silentDone = true
  try {
    const a = new Audio(SILENT_WAV)
    a.volume = 0.01
    void a.play().catch(() => { silentDone = false })
  } catch { silentDone = false }
}

/** iOS 는 화면을 만질 때 소리를 열어줘야 이후 효과음이 난다. 앱이 가려졌다 돌아오거나 전화로 끊긴 뒤에도 다시 만지면 이어서 나도록 계속 듣는다 */
function unlock() {
  silentAudio()
  if (ctx && ctx.state === 'running') return
  const c = getCtx()
  if (!c) return
  try {
    const src = c.createBufferSource()
    src.buffer = c.createBuffer(1, 1, 22050)
    src.connect(c.destination)
    src.start(0)
  } catch { /* 무시 */ }
}
if (typeof window !== 'undefined') {
  for (const e of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(e, unlock, true)
}

function click(c: AudioContext, at: number, freq: number, gain: number) {
  const len = Math.floor(c.sampleRate * 0.04)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  const src = c.createBufferSource()
  src.buffer = buf
  const hp = c.createBiquadFilter()
  hp.type = 'lowpass'
  hp.frequency.value = Math.min(freq, 1500)
  hp.Q.value = 0.5
  const g = c.createGain()
  g.gain.setValueAtTime(gain * 0.35 * EFFECT_VOL, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.05)
  src.connect(hp).connect(g).connect(c.destination)
  src.start(at)

  const osc = c.createOscillator()
  const og = c.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq / 3, at)
  osc.frequency.exponentialRampToValueAtTime(freq / 6, at + 0.05)
  og.gain.setValueAtTime(gain * 0.25 * EFFECT_VOL, at)
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
export const setSoundEnabled = (on: boolean) => { enabled = on; syncBgm() }
/** 설정의 효과음이 켜져 있는지(동물 전화 목소리도 이걸 따른다) */
export const soundOn = () => enabled

/* ---------- 배경 음악(마을 산책): 한 곡을 반복한다. 효과음 끄기를 따르고, 앱이 가려지면 멈춘다 ---------- */
let bgmWant: string | null = null
// 곡마다 따로 튼다: 'birds+cafe' → 'cafe' 처럼 바뀌면 둘 다에 있는 카페 노래는 끊지 않고 이어서 나오고, 새소리만 멈춘다
const bgmNodes = new Map<string, AudioBufferSourceNode>()
const bgmLoading = new Set<string>()
const BGM_GAIN: Record<string, number> = { birds: 0.18, cafe: 0.1, room: 0.2, run: 0.1, shop: 0.12, rain: 0.1 }
const wanted = () => (bgmWant && enabled && !hiddenNow() ? bgmWant.split('+') : [])
function stopBgmNode() {
  for (const src of bgmNodes.values()) { try { src.stop() } catch { /* 이미 멈춤 */ } }
  bgmNodes.clear()
}
function syncBgm() {
  const want = wanted()
  for (const [n, src] of bgmNodes) if (!want.includes(n)) { try { src.stop() } catch { /* 이미 멈춤 */ } bgmNodes.delete(n) }
  const c = want.length ? getCtx() : null
  if (!c) return
  for (const n of want) {
    if (bgmNodes.has(n) || bgmLoading.has(n)) continue
    bgmLoading.add(n)
    void loadSample(c, n).then((buf) => {
      bgmLoading.delete(n)
      if (!buf || !wanted().includes(n) || bgmNodes.has(n)) return
      const src = c.createBufferSource()
      const g = c.createGain()
      g.gain.value = BGM_GAIN[n] ?? 0.12
      src.buffer = buf
      src.loop = true
      src.connect(g).connect(c.destination)
      src.start()
      bgmNodes.set(n, src)
    })
  }
}
/** 배경 음악을 켠다(이미 같은 곡이면 그대로) */
export const startBgm = (name: string) => { bgmWant = name; syncBgm() }
// 화면을 옮길 때(방 탭 → 보물 탭 등) 같은 노래가 이어지면 끊지 않도록, 멈춤은 잠깐 기다렸다가 한다
let stopTimer: ReturnType<typeof setTimeout> | undefined
export const stopBgm = () => {
  bgmWant = null
  clearTimeout(stopTimer)
  stopTimer = setTimeout(syncBgm, 250)
}
/** 앱이 가려지거나 닫히면 소리를 완전히 멈추고(배경 음악도 끊는다), 다시 보이면 그 화면의 음악을 처음부터 다시 튼다.
 *  아이폰은 'playback' 소리 설정이라 멈추지 않으면 앱을 닫아도 뒤에서 음악이 계속 나오고, 다시 연 앱 음악과 섞인다 */
function sessionType(type: string) {
  try {
    const s = (navigator as unknown as { audioSession?: { type: string } }).audioSession
    if (s) s.type = type
  } catch { /* 지원하지 않으면 무시 */ }
}
function goQuiet() {
  stopBgmNode()
  if (ctx && ctx.state === 'running') void ctx.suspend()
  sessionType('auto')
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { goQuiet(); return }
    sessionType('playback')
    if (ctx && ctx.state !== 'running') void ctx.resume()
    syncBgm()
  })
  window.addEventListener('pagehide', goQuiet)
}

/** 톤 하나: 시작 주파수 → 끝 주파수로 미끄러지며 사라진다. 높은 소리는 한 옥타브 내리고, 부드럽게 깎아 귀가 편하게 한다 */
function tone(c: AudioContext, at: number, f0: number, f1: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  while (f0 > 1250) { f0 /= 2; f1 /= 2 }
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 2200
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain * 0.6 * EFFECT_VOL, at + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.05)
  lp.connect(g).connect(c.destination)
  for (const [mul, vol] of [[1, 1], [2, 0.15]] as const) {
    const o = c.createOscillator()
    const og = c.createGain()
    o.type = mul === 1 && type === 'triangle' ? 'triangle' : 'sine'
    o.frequency.setValueAtTime(f0 * mul, at)
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * mul), at + dur)
    og.gain.value = vol
    o.connect(og).connect(lp)
    o.start(at)
    o.stop(at + dur + 0.08)
  }
}

const play = (fn: (c: AudioContext, t: number) => void) => {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  fn(c, c.currentTime)
}
const jitter = (n: number) => n * (0.97 + Math.random() * 0.06)

/** 점프: 말이 폴짝 떠오른다 */
export const playHop = () => play((c, t) => { tone(c, t, jitter(700), jitter(1250), 0.12, 0.2); tone(c, t + 0.05, jitter(1100), jitter(1700), 0.09, 0.08, 'triangle') })
/** 점프: 뛰어넘은 말이 톡 사라진다 */
export const playPop = () => play((c, t) => { tone(c, t, jitter(1500), jitter(700), 0.07, 0.18); click(c, t, 4200, 0.2) })
/** 점프: 말이 내려앉는다 */
export const playLand = () => play((c, t) => { tone(c, t, jitter(620), jitter(420), 0.08, 0.2, 'triangle'); click(c, t, 3200, 0.22) })
/** 세트를 완성했다 */
export const playSetDone = () => play((c, t) => { [659, 831, 988, 1319].forEach((f, i) => tone(c, t + i * 0.08, f, f * 1.01, 0.2, 0.16, 'triangle')) })
/** 이겼다 */
export const playWin = () => playSample('gold', 0.25, (c, t) => { [659, 831, 988, 831, 988, 1319, 1661].forEach((f, i) => tone(c, t + i * 0.1, f, f * 1.01, 0.24, 0.17, 'triangle')) })
/** 졌다(부드럽게) */
export const playLose = () => playSample('lose', 0.25, (c, t) => { [659, 554, 440].forEach((f, i) => tone(c, t + i * 0.15, f, f * 0.99, 0.28, 0.14, 'sine')) })
/** 별비: 별을 받았다 */
export const playStar = () => playSample('star', 0.3, (c, t) => { tone(c, t, jitter(1568), jitter(2093), 0.1, 0.16); tone(c, t + 0.05, jitter(2093), jitter(2637), 0.13, 0.11, 'triangle') })
/** 별비: 금빛 별(5점)을 받았다 */
export const playGold = () => playSample('gold', 0.25, (c, t) => { [1175, 1568, 1976, 2637].forEach((f, i) => tone(c, t + i * 0.05, f, f * 1.01, 0.2, 0.15, 'triangle')) })
/** 별비: 구름에 부딪혔다 */
export const playCloud = () => play((c, t) => { tone(c, t, 520, 300, 0.16, 0.16, 'triangle') })

/* ---------- 농장·카페 효과음 ---------- */
/** 씨앗을 심는다(흙을 톡톡) */
export const playPlant = () => play((c, t) => { tone(c, t, jitter(560), jitter(400), 0.07, 0.2, 'triangle'); tone(c, t + 0.09, jitter(640), jitter(440), 0.07, 0.18, 'triangle') })
/** 직접 고른 소리 파일(public/assets/sfx/<이름>.mp3). 처음 한 번만 받아서 풀어 둔다 */
const samples = new Map<string, Promise<AudioBuffer | null>>()
/** 옛 Safari 는 decodeAudioData 가 Promise 를 안 돌려줘서 콜백 방식으로도 받는다 */
const decode = (c: AudioContext, b: ArrayBuffer) =>
  new Promise<AudioBuffer>((resolve, reject) => {
    const r = c.decodeAudioData(b, resolve, reject) as Promise<AudioBuffer> | undefined
    r?.then(resolve, reject)
  })
const loadSample = (c: AudioContext, name: string) => {
  let p = samples.get(name)
  if (!p) {
    p = fetch(assetUrl(`assets/sfx/${name}.mp3`))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('sfx'))))
      .then((b) => decode(c, b))
      .catch(() => { samples.delete(name); return null })
    samples.set(name, p)
  }
  return p
}
/** 미리 녹음한 목소리 파일(동물 전화 대사) 재생. 끝까지 들리면 true, 파일이 없거나 못 틀면 false(그러면 기기 음성으로 읽는다) */
export function playVoiceFile(path: string, gain = 1): { done: Promise<boolean>; stop: () => void } {
  let src: AudioBufferSourceNode | null = null
  let stopped = false
  let finish: (ok: boolean) => void = () => {}
  let timer = 0
  const done = new Promise<boolean>((res) => { finish = (ok) => { clearTimeout(timer); res(ok) } })
  // 파일을 오래 못 받으면 기기 음성으로 넘어가고, 소리가 멈춰 있어 끝났다는 소식이 안 와도 길이만큼 지나면 넘어간다
  timer = window.setTimeout(() => finish(false), 6000)
  const c = getCtx()
  if (!c) { finish(false); return { done, stop: () => {} } }
  fetch(assetUrl(path))
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('voice'))))
    .then((b) => decode(c, b))
    .then((buf) => {
      if (stopped) { finish(true); return }
      src = c.createBufferSource()
      const g = c.createGain()
      g.gain.value = gain
      src.buffer = buf
      src.connect(g).connect(c.destination)
      src.onended = () => finish(true)
      src.start()
      clearTimeout(timer)
      timer = window.setTimeout(() => finish(true), buf.duration * 1000 + 800)
    })
    .catch(() => finish(false))
  return { done, stop: () => { stopped = true; try { src?.stop() } catch { /* 이미 멈춤 */ } finish(true) } }
}
/** 소리 파일을 재생한다. 파일을 못 받으면 fallback(합성음)을 대신 울린다 */
function playSample(name: string, gain: number, fallback: (c: AudioContext, t: number) => void) {
  if (!enabled) return
  const c = getCtx()
  if (!c) return
  void loadSample(c, name).then((buf) => {
    if (!enabled) return
    if (!buf) { fallback(c, c.currentTime); return }
    const src = c.createBufferSource()
    const g = c.createGain()
    g.gain.value = gain * EFFECT_VOL
    src.buffer = buf
    src.connect(g).connect(c.destination)
    src.start()
  })
}
/** 수학 문제를 맞혔다: 직접 고른 소리(correct.mp3) */
export const playCorrect = () => playSample('correct', 0.25, (c, t) => { [784, 988, 1319].forEach((f, k) => tone(c, t + k * 0.08, f, f * 1.01, 0.2, 0.14, 'triangle')) })
/** 수학 한 단원을 끝냈다: 직접 고른 소리(levelup.mp3) */
export const playLevelDone = () => playSample('levelup', 0.3, (c, t) => { [523, 659, 784, 1047, 1319].forEach((f, k) => tone(c, t + k * 0.1, f, f * 1.01, 0.3, 0.16, 'triangle')) })
/** 아이템을 눌렀다(옷장·방 꾸미기·상점 미리보기·산책 중 반짝이는 아이템): 이 소리 하나만 쓴다(tap.mp3) */
export const playTap = () => playSample('tap', 0.45, (c, t) => { tone(c, t, jitter(520), jitter(380), 0.06, 0.14, 'triangle') })
/** 물을 준다: 직접 고른 소리(water.mp3) */
export const playWater = () => playSample('water', 0.1, (c, t) => { for (let i = 0; i < 4; i++) tone(c, t + i * 0.07, jitter(1200 + i * 220), jitter(800 + i * 120), 0.09, 0.12) })
/** 수확한다: 직접 고른 소리(harvest.mp3) */
export const playHarvest = () => playSample('harvest', 0.23, () => {}) // 직접 고른 소리만 쓴다(못 받으면 소리 없음)
/** 코인을 받거나 쓴다(짤랑) */
export const playCoin = () => playSample('coin', 0.25, (c, t) => { tone(c, t, 1760, 1760, 0.09, 0.12, 'triangle'); tone(c, t + 0.07, 2349, 2349, 0.22, 0.12, 'triangle') })
/** 카페: 주문을 받았다(뾰롱) */
export const playOrder = () => playSample('cook', 0.25, (c, t) => { tone(c, t, jitter(880), jitter(1320), 0.11, 0.17); tone(c, t + 0.09, jitter(1175), jitter(1480), 0.12, 0.12, 'triangle') })
/** 카페: 만들기를 시작했다(보글) */
export const playCook = () => playSample('pop', 0.3, (c, t) => { for (let i = 0; i < 3; i++) tone(c, t + i * 0.07, jitter(600 + i * 100), jitter(950 + i * 120), 0.08, 0.13, 'triangle') })
/** 카페: 음식이 다 됐다(딩동) */
/** 카페: 서빙했다(직접 고른 소리 shine.mp3, 수확과 같은 소리). 코인 소리는 농장 등 다른 곳에서 계속 쓴다 */
export const playServe = () => playSample('shine', 0.6, (c, t) => { tone(c, t, 1760, 1760, 0.09, 0.12, 'triangle'); tone(c, t + 0.07, 2349, 2349, 0.22, 0.12, 'triangle') })
export const playBell = () => play((c, t) => { tone(c, t, 1976, 1976, 0.45, 0.16, 'triangle'); tone(c, t + 0.17, 1480, 1480, 0.55, 0.16, 'triangle') })

/** 축구: 공을 찬다(퉁) / 세게 찬다 / 굴려 준다 */
export const playKick = () => play((c, t) => { click(c, t, 900, 0.35); tone(c, t, jitter(190), jitter(90), 0.08, 0.22) })
export const playShoot = () => play((c, t) => { click(c, t, 1400, 0.55); tone(c, t, jitter(240), jitter(80), 0.12, 0.3); tone(c, t + 0.02, jitter(900), jitter(1200), 0.12, 0.08, 'triangle') })
export const playPass = () => play((c, t) => { click(c, t, 700, 0.22); tone(c, t, jitter(330), jitter(220), 0.07, 0.14) })
/** 축구: 심판 호루라기. long 이면 길게(경기 끝) */
export function playWhistle(long = false) {
  play((c, t) => {
    const dur = long ? 0.9 : 0.35
    const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), lp = c.createBiquadFilter()
    o.type = 'sine'; o.frequency.value = 2300
    lfo.frequency.value = 28; lg.gain.value = 140 // 호루라기 떨림
    lfo.connect(lg).connect(o.frequency)
    lp.type = 'lowpass'; lp.frequency.value = 3200
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.07 * EFFECT_VOL, t + 0.02)
    g.gain.setValueAtTime(0.07 * EFFECT_VOL, t + dur - 0.06)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(lp).connect(g).connect(c.destination)
    o.start(t); lfo.start(t); o.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02)
  })
}
/** 축구: 골! 관중 환호(부드러운 바람 같은 함성이 커졌다 잦아든다) */
export function playCheer() {
  play((c, t) => {
    const len = Math.floor(c.sampleRate * 1.6)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = c.createBufferSource(); src.buffer = buf
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12 * EFFECT_VOL, t + 0.25)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.55)
    src.connect(bp).connect(g).connect(c.destination)
    src.start(t)
    ;[523, 659, 784].forEach((f, k) => tone(c, t + 0.1 + k * 0.09, f, f * 1.01, 0.22, 0.1, 'triangle'))
  })
}
