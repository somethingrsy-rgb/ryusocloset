import { useEffect, useSyncExternalStore } from 'react'
import { BOSS_MAX, bossCanRespawn } from '../lib/mp/core'
import { getMp, hitBoss, serverNow, spawnBoss, subscribeMp } from '../lib/mp/session'
import { assetUrl } from '../lib/items'
import { playTap } from '../lib/sound'

const monsters = ['dino', 'blob', 'fluff', 'bat', 'goblin', 'bunny', 'penguin', 'lion', 'sheep', 'sprout', 'puppy', 'owl', 'hedgehog', 'jelly', 'mushroom', 'fox', 'polar', 'dragon', 'lotus', 'golem', 'angel', 'peach', 'otter', 'unicorn', 'pudding']

/** Cafe and farm share the same multiplayer-only boss and hit points. */
export function MultiplayerBoss() {
  const mp = useSyncExternalStore(subscribeMp, getMp)
  useEffect(() => {
    if (mp.status !== 'on') return
    const trySpawn = () => {
      const current = getMp().boss
      if (getMp().status === 'on' && bossCanRespawn(current, serverNow())) spawnBoss({ id: Math.random().toString(36).slice(2, 10), type: Math.floor(Math.random() * monsters.length), x: 0, z: 0, hp: BOSS_MAX, max: BOSS_MAX })
    }
    trySpawn()
    const timer = window.setInterval(trySpawn, 3000)
    return () => window.clearInterval(timer)
  }, [mp.status])

  if (mp.status !== 'on' || !mp.boss) return null
  const boss = mp.boss
  const name = monsters[boss.type] ?? monsters[0]
  const remaining = Math.round((boss.hp / boss.max) * 100)
  return <div className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-2">
    <div className="pointer-events-auto flex w-[min(22rem,100%)] items-center gap-2 rounded-2xl border-2 border-[#cdbcf0] bg-white/95 p-2 shadow-lg">
      <img src={assetUrl(`travel/monster/${name}_${boss.hp ? 'angry' : 'happy'}.webp`)} alt="" className="h-14 w-14 shrink-0 object-contain" />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-black text-[#7a3d8f]">{boss.hp ? '👑 멀티 보스 출현!' : '🎉 함께 무찔렀어요!'}</p>
        <div className="my-1 h-2 overflow-hidden rounded-full bg-[#f2e8f6]"><div className="h-full rounded-full bg-[#ff8fab]" style={{ width: `${remaining}%` }} /></div>
        <p className="m-0 text-xs font-bold text-[#6b4b52]">{boss.hp ? `남은 힘 ${boss.hp}/${boss.max} · 함께 공격해요` : '잠시 후 다음 보스가 나타나요'}</p>
      </div>
      {boss.hp > 0 && <button aria-label="멀티 보스 공격" onClick={() => { playTap(); hitBoss(boss.id, 1) }} className="min-h-11 shrink-0 rounded-full bg-[#7a3d8f] px-3 text-sm font-black text-white">✨ 공격</button>}
    </div>
  </div>
}
