import { useMemo } from 'react'
import { CATEGORY_LABEL, useI18n } from '../i18n'
import { PLACES, currentAssignment, inPool, isFound, resetGame, setLock } from '../lib/game'
import { ITEMS, assetUrl } from '../lib/items'
import { useItemsVersion } from '../lib/useItemsVersion'
import { useGame } from './TravelGame'

const TEXT = {
  ko: {
    title: '여행 도감',
    lock: '찾은 아이템만 옷장에 보이기',
    lockHint: '끄면 모든 아이템을 옷장에서 바로 쓸 수 있어요',
    unknown: '아직 못 찾았어요',
    where: '숨은 곳',
    reset: '여행 처음부터 다시',
    resetConfirm: '찾은 아이템 기록을 지우고 처음부터 시작할까요?',
  },
  en: {
    title: 'Travel Book',
    lock: 'Only show found items in the closet',
    lockHint: 'Turn off to use every item right away',
    unknown: 'Not found yet',
    where: 'Hidden at',
    reset: 'Start over',
    resetConfirm: 'Clear your found items and start over?',
  },
}

export function TravelBook() {
  const { lang } = useI18n()
  const tx = TEXT[lang]
  const game = useGame()
  const ver = useItemsVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const assign = useMemo(currentAssignment, [ver])
  const placeOf = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of PLACES) for (const id of assign[p.id] ?? []) m[id] = lang === 'ko' ? p.ko : p.en
    return m
  }, [assign, lang])
  const pool = ITEMS.filter(inPool)
  const got = pool.filter((i) => isFound(i.id)).length

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-black/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-blush-deep">📖 {tx.title}</h2>
          <span className="text-sm font-bold">
            {got}/{pool.length}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-petal">
          <div className="h-full rounded-full bg-blush transition-all" style={{ width: `${pool.length ? (got / pool.length) * 100 : 0}%` }} />
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs font-bold">
          <input type="checkbox" checked={game.lock} onChange={(e) => setLock(e.target.checked)} className="h-4 w-4" />
          {tx.lock}
        </label>
        <p className="text-[11px] text-cocoa-soft">{tx.lockHint}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-4 gap-2">
          {pool.map((it) => {
            const ok = isFound(it.id)
            return (
              <div key={it.id} className="flex flex-col items-center rounded-2xl bg-petal/60 p-1 text-center" title={ok ? it.name[lang] : tx.unknown}>
                <img
                  src={assetUrl(it.thumb)}
                  alt=""
                  className="aspect-square w-full object-contain"
                  style={ok ? undefined : { filter: 'brightness(0) opacity(0.25)' }}
                  draggable={false}
                />
                <span className="w-full truncate text-[10px] leading-4 font-bold">{ok ? it.name[lang] : '???'}</span>
                <span className="w-full truncate text-[9px] leading-3 text-cocoa-soft">{ok ? CATEGORY_LABEL[lang][it.category] : `${tx.where}: ${placeOf[it.id] ?? ''}`}</span>
              </div>
            )
          })}
        </div>
        <button
          className="mx-auto mt-4 block rounded-full bg-white px-4 py-2 text-xs font-bold text-cocoa-soft ring-1 ring-black/10"
          onClick={() => window.confirm(tx.resetConfirm) && resetGame()}
        >
          {tx.reset}
        </button>
      </div>
    </div>
  )
}
