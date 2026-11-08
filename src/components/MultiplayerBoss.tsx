import { useState, useSyncExternalStore } from 'react'
import { assetUrl } from '../lib/items'
import type { BossBattle } from './bossBattle3d'

/** 보스 본체는 3D 장면에 있고 여기는 무기 선택·사거리·공격 조작만 표시한다. */
export function MultiplayerBoss({ battle }: { battle: BossBattle | null }) {
  return battle ? <BossControls battle={battle} /> : null
}
function BossControls({ battle }: { battle: BossBattle }) {
  const state = useSyncExternalStore(battle.subscribe, battle.getSnapshot)
  const [picking, setPicking] = useState(false)
  if (!state.visible) return null
  return <>
    <div className="pointer-events-none absolute top-16 left-2 z-20 w-[min(17rem,calc(100%-1rem))] rounded-2xl bg-white/90 px-3 py-2 shadow-md">
      <p className="m-0 text-sm font-black text-[#7a3d8f]">{state.hp > 0 ? '👑 대형 몬스터 · 함께 싸워요!' : '🎉 함께 물리쳤어요!'}</p>
      <div role="progressbar" aria-label="대형 몬스터 체력" aria-valuenow={state.hp} aria-valuemin={0} aria-valuemax={state.max} className="my-1 h-2 overflow-hidden rounded-full bg-[#ead9ee]"><div className="h-full rounded-full bg-[#ff8fab] transition-all" style={{ width: `${state.hp / state.max * 100}%` }} /></div>
      <p role="status" className="m-0 text-[11px] font-bold text-[#6b4b52]">{state.hp > 0 ? `${state.hp}/${state.max} · ${state.inRange ? '공격할 수 있어요' : `${state.distance}걸음 거리`}` : '잠시 후 새로운 몬스터가 나타나요'}</p>
    </div>
    {state.hp > 0 && <div className="boss-combat-controls absolute right-2 bottom-20 z-30 flex max-w-[calc(100%-1rem)] flex-col items-end gap-2">
      {state.note && <p role="status" className="m-0 rounded-full bg-white/95 px-3 py-2 text-xs font-bold text-[#7a3d8f]">{state.note}</p>}
      <button onClick={() => setPicking(v => !v)} aria-label="전투 무기 고르기" aria-expanded={picking} className="flex min-h-12 items-center gap-2 rounded-2xl border-2 border-[#e5cfa3] bg-[#fff9e8] px-3 text-xs font-black text-[#7a3d8f] shadow-lg">
        <img src={assetUrl(state.weapon.img)} alt="" className="h-10 w-10 object-contain" />{state.weapon.name}
      </button>
      {!state.inRange && <button onClick={battle.approach} className="min-h-12 rounded-full bg-white/95 px-5 text-sm font-black text-[#7a3d8f] shadow-lg">보스에게 가기 →</button>}
      <button aria-label="멀티 보스 공격" disabled={state.cooling || !state.inRange} onClick={battle.attack} className="min-h-14 rounded-full bg-gradient-to-r from-[#ad76e8] to-[#f580a6] px-7 text-lg font-black text-white shadow-lg active:scale-95 disabled:opacity-50">{state.weapon.sword ? '⚔️ 검 휘두르기' : '🪄 마법 발사'}{state.cooling ? ' · 준비 중' : ''}</button>
    </div>}
    {picking && <div role="dialog" aria-modal="true" aria-label="전투 무기 선택" className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={e => { if (e.target === e.currentTarget) setPicking(false) }}>
      <div className="max-h-[80%] w-full max-w-sm overflow-y-auto rounded-3xl bg-[#fff9f0] p-4 shadow-xl">
        <h2 className="mt-0 text-center text-base font-black text-[#7a3d8f]">🪄 마법봉 · ⚔️ 검</h2>
        <p className="text-xs text-[#6b4b52]">마법봉은 멀리서 발사하고, 검은 가까이서 휘둘러요.</p>
        <div className="grid grid-cols-3 gap-2">{battle.weapons.map(weapon => <button key={weapon.id} aria-label={weapon.name} aria-pressed={state.weapon.id === weapon.id} onClick={() => { battle.equip(weapon.id); setPicking(false) }} className={`flex min-h-24 flex-col items-center justify-center rounded-2xl p-2 text-center text-[11px] font-bold text-[#7a3d8f] ${state.weapon.id === weapon.id ? 'bg-[#ffe1ea] ring-2 ring-[#ff8fab]' : 'bg-white'}`}><img src={assetUrl(weapon.img)} alt="" className="h-12 w-12 object-contain" />{weapon.name}<span className="text-[10px]">힘 {weapon.power} · 거리 {weapon.range}</span></button>)}</div>
        <button onClick={() => setPicking(false)} className="mt-3 min-h-11 w-full rounded-full bg-white text-sm font-bold text-[#7a3d8f]">닫기</button>
      </div>
    </div>}
  </>
}
