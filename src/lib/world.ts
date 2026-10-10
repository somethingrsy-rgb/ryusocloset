import { PLACES } from './game'

/** 이어진 넓은 맵의 크기(논리 px). 화면 높이에 맞춰 통째로 확대·축소해서 보여준다. */
export const WORLD_W = 4600
export const WORLD_H = 800
/** 걸을 수 있는 땅(세로 범위)과 문 앞 */
export const GROUND = { minY: 540, maxY: 760 }
export const DOOR_Y = 600
export const GATE_MARGIN = 380

/** i 번째 장소의 문 x 좌표: 왼쪽에서 오른쪽으로 여행 순서대로 늘어놓는다 */
export const gateX = (i: number, n = PLACES.length) => GATE_MARGIN + (i * (WORLD_W - 2 * GATE_MARGIN)) / Math.max(1, n - 1)

export const clampWalk = (x: number, y: number) => ({
  x: Math.min(WORLD_W - 60, Math.max(60, x)),
  y: Math.min(GROUND.maxY, Math.max(GROUND.minY, y)),
})

/** 화면에 보이는 너비(논리 px)에서 카메라 왼쪽 끝: 류소를 가운데에 두되 맵 밖은 보이지 않게 */
export const cameraX = (playerX: number, visibleW: number) => Math.min(Math.max(0, WORLD_W - visibleW), Math.max(0, playerX - visibleW / 2))

/** 류소 속도(논리 px/초) */
export const WORLD_SPEED = 520

export function stepWorld(pos: { x: number; y: number }, target: { x: number; y: number }, dt: number) {
  const d = Math.hypot(target.x - pos.x, target.y - pos.y)
  const move = WORLD_SPEED * dt
  if (d <= move) return { pos: target, arrived: true }
  const k = move / d
  return { pos: { x: pos.x + (target.x - pos.x) * k, y: pos.y + (target.y - pos.y) * k }, arrived: false }
}

/** 문에 닿을 만큼 가까운 장소의 번호 (없으면 -1) */
export function gateAt(pos: { x: number; y: number }, radius = 90): number {
  for (let i = 0; i < PLACES.length; i++) if (Math.hypot(pos.x - gateX(i), pos.y - (DOOR_Y + 40)) < radius) return i
  return -1
}

/** 지금 장소의 문 바로 앞(아래)에서 시작한다 */
export const startPos = (placeIndex: number) => ({ x: gateX(Math.max(0, placeIndex)), y: GROUND.maxY - 10 })

/** 지역별 하늘 색 (왼쪽 → 오른쪽, 장소 순서) */
export const ZONE_SKY = ['#ffe3ee', '#bfe8ff', '#cfe8c0', '#ffe3f4', '#5b4a78', '#e2d8ff', '#ffd0dc', '#fff1c9', '#cfeedd', '#e4f2ff']
export const ZONE_GROUND = ['#cdeba6', '#f5e3a8', '#a9d49b', '#f2d9ec', '#6b5a82', '#cbbdf0', '#f6bccb', '#ead9a2', '#bfe3cf', '#f4fbff']
/** 지역 꾸밈(이모지): 장소 순서 */
export const ZONE_DECOR = [
  ['🌸', '🌳', '🌷'], ['🌴', '🐚', '⛱️'], ['🌲', '🔥', '🏕️'], ['🎈', '🎁', '🎂'], ['🎃', '🪦', '🦇'],
  ['🍄', '🫖', '🃏'], ['💗', '🌹', '💌'], ['🏰', '👑', '⚜️'], ['🎄', '⭐', '🧦'], ['❄️', '⛄', '🌨️'],
]
