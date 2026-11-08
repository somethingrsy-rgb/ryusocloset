export interface KitchenZone { x0: number; x1: number; z0: number; z1: number }
/** 몸 그림 폭(아바타 약 1.73)보다 넓게 통로 간격을 둔다. */
const ZONES: readonly KitchenZone[] = [
  { x0: -4.6, x1: -1.2, z0: -1.3, z1: 1.1 },
  { x0: 0.6, x1: 2, z0: -1.3, z1: 1.1 },
  { x0: 3.8, x1: 4.6, z0: -1.3, z1: 1.1 },
]
export const kitchenActorZone = (actor: number) => ZONES[Math.min(Math.max(0, actor), ZONES.length - 1)]
export function clampKitchenActor(actor: number, x: number, z: number) {
  const b = kitchenActorZone(actor)
  return { x: Math.max(b.x0, Math.min(b.x1, x)), z: Math.max(b.z0, Math.min(b.z1, z)) }
}
