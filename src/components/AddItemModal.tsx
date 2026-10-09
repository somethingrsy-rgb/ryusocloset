import { useEffect, useRef, useState } from 'react'
import { CATEGORY_LABEL, useI18n } from '../i18n'
import { CATEGORIES, type Category } from '../lib/layers'
import {
  MAX_CUSTOM,
  addCustomItem,
  addCustomRoomItem,
  buildCustomItem,
  buildCustomRoomItem,
  customCount,
  customRoomCount,
} from '../lib/customItems'
import type { RoomGroup, RoomItemDef } from '../lib/roomTypes'
import type { Item } from '../lib/types'
import { CATEGORY_ICON } from './Closet'
import { Modal } from './Modal'

const ROOM_KINDS: { id: RoomGroup; icon: string; ko: string; en: string }[] = [
  { id: 'furniture', icon: '🛋️', ko: '가구·소품', en: 'Furniture' },
  { id: 'rug', icon: '🟫', ko: '러그', en: 'Rug' },
  { id: 'wall', icon: '🖼️', ko: '벽 장식', en: 'Wall' },
  { id: 'light', icon: '✨', ko: '조명', en: 'Lights' },
  { id: 'camp', icon: '⛺', ko: '캠핑 용품', en: 'Camp gear' },
]

type Props = {
  onClose: () => void
  onError: (message: string) => void
} & (
  | {
      kind: 'closet'
      initial: Category
      /** 추가가 끝났을 때 (saved: 기기에 저장됐는지) */
      onAdded: (item: Item, saved: boolean) => void
    }
  | {
      kind: 'room'
      initial: RoomGroup
      onAdded: (item: RoomItemDef, saved: boolean) => void
    }
)

export function AddItemModal(props: Props) {
  const { onClose, onError } = props
  const { lang, t } = useI18n()
  const labels = CATEGORY_LABEL[lang]
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [category, setCategory] = useState<string>(props.initial)
  const [name, setName] = useState('')
  const [erase, setErase] = useState(true)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const options =
    props.kind === 'room'
      ? ROOM_KINDS.filter((k) => (k.id === 'camp') === (props.initial === 'camp')).map((k) => ({ id: k.id as string, icon: k.icon, label: k[lang] }))
      : CATEGORIES.map((c) => ({ id: c as string, icon: CATEGORY_ICON[c], label: labels[c] }))

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const submit = async () => {
    if (!file || busy) return
    if ((props.kind === 'room' ? customRoomCount() : customCount()) >= MAX_CUSTOM) return onError(t('addLimit', { n: MAX_CUSTOM }))
    setBusy(true)
    try {
      if (props.kind === 'room') {
        const item = await buildCustomRoomItem({ file, group: category as RoomGroup, name, eraseBackground: erase })
        props.onAdded(item, await addCustomRoomItem(item))
      } else {
        const item = await buildCustomItem({ file, category: category as Category, name, eraseBackground: erase })
        props.onAdded(item, await addCustomItem(item))
      }
    } catch (e) {
      onError(e instanceof Error && e.message === 'empty' ? t('addEmpty') : t('addReadFail'))
      setBusy(false)
    }
  }

  return (
    <Modal title={props.kind === 'room' ? t('addProp') : t('addItem')} onClose={onClose}>
      <p className="mb-3 text-sm text-cocoa-soft">{props.kind === 'room' ? t('addPropHint') : t('addItemHint')}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={t('pickPhoto')}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="mb-3 flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-petal/60 text-cocoa-soft ring-2 ring-petal"
      >
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="font-semibold">📷 {t('pickPhoto')}</span>
        )}
      </button>

      <div className="mb-1 text-xs font-bold text-cocoa-soft">{t('itemCategory')}</div>
      <div role="radiogroup" aria-label={t('itemCategory')} className="mb-3 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={o.id === category}
            onClick={() => setCategory(o.id)}
            className={`min-h-11 rounded-full px-3 text-sm font-semibold ${o.id === category ? 'bg-blush text-white' : 'bg-petal/70'}`}
          >
            {o.icon} {o.label}
          </button>
        ))}
      </div>

      <label className="mb-3 block text-xs font-bold text-cocoa-soft">
        {t('itemName')}
        <input
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block min-h-11 w-full rounded-xl bg-petal/50 px-3 text-base font-normal text-cocoa outline-none ring-2 ring-petal focus:ring-blush"
        />
      </label>

      <label className="mb-4 flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={erase} onChange={(e) => setErase(e.target.checked)} className="h-5 w-5 accent-blush" />
        {t('eraseBg')}
      </label>

      <button
        disabled={!file || busy}
        onClick={submit}
        className="min-h-12 w-full rounded-full bg-blush px-4 font-bold text-white shadow disabled:opacity-40"
      >
        {busy ? t('adding') : t('addConfirm')}
      </button>
    </Modal>
  )
}
