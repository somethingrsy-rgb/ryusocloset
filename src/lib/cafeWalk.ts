export interface CafePoint { x: number; z: number }
export interface CafeObstacle extends CafePoint { r: number }

/** 정원 경계와 테이블을 피하는 한 걸음. 대각선은 정규화하여 속도를 유지한다. */
export function stepCafe(from: CafePoint, goal: CafePoint, distance: number, obstacles: CafeObstacle[]): CafePoint {
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
  return { x: Math.max(-8.5, Math.min(8.5, x)), z: Math.max(-4.8, Math.min(6.5, z)) }
}

export const CAFE_GUEST_GAP = 1.65
export const CAFE_SEATED_COUNT = 4

/** 다른 손님이 있으면 우회하고, 양쪽 모두 막혔을 때는 제자리에서 기다린다. */
export function stepCafeCrowd(from: CafePoint, goal: CafePoint, distance: number, obstacles: CafeObstacle[], others: CafePoint[]): CafePoint {
  const clear = (p: CafePoint) => others.every(o => {
    const before = Math.hypot(from.x - o.x, from.z - o.z)
    const after = Math.hypot(p.x - o.x, p.z - o.z)
    // 화면 회전으로 배치가 좁아진 직후에는 더 멀어지는 방향으로 빠져나온다.
    return after >= CAFE_GUEST_GAP || (before < CAFE_GUEST_GAP && after > before + 0.00001)
  })
  const next = stepCafe(from, goal, distance, obstacles)
  if (clear(next)) return next
  const dx = goal.x - from.x, dz = goal.z - from.z, n = Math.hypot(dx, dz) || 1
  for (const sign of [1, -1]) {
    const side = stepCafe(from, { x: from.x + sign * dz / n, z: from.z - sign * dx / n }, distance, obstacles)
    if (clear(side)) return side
  }
  return { x: from.x, z: from.z }
}

/** 주위에서 가장 가까운 한 손님만 주문 내용을 펼친다. */
export function nearestCafeGuest(me: CafePoint, guests: CafePoint[], radius = 2.2): number | null {
  let nearest: number | null = null, best = radius
  guests.forEach((p, i) => {
    const d = Math.hypot(p.x - me.x, p.z - me.z)
    if (d < best) { best = d; nearest = i }
  })
  return nearest
}
