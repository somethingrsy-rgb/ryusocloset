import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import {
  PLACES,
  PLACE_BY_ID,
  currentAssignment,
  findItem,
  gameVersion,
  getGame,
  isFound,
  spotFor,
  subscribeGame,
  travelTo,
} from '../lib/game'
import { ITEM_BY_ID, assetUrl } from '../lib/items'
import { playSnap } from '../lib/sound'
import { useItemsVersion } from '../lib/useItemsVersion'
import type { Outfit, Tweaks } from '../lib/types'
import { FigureLayers } from './FigureLayers'

export const useGame = () => {
  useSyncExternalStore(subscribeGame, gameVersion)
  return getGame()
}

const TEXT = {
  ko: {
    map: '지도',
    found: '찾음',
    hint: '반짝이는 곳을 눌러 숨은 아이템을 찾아보세요!',
    mapHint: '가고 싶은 곳을 눌러 여행을 떠나요',
    got: '찾았다!',
    wear: '옷장에서 입어보기',
    keep: '계속 찾기',
    done: '이 곳의 아이템을 모두 찾았어요 ⭐',
    walking: '이동 중…',
  },
  en: {
    map: 'Map',
    found: 'Found',
    hint: 'Tap the sparkles to find hidden items!',
    mapHint: 'Tap a place to start your trip',
    got: 'Found it!',
    wear: 'Try it on',
    keep: 'Keep looking',
    done: 'You found everything here ⭐',
    walking: 'Travelling…',
  },
}

interface Props {
  outfit: Outfit
  tweaks: Tweaks
  /** 찾은 아이템을 옷장에서 입어보러 간다 */
  onWear: (id: string) => void
}

export function TravelGame({ outfit, tweaks, onWear }: Props) {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  const game = useGame()
  const ver = useItemsVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assign = useMemo(currentAssignment, [ver])
  const [scene, setScene] = useState<string | null>(null)
  const [walking, setWalking] = useState(false)
  const [popup, setPopup] = useState<string | null>(null)
  const timer = useRef<number>(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const place = (id: string) => PLACE_BY_ID[id]
  const progress = (id: string) => {
    const ids = assign[id] ?? []
    return { total: ids.length, got: ids.filter(isFound).length }
  }

  const go = (id: string) => {
    if (walking) return
    setWalking(true)
    travelTo(id)
    timer.current = window.setTimeout(() => {
      setWalking(false)
      setScene(id)
    }, 900)
  }

  const here = place(game.at)

  if (scene) {
    const p = place(scene)
    const ids = assign[scene] ?? []
    const pr = progress(scene)
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden rounded-3xl bg-white/60 shadow-inner ring-1 ring-black/5">
        <div className="relative h-full max-w-full" style={{ aspectRatio: '1086 / 1448' }}>
          <img src={assetUrl(p.wall)} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
          <img
            src={assetUrl(p.floor)}
            alt=""
            className="absolute inset-x-0 bottom-0 w-full"
            style={{ height: `${(p.floorH / 1448) * 100}%` }}
            draggable={false}
          />
          <div className="absolute bottom-[4%] left-[3%] w-[34%]" style={{ aspectRatio: '1024 / 1536' }}>
            <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
          </div>
          {ids.map((id, i) => {
            if (isFound(id)) return null
            const s = spotFor(id, i)
            return (
              <button
                key={id}
                aria-label={tx.hint}
                onClick={() => {
                  if (findItem(id)) {
                    playSnap()
                    setPopup(id)
                  }
                }}
                className="sparkle absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-2xl"
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
              >
                <span aria-hidden>✨</span>
              </button>
            )
          })}
        </div>
        <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
          <button
            onClick={() => setScene(null)}
            className="flex h-12 items-center gap-1 rounded-full bg-white/90 px-4 text-sm font-bold shadow-md ring-1 ring-black/5"
          >
            <span aria-hidden>🗺️</span>
            {tx.map}
          </button>
          <span className="rounded-full bg-white/90 px-3 py-2 text-sm font-bold shadow-md ring-1 ring-black/5">
            {p.icon} {lang === 'ko' ? p.ko : p.en} · {tx.found} {pr.got}/{pr.total}
          </span>
        </div>
        <p className="pointer-events-none absolute inset-x-0 bottom-2 z-10 text-center text-xs font-bold text-white drop-shadow">
          {pr.got === pr.total ? tx.done : tx.hint}
        </p>
        {popup && ITEM_BY_ID[popup] && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-6" onClick={() => setPopup(null)}>
            <div className="w-64 rounded-3xl bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-lg font-extrabold text-blush-deep">🎉 {tx.got}</p>
              <img src={assetUrl(ITEM_BY_ID[popup].thumb)} alt="" className="mx-auto my-3 h-32 w-32 object-contain" />
              <p className="mb-3 font-bold">{ITEM_BY_ID[popup].name[lang]}</p>
              <div className="flex flex-col gap-2">
                <button
                  className="h-11 rounded-full bg-blush font-bold text-white"
                  onClick={() => {
                    const id = popup
                    setPopup(null)
                    onWear(id)
                  }}
                >
                  {tx.wear}
                </button>
                <button className="h-11 rounded-full bg-petal font-bold" onClick={() => setPopup(null)}>
                  {tx.keep}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-hidden rounded-3xl bg-gradient-to-b from-sky-100 via-emerald-50 to-amber-50 shadow-inner ring-1 ring-black/5">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <polyline
          points={PLACES.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#e9a7b8"
          strokeWidth="1.2"
          strokeDasharray="2.5 2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: 3 }}
        />
      </svg>
      <p className="absolute inset-x-0 top-2 z-10 text-center text-sm font-bold text-cocoa-soft">{walking ? tx.walking : tx.mapHint}</p>
      {PLACES.map((p) => {
        const pr = progress(p.id)
        const complete = pr.total > 0 && pr.got === pr.total
        return (
          <button
            key={p.id}
            onClick={() => go(p.id)}
            disabled={walking}
            className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center transition active:scale-90"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span className={`flex h-14 w-14 items-center justify-center rounded-full text-3xl shadow-md ring-2 ${complete ? 'bg-amber-100 ring-amber-400' : 'bg-white ring-blush/50'}`}>
              {p.icon}
            </span>
            <span className="mt-0.5 rounded-full bg-white/90 px-2 text-[11px] leading-5 font-bold whitespace-nowrap shadow-sm">
              {lang === 'ko' ? p.ko : p.en} {pr.got}/{pr.total}
            </span>
          </button>
        )
      })}
      <div
        className="pointer-events-none absolute z-10 w-9 -translate-x-1/2 -translate-y-full transition-all duration-[850ms] ease-in-out"
        style={{ left: `${here.x}%`, top: `calc(${here.y}% - 22px)`, aspectRatio: '1024 / 1536' }}
      >
        <FigureLayers outfit={outfit} tweaks={tweaks} animate={false} />
      </div>
    </div>
  )
}
