import { useState, useSyncExternalStore } from 'react'
import { CATEGORY_LABEL } from '../i18n'
import { avatarName, type Avatar } from '../lib/avatars'
import { gameVersion, isLocked, subscribeGame } from '../lib/game'
import { visible } from '../lib/hidden'
import { ITEMS_BY_CATEGORY, assetUrl } from '../lib/items'
import type { Category } from '../lib/layers'
import { toggleItem } from '../lib/outfit'
import { playTap } from '../lib/sound'
import type { Outfit } from '../lib/types'
import { useItemsVersion } from '../lib/useItemsVersion'
import { FigureLayers } from './FigureLayers'

/** 코디 탭과 같은 순서 */
const TABS: Category[] = ['costume', 'accessory', 'shoes', 'wig', 'wand', 'dress', 'top', 'bottom', 'outer', 'bag']

/**
 * 파티에 초대할 아바타 친구의 옷 고르기: 코디 탭처럼 카테고리를 골라 옷·머리·액세서리를 입히고 미리 본다.
 * 코디 탭에서 입을 수 있는 옷(잠기지 않고 숨기지 않은 옷)만 고를 수 있다.
 */
export function GuestDresser({ avatar, initial, invited, onDone, onUninvite, onBack }: {
  avatar: Avatar; initial: Outfit; invited: boolean
  onDone: (outfit: Outfit) => void
  /** 이미 고른 친구를 초대 목록에서 뺀다 */
  onUninvite: () => void
  onBack: () => void
}) {
  useItemsVersion()
  useSyncExternalStore(subscribeGame, gameVersion)
  const [outfit, setOutfit] = useState<Outfit>(initial)
  const [cat, setCat] = useState<Category>('costume')
  const items = visible(ITEMS_BY_CATEGORY[cat]).filter((it) => !isLocked(it))
  const labels = CATEGORY_LABEL.ko
  const name = avatarName(avatar)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between">
        <button aria-label="뒤로" onClick={() => { playTap(); onBack() }} className="h-9 rounded-full bg-white px-3 text-sm font-bold text-[#8a4b55] shadow-sm">← 뒤로</button>
        <p className="m-0 text-base font-black text-[#8a4b55]">👗 {name} 옷 입히기</p>
        <span className="w-14" />
      </div>
      <div className="mt-2 flex min-h-0 flex-1 gap-2">
        {/* 미리 보기 */}
        <div className="relative w-[34%] flex-none self-start overflow-hidden rounded-2xl bg-gradient-to-b from-[#fde7f0] to-[#f3e6ff]" style={{ aspectRatio: '1024 / 1536' }}>
          <FigureLayers outfit={outfit} avatar={avatar} animate={false} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div role="tablist" aria-label="옷 종류" className="flex shrink-0 flex-wrap gap-1 pb-1.5">
            {TABS.map((c) => (
              <button key={c} role="tab" aria-selected={c === cat} aria-label={labels[c]} title={labels[c]} onClick={() => { playTap(); setCat(c) }}
                className={`relative flex h-10 w-10 flex-none items-center justify-center rounded-xl ${c === cat ? 'bg-[#ff8fab] shadow' : 'bg-white ring-1 ring-black/5'}`}>
                <img src={assetUrl(`assets/closet-tabs/${c}.webp`)} alt="" draggable={false} className="h-8 w-8 object-contain" />
                {outfit[c] && <span aria-hidden className={`absolute top-0.5 right-0.5 h-2 w-2 rounded-full ${c === cat ? 'bg-white' : 'bg-[#ff8fab]'}`} />}
              </button>
            ))}
          </div>
          <ul className="scroll-thin m-0 grid min-h-0 flex-1 list-none grid-cols-3 content-start gap-1.5 overflow-y-auto p-0.5">
            {!items.length && <li className="col-span-3 py-6 text-center text-xs text-black/45">아직 입을 수 있는 옷이 없어요</li>}
            {items.map((it) => {
              const worn = outfit[it.category] === it.id
              return (
                <li key={it.id}>
                  <button aria-pressed={worn} aria-label={it.name.ko} title={it.name.ko} onClick={() => { playTap(); setOutfit((o) => toggleItem(o, it)) }}
                    className={`relative flex aspect-square w-full items-center justify-center rounded-xl bg-white p-1 ring-2 active:scale-95 ${worn ? 'ring-[#ff8fab]' : 'ring-black/5'}`}>
                    <img src={assetUrl(it.thumb)} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain" />
                    {worn && <span aria-hidden className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ff8fab] text-[10px] text-white">✓</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {invited
          ? <button onClick={() => { playTap(); onUninvite() }} className="min-h-11 flex-1 rounded-full bg-white font-bold text-[#8a4b55] shadow-sm">초대 안 하기</button>
          : <button onClick={() => { playTap(); setOutfit({}) }} className="min-h-11 flex-1 rounded-full bg-white font-bold text-[#8a4b55] shadow-sm">모두 벗기</button>}
        <button onClick={() => { playTap(); onDone(outfit) }} className="min-h-11 flex-[1.4] rounded-full bg-[#ff8fab] font-bold text-white shadow">✓ 이 옷으로 초대</button>
      </div>
    </div>
  )
}
