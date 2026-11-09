/**
 * 같이 사냥 대왕 몬스터 화면 글(3D 농장·카페): 「대왕 몬스터 출현!」 단추, 싸우는 동안 진행 막대·✨ 마법!, 다 풀면 고마워 창.
 * 3D 장면 쪽은 bossHunt3d 의 attachBoss 가 맡는다.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { WEAPON_BY_ID, getWeapon, subscribeWeapons } from '../lib/weapons'
import { WeaponShop } from './WeaponShop'
import { assetUrl } from '../lib/items'
import { MONSTERS, loadDex, subscribeDex } from '../lib/monsters'
import { getMp, subscribeMp } from '../lib/mp/session'
import { playTap } from '../lib/sound'
import type { BossDone, BossUi } from './bossHunt3d'
import { HUD_BUSY } from './MultiplayerBar'

const dexCount = () => loadDex().length

export function BossHud({ ui, done, onGo, onZap, onRest, onCloseDone }: { ui: BossUi | null; done: BossDone | null; onGo: () => void; onZap: () => void; onRest: () => void; onCloseDone: () => void }) {
  const on = useSyncExternalStore(subscribeMp, () => getMp().status) === 'on'
  const dex = useSyncExternalStore(subscribeDex, dexCount)
  // 싸우기 시작하면 같이 놀기 말하는 줄을 닫는다(아래 단추를 가리지 않게)
  const fight = !!ui?.fight
  // 마법봉·검 고르기(산책과 같은 마법 상점, 고른 것은 세 곳이 같이 쓴다)
  const wand = useSyncExternalStore(subscribeWeapons, () => getWeapon())
  const [shop, setShop] = useState(false)
  const wi = WEAPON_BY_ID[wand]
  useEffect(() => { if (fight) window.dispatchEvent(new Event(HUD_BUSY)) }, [fight])
  return (
    <>
      {on && ui && (() => {
        const m = MONSTERS[ui.type], pct = Math.round((1 - ui.hp / ui.max) * 100)
        return ui.away ? (
          <p role="status" className="absolute top-14 right-2 z-20 m-0 rounded-2xl bg-white/95 px-2.5 py-1.5 text-xs font-extrabold whitespace-nowrap text-[#7a3d8f] shadow">👑 대왕 몬스터는 지금 {ui.away === 'walk' ? '🌳 산책' : ui.away === 'farm' ? '🌱 농장' : '☕ 카페'}에 있어요<br /><span className="text-[#c0587a]">친구 목록에서 그곳으로 가요</span></p>
        ) : ui.fight ? (
          <>
            <div role="status" className="absolute inset-x-2 top-14 z-20 mx-auto w-72 max-w-full rounded-2xl bg-white/95 px-3 py-2 text-center shadow [@media(max-height:500px)]:top-2 [@media(max-height:500px)]:w-52 [@media(max-height:500px)]:rounded-full [@media(max-height:500px)]:bg-white/85 [@media(max-height:500px)]:px-2.5 [@media(max-height:500px)]:py-1">
              <p className="m-0 text-sm font-extrabold text-[#7a3d8f] [@media(max-height:500px)]:text-[11px] [@media(max-height:500px)]:leading-tight">👑 대왕 {m.name}<span className="[@media(max-height:500px)]:hidden"> · 다 같이 마법 풀기!</span></p>
              <div aria-label={`마법 풀기 ${pct}%`} className="mt-1 h-3 overflow-hidden rounded-full bg-[#f3dbe6] [@media(max-height:500px)]:mt-0.5 [@media(max-height:500px)]:h-1.5"><div className="h-full rounded-full bg-gradient-to-r from-[#c58bff] to-[#ff8fab] transition-all" style={{ width: `${pct}%` }} /></div>
              <p className="m-0 mt-1 text-xs font-bold text-[#c0587a] [@media(max-height:500px)]:hidden">{ui.friends.length ? `🤝 ${ui.friends.join(', ')}와(과) 같이 싸우는 중` : '🐾 친구를 불러서 같이 풀어요!'}</p>
            </div>
            <div className="absolute inset-x-2 bottom-3 z-30 mx-auto flex w-fit max-w-full items-center gap-2 rounded-3xl bg-white/95 p-3 shadow-xl [@media(max-height:500px)]:inset-x-auto [@media(max-height:500px)]:right-2 [@media(max-height:500px)]:bottom-2 [@media(max-height:500px)]:mx-0 [@media(max-height:500px)]:flex-col [@media(max-height:500px)]:gap-1.5 [@media(max-height:500px)]:bg-white/70 [@media(max-height:500px)]:p-1.5">
              <button aria-label="마법봉 고르기" onClick={() => { playTap(); setShop(true) }} className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#e5cfa3] bg-[#fdf2d8] [@media(max-height:500px)]:h-10 [@media(max-height:500px)]:w-10">
                {wi ? <img src={assetUrl(wi.img)} alt="" className="h-11 w-11 object-contain [@media(max-height:500px)]:h-8 [@media(max-height:500px)]:w-8" /> : '🪄'}
              </button>
              <button aria-label="마법!" onClick={onZap} className="h-14 rounded-full bg-gradient-to-r from-[#c58bff] to-[#ff8fab] px-6 text-lg font-black text-white shadow-lg active:scale-95 [@media(max-height:500px)]:h-14 [@media(max-height:500px)]:w-14 [@media(max-height:500px)]:px-0 [@media(max-height:500px)]:text-2xl">✨<span className="[@media(max-height:500px)]:hidden"> 마법!</span></button>
              <button aria-label="잠깐 쉬기" onClick={() => { playTap(); onRest() }} className="h-10 rounded-full bg-[#ffe4ec] px-3 text-sm font-bold [@media(max-height:500px)]:h-8 [@media(max-height:500px)]:px-2 [@media(max-height:500px)]:text-xs"><span className="[@media(max-height:500px)]:hidden">잠깐 </span>쉬기</button>
            </div>
          </>
        ) : (
          <button onClick={() => { playTap(); onGo() }} className="absolute top-14 right-2 z-20 flex items-center gap-1.5 rounded-2xl bg-white/95 px-2 py-1.5 text-left text-xs font-extrabold whitespace-nowrap text-[#7a3d8f] shadow">
            <img src={assetUrl(`travel/monster/${m.id}_angry.webp`)} alt="" className="h-9 w-9 shrink-0 object-contain" />
            <span>👑 대왕 몬스터 출현!{pct ? ` ${pct}%` : ''}<br /><span className="text-[#c0587a]">눌러서 가기 · {ui.far}걸음</span></span>
          </button>
        )
      })()}
      {shop && <WeaponShop onClose={() => setShop(false)} />}
      {done && (() => {
        const m = MONSTERS[done.type]
        return (
          <div role="dialog" aria-label="다 같이 마법을 풀었어요" className="absolute inset-x-2 bottom-3 z-30 mx-auto flex max-w-md items-center gap-3 rounded-3xl bg-white/95 p-3 shadow-xl">
            <img src={assetUrl(`travel/monster/${m.id}_happy.webp`)} alt="" className="h-16 w-16 shrink-0 object-contain" />
            <p className="m-0 flex-1 text-sm leading-snug font-bold text-[#6b4b52]">🎉 다 같이 대왕 {m.name}의 마법을 풀었어요!<br />{done.friends.length ? `🤝 ${done.friends.join(', ')} 고마워! · ` : ''}+30 코인<br /><span className="text-xs font-black text-[#7a3d8f]">{done.isNew ? '📖 도감에 새로 들어왔어요!' : '📖 도감에 이미 있는 친구예요'} ({dex}/{MONSTERS.length})</span></p>
            <button onClick={() => { playTap(); onCloseDone() }} className="min-h-11 shrink-0 rounded-full bg-[#ff8fab] px-4 text-sm font-bold text-white shadow">좋아요</button>
          </div>
        )
      })()}
    </>
  )
}
