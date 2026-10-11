export const RAIN_DURATION = 60
export const CATCH_Y = 80
export interface RainDrop { id: number; kind: 'star' | 'gold' | 'cloud'; x: number; y: number; speed: number }
export interface RainState {
  elapsed: number; score: number; caught: number; clouds: number; playerX: number; targetX: number
  slowUntil: number; drops: RainDrop[]; nextSpawn: number; serial: number
}
export const newRain = (): RainState => ({ elapsed: 0, score: 0, caught: 0, clouds: 0, playerX: 50, targetX: 50, slowUntil: 0, drops: [], nextSpawn: .4, serial: 0 })
export const clampRainX = (x: number) => Math.max(10, Math.min(90, x))
/** Only active play time advances. A drop resolves once when crossing the basket. */
export function stepRain(state: RainState, seconds: number, random = Math.random): RainState {
  if (state.elapsed >= RAIN_DURATION || !Number.isFinite(seconds) || seconds <= 0) return state
  const dt = Math.min(seconds, .1, RAIN_DURATION - state.elapsed)
  const elapsed = state.elapsed + dt
  const targetX = clampRainX(state.targetX)
  const distance = targetX - state.playerX
  const move = (state.elapsed < state.slowUntil ? 32 : 68) * dt
  const playerX = clampRainX(state.playerX + Math.sign(distance) * Math.min(Math.abs(distance), move))
  let score = state.score, caught = state.caught, clouds = state.clouds, slowUntil = state.slowUntil
  const drops: RainDrop[] = []
  for (const drop of state.drops) {
    const y = drop.y + drop.speed * dt
    if (drop.y < CATCH_Y && y >= CATCH_Y && Math.abs(drop.x - playerX) <= (drop.kind === 'cloud' ? 7 : 9)) {
      if (drop.kind === 'cloud') { clouds++; slowUntil = elapsed + 1.8 }
      else { caught++; score += drop.kind === 'gold' ? 5 : 1 }
      continue
    }
    if (y < 108) drops.push({ ...drop, y })
  }
  let nextSpawn = state.nextSpawn, serial = state.serial
  if (elapsed >= nextSpawn && elapsed < RAIN_DURATION - 3) {
    serial++
    const kind = serial % 5 === 0 ? 'cloud' : serial % 7 === 0 ? 'gold' : 'star'
    drops.push({ id: serial, kind, x: 12 + Math.max(0, Math.min(1, random())) * 76, y: -6, speed: kind === 'cloud' ? 27 : 24 + Math.max(0, Math.min(1, random())) * 8 })
    nextSpawn = elapsed + .8
  }
  return { elapsed, score, caught, clouds, playerX, targetX, slowUntil, drops, nextSpawn, serial }
}
export interface RainRecord { best: number; total: number; rounds: number }
export function readRainRecord(): RainRecord {
  try {
    const raw = JSON.parse(localStorage.getItem('ryuso.starRain.v1') ?? '{}')
    const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0
    return { best: count(raw?.best), total: count(raw?.total), rounds: count(raw?.rounds) }
  } catch { return { best: 0, total: 0, rounds: 0 } }
}
