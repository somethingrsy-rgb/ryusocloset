import { useState } from 'react'
import { useI18n } from '../i18n'
import { ROOM_ITEMS, ROOM_THEMES, isCustomRoomItem } from '../lib/room'
import { assetUrl } from '../lib/items'
import { hiddenCount, visible } from '../lib/hidden'
import { useItemsVersion } from '../lib/useItemsVersion'
import type { RoomItemDef, RoomState, RoomTab } from '../lib/roomTypes'

const TABS: { id: RoomTab; icon: string; ko: string; en: string }[] = [
  { id: 'furniture', icon: '🛋️', ko: '가구', en: 'Furniture' },
  { id: 'wall', icon: '🖼️', ko: '벽 장식', en: 'Wall' },
  { id: 'light', icon: '✨', ko: '조명', en: 'Lights' },
  { id: 'theme', icon: '🎀', ko: '테마', en: 'Themes' },
]

const CAMP_TABS: typeof TABS = [{ id: 'camp', icon: '⛺', ko: '캠핑 용품', en: 'Camp gear' }]

/** 테마 탭: 지금 고른 테마의 소품(테마를 안 골랐으면 전부). 다른 탭에는 테마 소품이 나오지 않는다 */
const inTab = (d: RoomItemDef, tab: RoomTab, themeId?: string) => {
  if (tab === 'theme') return !!d.theme && (!themeId || d.theme === themeId)
  if (d.theme) return false
  return tab === 'furniture' ? d.group === 'furniture' || d.group === 'rug' : d.group === tab
}

interface Props {
  /** 내 방(기본) 또는 캠핑 */
  scene?: 'room' | 'camp'
  room: RoomState
  onAdd: (def: RoomItemDef) => void
  /** '내 소품 추가' 버튼 (지금 보고 있는 탭을 알려준다) */
  onAddCustom: (tab: RoomTab) => void
  onRemoveCustom: (def: RoomItemDef) => void
  /** 이 탭에서 숨긴 물건 되돌리기 */
  onRestore: (defs: RoomItemDef[]) => void
  /** 테마(벽지·바닥) 고르기. undefined 는 기본 */
  onTheme?: (id: string | undefined) => void
}

export function RoomTray({ scene = 'room', room, onAdd, onAddCustom, onRemoveCustom, onRestore, onTheme }: Props) {
  useItemsVersion()
  const { lang, t } = useI18n()
  const tabs = scene === 'camp' ? CAMP_TABS : TABS
  const [tab, setTab] = useState<RoomTab>(tabs[0].id)
  const inThisTab = ROOM_ITEMS.filter((d) => inTab(d, tab, room.themeId))
  const items = visible(inThisTab)
  const nHidden = hiddenCount(inThisTab.map((d) => d.id))
  const count = (id: string) => room.items.filter((p) => p.itemId === id).length
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" className="flex shrink-0 gap-1 px-2 pt-2 pb-1">
        {tabs.map((tb) => {
          const active = tb.id === tab
          return (
            <button
              key={tb.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.id)}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center rounded-2xl px-1 text-2xl transition ${
                active ? 'bg-blush text-white shadow' : 'bg-petal/70 hover:bg-petal'
              }`}
            >
              <span aria-hidden>{tb.icon}</span>
              <span className={`text-[10px] leading-tight font-semibold ${active ? 'text-white' : 'text-cocoa-soft'}`}>{tb[lang]}</span>
            </button>
          )
        })}
      </div>
      {tab === 'theme' && scene === 'room' && (
        <div className="scroll-thin flex shrink-0 gap-1.5 overflow-x-auto px-2 pb-1">
          {[{ id: undefined as string | undefined, icon: '🏠', ko: '기본', en: 'Default' }, ...ROOM_THEMES].map((th) => {
            const on = (room.themeId ?? undefined) === th.id
            return (
              <button
                key={th.id ?? 'default'}
                aria-pressed={on}
                onClick={() => onTheme?.(th.id)}
                className={`flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-bold whitespace-nowrap ring-2 transition ${
                  on ? 'bg-blush text-white ring-blush' : 'bg-white text-cocoa-soft ring-petal'
                }`}
              >
                <span aria-hidden>{th.icon}</span>
                {th[lang]}
              </button>
            )
          })}
        </div>
      )}
      <div role="tabpanel" className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <ul className="grid grid-cols-4 gap-2">
          <li>
            <button
              onClick={() => onAddCustom(tab)}
              aria-label={t('addProp')}
              title={t('addProp')}
              className="flex aspect-square w-full flex-col items-center justify-center rounded-2xl bg-petal/60 text-blush-deep ring-2 ring-dashed ring-blush/60 transition active:scale-95"
            >
              <span aria-hidden className="text-3xl leading-none font-bold">+</span>
              <span className="mt-0.5 text-[10px] leading-tight font-semibold">{t('addProp')}</span>
            </button>
          </li>
          {items.map((d) => {
            const n = count(d.id)
            return (
              <li key={d.id} className="relative">
                <button
                  onClick={() => onAdd(d)}
                  aria-label={d.name[lang]}
                  title={d.name[lang]}
                  className="relative flex aspect-square w-full items-center justify-center rounded-2xl bg-white p-1 ring-2 ring-petal transition hover:ring-blush/50 active:scale-95"
                >
                  <img src={assetUrl(d.thumb)} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain" />
                  {n > 0 && (
                    <span className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blush px-1 text-[11px] font-bold text-white">
                      {n}
                    </span>
                  )}
                </button>
                {(
                  <button
                    aria-label={`${t('removeItem')}: ${d.name[lang]}`}
                    title={t('removeItem')}
                    onClick={() => window.confirm(t(isCustomRoomItem(d) ? 'removeItemConfirm' : 'hideItemConfirm')) && onRemoveCustom(d)}
                    className="absolute -top-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs text-cocoa-soft shadow ring-1 ring-black/10"
                  >
                    ✕
                  </button>
                )}
                <p className="mt-0.5 truncate text-center text-[10px] font-semibold text-cocoa-soft">{d.name[lang]}</p>
              </li>
            )
          })}
        </ul>
        {nHidden > 0 && (
          <button
            onClick={() => onRestore(inThisTab)}
            className="mt-3 min-h-11 w-full rounded-full bg-petal/70 px-4 text-sm font-semibold text-cocoa-soft"
          >
            ↩ {t('restoreHidden', { n: nHidden })}
          </button>
        )}
      </div>
    </div>
  )
}
