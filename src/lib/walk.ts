export interface Vec {
  x: number
  y: number
}

/** 장면 안에서 걸을 수 있는 범위(%): 하늘 쪽은 막고 바닥·잔디 위로만 */
export const WALK_BOUNDS = { minX: 6, maxX: 94, minY: 48, maxY: 92 }

export const clampToBounds = (p: Vec): Vec => ({
  x: Math.min(WALK_BOUNDS.maxX, Math.max(WALK_BOUNDS.minX, p.x)),
  y: Math.min(WALK_BOUNDS.maxY, Math.max(WALK_BOUNDS.minY, p.y)),
})

/** 장면(1086×1448)에서 %를 같은 길이 단위(px)로 바꿔 거리를 잰다 */
const SCENE_W = 1086
const SCENE_H = 1448
export const distPx = (a: Vec, b: Vec) => Math.hypot(((a.x - b.x) / 100) * SCENE_W, ((a.y - b.y) / 100) * SCENE_H)

/** 걷는 속도: 1초에 장면 너비의 0.55배 */
export const WALK_SPEED_PX = SCENE_W * 0.55

/** 목표를 향해 dt 초 동안 걷는다 */
export function stepToward(pos: Vec, target: Vec, dt: number, speedPx = WALK_SPEED_PX): { pos: Vec; arrived: boolean } {
  const d = distPx(pos, target)
  const move = speedPx * dt
  if (d <= move || d < 0.5) return { pos: target, arrived: true }
  const k = move / d
  return { pos: { x: pos.x + (target.x - pos.x) * k, y: pos.y + (target.y - pos.y) * k }, arrived: false }
}

/** 멀리(아래쪽) 있을수록 크게, 위쪽일수록 작게 — 원근감 */
export const depthScale = (y: number) => 0.62 + ((y - WALK_BOUNDS.minY) / (WALK_BOUNDS.maxY - WALK_BOUNDS.minY)) * 0.38
