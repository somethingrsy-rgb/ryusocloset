import { useI18n } from '../i18n'
import { MAX_SAVED } from '../lib/storage'
import type { SavedOutfit } from '../lib/types'
import { Modal } from './Modal'

interface Props {
  list: SavedOutfit[]
  onLoad: (s: SavedOutfit) => void
  onDelete: (id: string) => void
  onSaveCurrent: () => void
  onClose: () => void
}

export function SavedSheet({ list, onLoad, onDelete, onSaveCurrent, onClose }: Props) {
  const { t } = useI18n()
  return (
    <Modal title={`${t('myOutfits')} (${list.length}/${MAX_SAVED})`} onClose={onClose}>
      <button
        onClick={onSaveCurrent}
        className="mb-3 min-h-12 w-full rounded-2xl bg-blush px-4 font-bold text-white shadow active:scale-[0.98]"
      >
        💾 {t('saveCurrent')}
      </button>
      {list.length === 0 ? (
        <div className="py-10 text-center text-cocoa-soft">
          <p className="text-4xl" aria-hidden>
            📒
          </p>
          <p className="mt-2 font-semibold">{t('savedEmpty')}</p>
          <p className="text-sm">{t('savedEmptyHint')}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-3">
          {list.map((s) => (
            <li key={s.id} className="relative">
              <button
                onClick={() => {
                  onLoad(s)
                  onClose()
                }}
                className="block w-full overflow-hidden rounded-2xl ring-2 ring-petal active:scale-95"
                aria-label={new Date(s.createdAt).toLocaleString()}
              >
                <img src={s.thumb} alt="" className="block aspect-[899/1536] w-full object-cover" draggable={false} />
              </button>
              <button
                onClick={() => window.confirm(t('deleteConfirm')) && onDelete(s.id)}
                aria-label={t('delete')}
                className="absolute top-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sm shadow"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
