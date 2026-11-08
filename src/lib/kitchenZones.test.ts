import { describe, expect, it } from 'vitest'
import { clampKitchenActor, kitchenActorZone } from './kitchenZones'

describe('주방 아바타 구역', () => {
  it('내 아바타와 두 친구의 구역 사이에 몸 너비만큼 간격을 둔다', () => {
    for (let i = 0; i < 2; i++) expect(kitchenActorZone(i + 1).x0 - kitchenActorZone(i).x1).toBeGreaterThanOrEqual(1.79)
  })
  it('바닥 이동·자동 조리·친구 산책은 모두 자기 구역에 머문다', () => {
    for (let i = 0; i < 3; i++) for (const x of [-100, 0, 100]) for (const z of [-100, 0, 100]) {
      const p = clampKitchenActor(i, x, z), zone = kitchenActorZone(i)
      expect(p.x).toBeGreaterThanOrEqual(zone.x0); expect(p.x).toBeLessThanOrEqual(zone.x1)
      expect(p.z).toBeGreaterThanOrEqual(zone.z0); expect(p.z).toBeLessThanOrEqual(zone.z1)
    }
  })
})
