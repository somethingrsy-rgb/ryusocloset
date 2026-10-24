import { MY_ROOM, PLACES } from './game'

/**
 * 끝없이 이어지는 맵. 맵은 구간(chunk)으로 나뉘고, 오른쪽으로 걸어가 끝이 가까워지면 새 구간이 이어 붙는다.
 * 구간 i 의 테마는 PLACES[i % 10] (한 바퀴 돌면 처음 테마가 다시 나온다). 화면 높이에 맞춰 논리 px 로 통째로 확대·축소해서 보여준다.
 */
export const CHUNK_W = 1248
export const WORLD_H = 800
export const MIN_CHUNKS = 10
export const GROUND = { minY: 585, maxY: 735 }
export const DOOR_Y = 560
/**
 * 길 배경 그림 한 장(원본 가로 19200, 1.3배로 키워 TILE_W)에 집이 20채 있고, 집 하나가 장소 하나다 (구간 20개 = 그림 한 장, 장소 10곳이 두 번 돈다).
 * 그림은 봄 → 숲속 요정 → 앨리스 → 궁전 → 할로윈 → 가을 → 크리스마스 쿠키집 순서로 이어지고, 오른쪽 끝과 왼쪽 끝도 이어져서 그대로 반복해 붙인다.
 * HOUSE_X 는 그림 속 집 문의 x (원본 기준). 웹 그림 한 장은 가로 16383px 까지라 그림을 조각(ROAD_PARTS 개)으로 나눠 쓴다.
 */
export const TILE_W = 24960
export const ROAD_PART = 9600 // 그림 한 조각의 원본 가로
export const ROAD_PARTS = 2
const HOUSE_X = [720, 1280, 2530, 3290, 4515, 5175, 6395, 7155, 8270, 9075, 10065, 11100, 12080, 13055, 14050, 14815, 16060, 16740, 17865, 18765]

/** 그림 속 집 테두리(원본 px): 문 x 기준 왼쪽·오른쪽 끝과 위 끝(집 아래 끝은 모두 HOUSE_BOTTOM). 네온 테두리를 그릴 때 쓴다 */
const HOUSE_BOX: [number, number, number][] = [
  [-125, 135, 185], [-135, 145, 185], [-135, 145, 185], [-140, 150, 185], [-185, 165, 175],
  [-170, 170, 130], [-170, 150, 165], [-160, 170, 125], [-190, 180, 100], [-205, 200, 110],
  [-205, 175, 100], [-190, 190, 100], [-150, 160, 100], [-175, 190, 100], [-170, 160, 175],
  [-160, 150, 205], [-200, 150, 165], [-175, 180, 165], [-200, 160, 105], [-180, 180, 105],
]
const HOUSE_BOTTOM = 445
/** 구간 c 의 집 테두리(월드 좌표): 배경 그림은 1.3배, 위로 26 올려 그린다 */
export const houseBox = (c: number) => {
  const [l, r, t] = HOUSE_BOX[((c % HOUSE_BOX.length) + HOUSE_BOX.length) % HOUSE_BOX.length]
  const x = gateX(c)
  return { left: x + 1.3 * l, right: x + 1.3 * r, top: 1.3 * t - 26, bottom: 1.3 * HOUSE_BOTTOM - 26 }
}

export const worldWidth = (chunks: number) => chunks * CHUNK_W

/** 구간 c 의 문 x 좌표 */
export const gateX = (c: number) => {
  const t = Math.floor(c / HOUSE_X.length)
  return t * TILE_W + Math.round(1.3 * HOUSE_X[((c % HOUSE_X.length) + HOUSE_X.length) % HOUSE_X.length])
}
/** 길의 집 20채(그림 한 장) 중 몇 번째 집이 내 방인지: 시작하는 집 바로 다음 집 */
export const MY_ROOM_HOUSE = 1
/** 구간 c 의 장소 (그림 한 장마다 한 채는 내 방, 나머지는 장소 10곳이 두 번 돈다) */
export const placeOfChunk = (c: number) => ((c % HOUSE_X.length) + HOUSE_X.length) % HOUSE_X.length === MY_ROOM_HOUSE ? MY_ROOM : PLACES[((c % PLACES.length) + PLACES.length) % PLACES.length]

export const clampWalk = (x: number, y: number, chunks: number) => ({
  x: Math.min(worldWidth(chunks) - 60, Math.max(60, x)),
  y: Math.min(GROUND.maxY, Math.max(GROUND.minY, y)),
})

/** 류소가 맵 끝에서 이 거리 안으로 오면 구간을 하나 더 잇는다. 필요한 구간 수를 돌려준다. */
export const EXTEND_AHEAD = 3
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
  const c0 = Math.round(pos.x / CHUNK_W)
  for (let c = Math.max(0, c0 - 2); c <= c0 + 2; c++) if (Math.hypot(pos.x - gateX(c), pos.y - (DOOR_Y + 40)) < radius) return c
  return -1
}

/** 구간 c 의 문 앞 길 위(문 오른쪽 옆)에서 시작한다. 문에는 닿지 않는다 */
export const startPos = (c: number) => ({ x: gateX(Math.max(0, c)) + 100, y: 650 })

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
