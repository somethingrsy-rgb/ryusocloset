/** 게임 속 하루: 실제 시간으로 8분에 한 바퀴 (낮 → 저녁 → 밤 → 새벽). 누르면 다음 시간대로 건너뛴다. */
export const CYCLE_MS = 8 * 60 * 1000

export type Phase = 'dawn' | 'day' | 'dusk' | 'night'

export interface Clock {
  /** 하루 중 위치 0~1 (0.25 = 한낮, 0.75 = 한밤) */
  f: number
  /** 어둠 정도 0(낮)~1(밤) */
  dark: number
  phase: Phase
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 처음 켰을 때는 낮에서 시작한다 */
let offset = CYCLE_MS * 0.2
export const skipOffset = () => offset
export const setSkipOffset = (v: number) => {
  offset = v
}

export function clockAt(ms: number): Clock {
  const f = ((((ms + offset) % CYCLE_MS) + CYCLE_MS) % CYCLE_MS) / CYCLE_MS
  const sun = Math.sin(2 * Math.PI * f)
  const dark = clamp((0.3 - sun) / 0.6, 0, 1)
  // 한낮(0.25) 이후 해가 지면 저녁, 한밤(0.75) 이후 해가 뜨면 새벽
  const phase: Phase = dark === 0 ? 'day' : dark >= 0.85 ? 'night' : f < 0.5 ? 'dusk' : 'dawn'
  return { f, dark, phase }
}

/** 다음 시간대 시작까지 건너뛴다 (낮 → 저녁 → 밤 → 새벽 → 낮) */
export function skipToNext(ms: number): void {
  const order: Phase[] = ['day', 'dusk', 'night', 'dawn']
  const cur = clockAt(ms).phase
  const want = order[(order.indexOf(cur) + 1) % order.length]
  // 목표 시간대가 나올 때까지 1분씩 앞으로 (최대 한 바퀴)
  for (let k = 1; k <= CYCLE_MS / 60000 + 1; k++) {
    if (clockAt(ms + k * 60000).phase === want) {
      offset += k * 60000
      return
    }
  }
}

/** 배경 위에 덮는 색: 밤엔 짙은 남색, 저녁·새벽엔 주황빛이 섞인다 */
export function tintOf(c: Clock): string | null {
  if (c.dark <= 0) return null
  const warm = Math.max(0, 1 - Math.abs(c.dark * 2 - 1)) * 0.28
  const night = c.dark * 0.55
  return `linear-gradient(rgba(255,140,60,${warm.toFixed(3)}), rgba(255,140,60,${warm.toFixed(3)})), linear-gradient(rgba(14,24,84,${night.toFixed(3)}), rgba(14,24,84,${night.toFixed(3)}))`
}

export const PHASE_ICON: Record<Phase, string> = { day: '☀️', dusk: '🌇', night: '🌙', dawn: '🌅' }
export const PHASE_LABEL: Record<Phase, { ko: string; en: string }> = {
  day: { ko: '낮', en: 'Day' },
  dusk: { ko: '저녁', en: 'Dusk' },
  night: { ko: '밤', en: 'Night' },
  dawn: { ko: '새벽', en: 'Dawn' },
}
