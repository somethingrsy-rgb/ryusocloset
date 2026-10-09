import { useEffect, useRef, useState } from 'react'
import { CATEGORY_LABEL, useI18n } from '../i18n'
import { CATEGORIES, type Category } from '../lib/layers'
import { MAX_CUSTOM, addCustomItem, buildCustomItem, customCount } from '../lib/customItems'
import type { Item } from '../lib/types'
import { CATEGORY_ICON } from './Closet'
import { Modal } from './Modal'

interface Props {
  initialCategory: Category
  onClose: () => void
  /** 추가가 끝났을 때 (saved: 기기에 저장됐는지) */
  onAdded: (item: Item, saved: boolean) => void
  onError: (message: string) => void
}

export function AddItemModal({ initialCategory, onClose, onAdded, onError }: Props) {
  const { lang, t } = useI18n()
  const labels = CATEGORY_LABEL[lang]
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [category, setCategory] = useState<Category>(initialCategory)
  const [name, setName] = useState('')
  const [erase, setErase] = useState(true)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const submit = async () => {
    if (!file || busy) return
    if (customCount() >= MAX_CUSTOM) return onError(t('addLimit', { n: MAX_CUSTOM }))
    setBusy(true)
    try {
      const item = await buildCustomItem({ file, category, name, eraseBackground: erase })
      const saved = await addCustomItem(item)
      onAdded(item, saved)
    } catch (e) {
      onError(e instanceof Error && e.message === 'empty' ? t('addEmpty') : t('addReadFail'))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('addItem')} onClose={onClose}>
      <p className="mb-3 text-sm text-cocoa-soft">{t('addItemHint')}</p>
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
        {CATEGORIES.map((c) => (
          <button
            key={c}
            role="radio"
            aria-checked={c === category}
            onClick={() => setCategory(c)}
            className={`min-h-11 rounded-full px-3 text-sm font-semibold ${c === category ? 'bg-blush text-white' : 'bg-petal/70'}`}
          >
            {CATEGORY_ICON[c]} {labels[c]}
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
