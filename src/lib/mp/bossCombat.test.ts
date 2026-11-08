import { describe, expect, it } from 'vitest'
import { BATTLE_ATTACK_SLOT, BATTLE_WEAPON_SLOT, availableBattleWeapons, canStrikeBoss, cleanBattleLook, decodeBattleAttack, encodeBattleAttack, freshBattleAttack, withBattlePose } from './bossCombat'
import type { PlayerState } from './core'
import { bossHit, sanePlayer } from './core'

describe('실제 보스 전투', () => {
  const b = { id: 'boss1', type: 1, x: 0, z: 0, hp: 40, max: 40, t: 1000 }
  const weapons = availableBattleWeapons(), sword = weapons.find(w => w.sword)!, wand = weapons.find(w => !w.sword)!
  it('검은 근거리만, 마법봉은 원거리에서 공격한다', () => {
    expect(canStrikeBoss(b, 3, sword, 1000, 0)).toBe(true)
    expect(canStrikeBoss(b, 8, sword, 1000, 0)).toBe(false)
    expect(canStrikeBoss(b, 8, wand, 1000, 0)).toBe(true)
    expect(canStrikeBoss(b, 20, wand, 1000, 0)).toBe(false)
  })
  it('재사용 시간·쓰러진 보스·잘못된 거리는 피해를 만들지 않는다', () => {
    expect(canStrikeBoss(b, 3, wand, 1000, 900)).toBe(false)
    expect(canStrikeBoss({ ...b, hp: 0 }, 3, sword, 1000, 0)).toBe(false)
    expect(canStrikeBoss(b, NaN, wand, 1000, 0)).toBe(false)
    expect(bossHit(b, b.id, NaN)).toBeNull()
  })
  it('기존 DB 규칙의 문자열 슬롯으로 무기와 공격 포즈를 전달한다', () => {
    const attack = { bossId: 'b'.repeat(24), at: 1700000000000, sword: true, room: 'farm' as const }
    const encoded = encodeBattleAttack(attack)
    expect(encoded.length).toBeLessThanOrEqual(80)
    expect(decodeBattleAttack(encoded)).toEqual(attack)
    const look = withBattlePose({ avatar: 'ryuso', outfit: { dress: 'dress1' } }, sword.id, encoded)
    const p = sanePlayer({ name: '친구', room: 'farm', x: 0, z: 6, dir: 1, moving: false, look, t: attack.at })!
    expect(p.look.outfit[BATTLE_WEAPON_SLOT]).toBe(sword.id)
    expect(p.look.outfit[BATTLE_ATTACK_SLOT]).toBe(encoded)
    expect(cleanBattleLook(p.look)).toEqual({ avatar: 'ryuso', outfit: { dress: 'dress1' } })
  })
  it('다른 장소·다른 보스·오래된 공격 포즈는 재생하지 않는다', () => {
    const at = 1700000000000
    const p: PlayerState = { name: '친구', room: 'cafe', x: 0, z: 0, dir: 1, moving: false, t: at, look: withBattlePose({ avatar: '', outfit: {} }, wand.id, encodeBattleAttack({ bossId: 'boss1', at, sword: false, room: 'cafe' })) }
    expect(freshBattleAttack(p, 'boss1', 'cafe', at + 100)).not.toBeNull()
    expect(freshBattleAttack(p, 'boss2', 'cafe', at + 100)).toBeNull()
    expect(freshBattleAttack(p, 'boss1', 'farm', at + 100)).toBeNull()
    expect(freshBattleAttack(p, 'boss1', 'cafe', at + 5000)).toBeNull()
    expect(decodeBattleAttack('broken')).toBeNull()
  })
})
