/** 8방향 그림을 경계 근처에서 부드럽게 전환한다. 0 = 정면(+z). */
export function castleViewBlend(angle: number) {
  const turn = ((angle / (Math.PI * 2)) % 1 + 1) % 1
  const frame = turn * 8, a = Math.floor(frame), t = Math.max(0, Math.min(1, (frame - a - 0.35) / 0.3))
  return { a, b: (a + 1) % 8, mix: t * t * (3 - 2 * t) }
}
