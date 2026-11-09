import type { PlayerState } from './core'

export const AWAY_MS = 10 * 60 * 1000
export const SILENT_MS = 15 * 1000
/** t is the last foreground heartbeat. Background/disconnect events must never renew it. */
export const retained = (p: Pick<PlayerState, 't'>, now: number) => Number.isFinite(p.t) && now - p.t < AWAY_MS
export const isAway = (p: Pick<PlayerState, 't' | 'away'>, now: number) => p.away === true || now - p.t >= SILENT_MS
export function visiblePlayers(players: Record<string, PlayerState>, now: number) {
  return Object.fromEntries(Object.entries(players).filter(([, p]) => retained(p, now)).map(([uid, p]) => {
    const away = isAway(p, now)
    return [uid, { ...p, away, moving: away ? false : p.moving }]
  }))
}

const KEY = 'ryuso.mp.resume'
export interface Resume { uid: string; name: string; at: number; mode: string; visiting: string | null; hosting: boolean }
let mode = 'closet'
export function readResume(): Resume | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return r && typeof r.uid === 'string' && typeof r.name === 'string' && typeof r.at === 'number' && Date.now() - r.at < AWAY_MS
      ? { ...r, visiting: typeof r.visiting === 'string' ? r.visiting : null, hosting: r.hosting === true } : null
  } catch { return null }
}
export function rememberSession(r: Omit<Resume, 'mode'>) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...r, mode })) } catch { /* storage may be disabled */ }
}
export function forgetSession() { try { localStorage.removeItem(KEY) } catch { /* no storage */ } }
export function rememberMode(value: string) { mode = value }
