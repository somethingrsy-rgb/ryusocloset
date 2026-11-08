import { ITEMS } from '../items'
import type { Boss, Look, PlayerState, Room } from './core'

export const BOSS_MONSTERS = ['dino', 'blob', 'fluff', 'bat', 'goblin', 'bunny', 'penguin', 'lion', 'sheep', 'sprout', 'puppy', 'owl', 'hedgehog', 'jelly', 'mushroom', 'fox', 'polar', 'dragon', 'lotus', 'golem', 'angel', 'peach', 'otter', 'unicorn', 'pudding']
export type BossRoom = Extract<Room, 'cafe' | 'farm'>
export interface BattleWeapon { id: string; name: string; img: string; sword: boolean; aspect: number; power: number; range: number; cooldown: number }
const swords: BattleWeapon[] = ['blue', 'green', 'red', 'aqua', 'violet'].map((color, i) => ({ id: `sword_${color}`, name: `${['파랑','초록','빨강','하늘빛','보라'][i]} 별 검`, img: `travel/sword/${color}.webp`, sword: true, aspect: 0.85, power: i ? 3 : 1, range: 4.3, cooldown: 650 }))
const wands: BattleWeapon[] = ITEMS.filter(i => i.category === 'wand').map((i, index) => ({ id: i.id, name: i.name.ko, img: i.thumb, sword: false, aspect: 1, power: index ? 2 : 1, range: 12, cooldown: 500 }))
export const BATTLE_WEAPONS = [...wands, ...swords]
export const battleWeapon = (id: string) => BATTLE_WEAPONS.find(w => w.id === id) ?? wands[0] ?? swords[0]
export function availableBattleWeapons(): BattleWeapon[] {
  let owned: string[] = []
  try { const value: unknown = JSON.parse(localStorage.getItem('ryuso.walk.weapons') ?? '[]'); if (Array.isArray(value)) owned = value.filter((id): id is string => typeof id === 'string') } catch { /* 기본 무기 */ }
  return BATTLE_WEAPONS.filter(w => w === wands[0] || w === swords[0] || owned.includes(w.id))
}
/** 같은 보스의 체력은 공유하고 장소별 지도에서는 안전한 고정 전투 자리에 나타낸다. */
export const BOSS_ARENAS: Record<BossRoom, { x: number; z: number }> = { cafe: { x: 4, z: -2 }, farm: { x: 0, z: 3 } }
export function canStrikeBoss(boss: Boss | null, distance: number, weapon: BattleWeapon, now: number, lastAttack: number) {
  return !!boss && boss.hp > 0 && Number.isFinite(distance) && distance <= weapon.range && now - lastAttack >= weapon.cooldown
}

// 기존 Firebase look.outfit 문자열 슬롯으로 전송하는 일시적 손 무기/공격 포즈.
// 의상 렌더링 전에는 제거하며, 기존 DB 규칙(슬롯당 80자) 그대로 사용할 수 있다.
export const BATTLE_WEAPON_SLOT = '__bossWeapon'
export const BATTLE_ATTACK_SLOT = '__bossAttack'
export interface BattleAttack { bossId: string; at: number; sword: boolean; room: BossRoom }
export function encodeBattleAttack(a: BattleAttack) { return `${a.bossId}|${a.at.toString(36)}|${a.sword ? 's' : 'w'}|${a.room}` }
export function decodeBattleAttack(value: unknown): BattleAttack | null {
  if (typeof value !== 'string' || value.length > 80) return null
  const parts = value.split('|')
  if (parts.length !== 4) return null
  const [bossId, stamp, kind, room] = parts, at = parseInt(stamp, 36)
  if (!bossId || bossId.length > 24 || !/^[a-z0-9]+$/.test(stamp) || !Number.isSafeInteger(at) || at <= 0 || !['s', 'w'].includes(kind) || (room !== 'farm' && room !== 'cafe')) return null
  return { bossId, at, sword: kind === 's', room }
}
export function cleanBattleLook(look: Look): Look {
  return { ...look, outfit: Object.fromEntries(Object.entries(look.outfit).filter(([key]) => key !== BATTLE_WEAPON_SLOT && key !== BATTLE_ATTACK_SLOT)) }
}
export function withBattlePose(look: Look, weapon: string | null, attack: string | null): Look {
  return { ...cleanBattleLook(look), outfit: { ...cleanBattleLook(look).outfit, ...(weapon ? { [BATTLE_WEAPON_SLOT]: weapon } : {}), ...(attack ? { [BATTLE_ATTACK_SLOT]: attack } : {}) } }
}
export function freshBattleAttack(p: PlayerState, bossId: string, room: BossRoom, now: number) {
  const a = decodeBattleAttack(p.look.outfit[BATTLE_ATTACK_SLOT])
  return a && a.bossId === bossId && a.room === room && p.room === room && now >= a.at - 250 && now - a.at < 2000 ? a : null
}
