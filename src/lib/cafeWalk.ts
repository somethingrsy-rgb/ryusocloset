export interface CafePoint { x: number; z: number }
export interface CafeObstacle extends CafePoint { r: number }

/** 정원 경계와 테이블을 피하는 한 걸음. 대각선은 정규화하여 속도를 유지한다. */
/** 걸을 수 있는 땅(기본: 예전 작은 정원) */
export interface CafeBounds { x0: number; x1: number; z0: number; z1: number }
const GARDEN: CafeBounds = { x0: -8.5, x1: 8.5, z0: -4.8, z1: 6.5 }
export function stepCafe(from: CafePoint, goal: CafePoint, distance: number, obstacles: CafeObstacle[], bounds: CafeBounds = GARDEN): CafePoint {
  const dx = goal.x - from.x, dz = goal.z - from.z, length = Math.hypot(dx, dz)
  if (!length || distance <= 0) return { x: from.x, z: from.z }
  const step = Math.min(distance, length)
  let vx = dx / length, vz = dz / length
  // 가까운 장애물 앞에서는 목적지 방향에 맞춰 옆으로 돌아간다.
  for (const o of obstacles) {
    const ox = o.x - from.x, oz = o.z - from.z
    const ahead = ox * vx + oz * vz, side = ox * vz - oz * vx
    if (ahead > 0 && ahead < o.r + 1 && Math.abs(side) < o.r + 0.4) {
      const d = Math.hypot(ox, oz) || 1
      // 같은 방향으로 돌아야 좌우 조향이 번갈아 바뀌며 막히지 않는다.
      const outward = Math.max(0, (o.r + 0.65 - d) * 2)
      const nx = oz / d - ox / d * outward, nz = -ox / d - oz / d * outward
      const norm = Math.hypot(nx, nz); vx = nx / norm; vz = nz / norm
      break
    }
  }
  let x = from.x + vx * step, z = from.z + vz * step
  for (const o of obstacles) {
    const ax = x - o.x, az = z - o.z, d = Math.hypot(ax, az), min = o.r + 0.35
    if (d < min) { x = o.x + (d ? ax / d : 1) * min; z = o.z + (d ? az / d : 0) * min }
  }
  return { x: Math.max(bounds.x0, Math.min(bounds.x1, x)), z: Math.max(bounds.z0, Math.min(bounds.z1, z)) }
}
