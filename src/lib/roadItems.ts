import { CHUNK_W, GROUND, gateX } from './world'
import { isFound, travelPool } from './game'

const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** 길에서 줍는 아이템: 구간 세 개에 하나쯤 반짝이는 자리가 있고, 그 자리의 아이템은 늘 같다 (이미 찾았으면 사라진다) */
export function roadSpot(c: number): { id: string; x: number; y: number } | null {
  const h = hash(`road${c}`)
  if (h % 3 !== 0) return null
  const pool = travelPool().sort((a, b) => (a.id < b.id ? -1 : 1))
  if (!pool.length) return null
  const item = pool[hash(`item${c}`) % pool.length]
  if (isFound(item.id)) return null
  let x = c * CHUNK_W + 220 + ((h >>> 3) % (CHUNK_W - 440))
  if (Math.abs(x - gateX(c)) < 220) x += 330
  return { id: item.id, x, y: GROUND.minY + 20 + ((h >>> 9) % (GROUND.maxY - GROUND.minY - 40)) }
}
