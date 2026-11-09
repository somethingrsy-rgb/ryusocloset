/** 🪄 마법 상점(산책·농장·카페가 같이 쓴다): 가진 마법봉·검은 눌러서 고르고, 🔒 는 코인으로 산다 */
import { useState, useSyncExternalStore } from 'react'
import { actFarm, getFarm, subscribeFarm } from '../lib/farm'
import { assetUrl } from '../lib/items'
import { playServe, playTap } from '../lib/sound'
import { WANDS, WEAPON_BY_ID, addOwned, getOwned, getWeapon, setWeapon, subscribeWeapons } from '../lib/weapons'
import { CoinIcon } from './Icons'

export function WeaponShop({ onClose }: { onClose: () => void }) {
  const farm = useSyncExternalStore(subscribeFarm, getFarm)
  useSyncExternalStore(subscribeWeapons, getOwned)
  const owned = getOwned(), wand = getWeapon()
  const [buying, setBuying] = useState<string | null>(null)
  const buy = (id: string) => {
    const wp = WEAPON_BY_ID[id]
    if (!wp || owned.has(id)) return
    if (actFarm({ type: 'spend', amount: wp.price }) !== 'saved') return
    addOwned(id); setWeapon(id); playServe(); onClose()
  }
  return (
    <div role="dialog" aria-label="마법봉 고르기" className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-3" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="flex max-h-full w-full max-w-md flex-col rounded-3xl bg-[#fff8fb] p-4 shadow-2xl">
        <p className="mt-0 mb-1 text-center text-base font-black text-[#7a3d8f]">🪄 마법 상점</p>
        <p className="mt-0 mb-2 text-center text-xs font-bold text-black/50">가진 것은 눌러서 고르고, 🔒 는 코인으로 사요 · <CoinIcon /> {farm.coins}</p>
        <div className="grid min-h-0 grid-cols-4 gap-2 overflow-y-auto">
          {WANDS.map((it) => {
            const have = owned.has(it.id)
            return (
              <button key={it.id} aria-label={`${it.name}${have ? '' : ` (${it.price}코인)`}`} aria-pressed={wand === it.id} onClick={() => { playTap(); if (have) { setWeapon(it.id); onClose() } else setBuying(it.id) }}
                className={`relative flex flex-col items-center rounded-2xl p-1 ${wand === it.id ? 'bg-[#ffe1ea] ring-2 ring-[#ff8fab]' : 'bg-white'}`}>
                <img src={assetUrl(it.img)} alt="" className={`aspect-square w-full object-contain ${have ? '' : 'opacity-50'}`} />
                <span className="text-[10px] font-extrabold text-[#7a3d8f]">{it.fx} 💖×{it.power}</span>
                {!have && <span className="absolute top-1 right-1 rounded-full bg-white/90 px-1 text-[10px] font-black">🔒{it.price}</span>}
              </button>
            )
          })}
        </div>
        {buying && (() => {
          const it = WEAPON_BY_ID[buying]
          return (
            <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white p-2 shadow">
              <img src={assetUrl(it.img)} alt="" className="h-12 w-12 object-contain" />
              <p className="m-0 flex-1 text-xs leading-snug font-bold text-[#6b4b52]">{it.name}<br />{it.fx} {it.skill} · 한 번에 💖 {it.power}칸</p>
              <button disabled={farm.coins < it.price} onClick={() => buy(it.id)} className="min-h-10 rounded-full bg-[#ff8fab] px-3 text-sm font-black text-white disabled:opacity-40">{it.price} <CoinIcon /> 사기</button>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
