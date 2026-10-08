import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { Background } from '../lib/backgrounds'
import { canvasToBlob, renderOutfitCanvas } from '../lib/exportPng'
import type { Outfit } from '../lib/types'
import { Modal } from './Modal'

interface Props {
  outfit: Outfit
  background: Background
  onClose: () => void
  onError: () => void
}

function stamp() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function ExportSheet({ outfit, background, onClose, onError }: Props) {
  const { t } = useI18n()
  const [withBg, setWithBg] = useState(background.kind !== 'transparent')
  const [sticker, setSticker] = useState(true)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  const bg = withBg && background.kind !== 'transparent' ? background : null

  useEffect(() => {
    let cancelled = false
    setBlob(null)
    renderOutfitCanvas(outfit, { sticker, background: bg })
      .then(canvasToBlob)
      .then((b) => !cancelled && setBlob(b))
      .catch(() => !cancelled && onError())
    return () => {
      cancelled = true
    }
    // bg 는 withBg/background 에서 파생
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outfit, sticker, withBg, background])

  useEffect(() => {
    if (!blob) return setUrl(null)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])

  const filename = `ryuso-closet-${stamp()}.png`
  const file = useMemo(() => (blob ? new File([blob], filename, { type: 'image/png' }) : null), [blob, filename])
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  const download = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: t('title') })
    } catch {
      /* 사용자가 공유 창을 닫은 경우 */
    }
  }

  const toggle = (checked: boolean, set: (v: boolean) => void, label: string, disabled = false) => (
    <label className={`flex min-h-11 items-center gap-2 rounded-2xl bg-petal/70 px-3 ${disabled ? 'opacity-50' : ''}`}>
      <input type="checkbox" className="h-5 w-5 accent-[#f0668c]" checked={checked} disabled={disabled} onChange={(e) => set(e.target.checked)} />
      <span className="text-sm font-semibold">{label}</span>
    </label>
  )

  return (
    <Modal title={t('exportTitle')} onClose={onClose}>
      <div
        className="mx-auto flex h-[44dvh] items-center justify-center rounded-2xl p-2"
        style={{ background: 'conic-gradient(#ececf1 25%, #fff 0 50%, #ececf1 0 75%, #fff 0) 0 0 / 20px 20px' }}
      >
        {url ? (
          <img src={url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
        ) : (
          <span className="text-sm text-cocoa-soft">{t('rendering')}</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {toggle(withBg, setWithBg, withBg || background.kind !== 'transparent' ? t('withBackground') : t('transparent'), background.kind === 'transparent')}
        {toggle(sticker, setSticker, t('sticker'))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={download}
          disabled={!url}
          className="min-h-12 flex-1 rounded-2xl bg-blush px-4 font-bold text-white shadow disabled:opacity-50"
        >
          ⬇ {t('download')}
        </button>
        {canShare && (
          <button onClick={share} className="min-h-12 flex-1 rounded-2xl bg-petal px-4 font-bold">
            ↗ {t('share')}
          </button>
        )}
      </div>
    </Modal>
  )
}
