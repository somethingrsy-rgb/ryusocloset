import { PLACES } from './game'

/**
 * 끝없이 이어지는 맵. 맵은 구간(chunk)으로 나뉘고, 오른쪽으로 걸어가 끝이 가까워지면 새 구간이 이어 붙는다.
 * 구간 i 의 테마는 PLACES[i % 10] (한 바퀴 돌면 처음 테마가 다시 나온다). 화면 높이에 맞춰 논리 px 로 통째로 확대·축소해서 보여준다.
 */
export const CHUNK_W = 1500
export const WORLD_H = 800
export const MIN_CHUNKS = 3
export const GROUND = { minY: 540, maxY: 760 }
export const DOOR_Y = 600
/** 구간 안에서 문의 x 위치 */
export const GATE_OFFSET = 700

export const worldWidth = (chunks: number) => chunks * CHUNK_W

/** 구간 c 의 문 x 좌표 */
export const gateX = (c: number) => c * CHUNK_W + GATE_OFFSET
/** 구간 c 의 장소 */
export const placeOfChunk = (c: number) => PLACES[((c % PLACES.length) + PLACES.length) % PLACES.length]

export const clampWalk = (x: number, y: number, chunks: number) => ({
  x: Math.min(worldWidth(chunks) - 60, Math.max(60, x)),
  y: Math.min(GROUND.maxY, Math.max(GROUND.minY, y)),
})

/** 류소가 맵 끝에서 이 거리 안으로 오면 구간을 하나 더 잇는다. 필요한 구간 수를 돌려준다. */
export const EXTEND_AHEAD = 1.6
export const chunksNeeded = (playerX: number, chunks: number) => Math.max(chunks, Math.floor(playerX / CHUNK_W + EXTEND_AHEAD) + 1)

/** 화면에 보이는 너비(논리 px)에서 카메라 왼쪽 끝: 류소를 가운데에 두되 맵 밖은 보이지 않게 */
export const cameraX = (playerX: number, visibleW: number, chunks: number) => Math.min(Math.max(0, worldWidth(chunks) - visibleW), Math.max(0, playerX - visibleW / 2))

/** 류소 속도(논리 px/초) */
export const WORLD_SPEED = 520

export function stepWorld(pos: { x: number; y: number }, target: { x: number; y: number }, dt: number) {
  const d = Math.hypot(target.x - pos.x, target.y - pos.y)
  const move = WORLD_SPEED * dt
  if (d <= move) return { pos: target, arrived: true }
  const k = move / d
  return { pos: { x: pos.x + (target.x - pos.x) * k, y: pos.y + (target.y - pos.y) * k }, arrived: false }
}

/** 문에 닿을 만큼 가까운 구간 번호 (없으면 -1) */
export function gateAt(pos: { x: number; y: number }, radius = 90): number {
  const c = Math.round((pos.x - GATE_OFFSET) / CHUNK_W)
  if (c < 0) return -1
  return Math.hypot(pos.x - gateX(c), pos.y - (DOOR_Y + 40)) < radius ? c : -1
}

/** 구간 c 의 문 바로 앞(아래)에서 시작한다 */
export const startPos = (c: number) => ({ x: gateX(Math.max(0, c)), y: GROUND.maxY - 10 })

/** 걸은 거리(m): 논리 px 50 이 1m */
export const metersOf = (x: number) => Math.max(0, Math.floor(x / 50))

/** 지역별 하늘 색·땅 색 (장소 순서). 구간 안에서 다음 지역 색으로 서서히 바뀐다. */
export const ZONE_SKY = ['#ffe3ee', '#bfe8ff', '#cfe8c0', '#ffe3f4', '#5b4a78', '#e2d8ff', '#ffd0dc', '#fff1c9', '#cfeedd', '#e4f2ff']
export const ZONE_GROUND = ['#cdeba6', '#f5e3a8', '#a9d49b', '#f2d9ec', '#6b5a82', '#cbbdf0', '#f6bccb', '#ead9a2', '#bfe3cf', '#f4fbff']
/** 지역 꾸밈(이모지): 장소 순서 */
export const ZONE_DECOR = [
  ['🌸', '🌳', '🌷'], ['🌴', '🐚', '⛱️'], ['🌲', '🔥', '🏕️'], ['🎈', '🎁', '🎂'], ['🎃', '🪦', '🦇'],
  ['🍄', '🫖', '🃏'], ['💗', '🌹', '💌'], ['🏰', '👑', '⚜️'], ['🎄', '⭐', '🧦'], ['❄️', '⛄', '🌨️'],
]

const hash = (a: number, b: number) => {
  let h = Math.imul(a + 1, 2654435761) ^ Math.imul(b + 7, 40503)
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  return (h ^ (h >>> 13)) >>> 0
}

/** 구간 c 의 꾸밈 배치(이모지·x·y): 같은 구간은 늘 같은 모양 */
export function decorFor(c: number, count = 9): { emoji: string; x: number; y: number; big: boolean }[] {
  const set = ZONE_DECOR[((c % ZONE_DECOR.length) + ZONE_DECOR.length) % ZONE_DECOR.length]
  return Array.from({ length: count }, (_, k) => {
    const h = hash(c, k)
    const x = c * CHUNK_W + 60 + (h % (CHUNK_W - 120))
    // 문 근처는 비워 둔다
    const nearGate = Math.abs(x - gateX(c)) < 170
    return { emoji: set[(h >> 8) % set.length], x: nearGate ? x + 360 : x, y: 300 + ((h >> 12) % 280), big: (h >> 4) % 4 === 0 }
  })
}
