import { useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { backupName, makeBackup, parseBackup, restoreBackup } from '../lib/backup'
import { Modal } from './Modal'

interface Props {
  sound: boolean
  onSound: () => void
  onLang: () => void
  onClose: () => void
  onToast: (message: string) => void
}

const row = 'flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-petal/50 px-4 text-left font-semibold'

export function SettingsSheet({ sound, onSound, onLang, onClose, onToast }: Props) {
  const { lang, t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      const text = JSON.stringify(await makeBackup())
      const file = new File([text], backupName(), { type: 'application/json' })
      // 폰에서는 공유 창(카카오톡·드라이브 등)으로 바로 보낼 수 있으면 그걸 쓰고, 아니면 파일로 내려받는다
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: t('backupShareTitle') })
          onToast(t('backupDone'))
          return
        } catch (e) {
          if ((e as DOMException)?.name === 'AbortError') return
        }
      }
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      onToast(t('backupDone'))
    } catch {
      onToast(t('backupFail'))
    } finally {
      setBusy(false)
    }
  }

  const load = async (file: File | undefined) => {
    if (!file) return
    const b = parseBackup(await file.text())
    if (!b) return onToast(t('restoreInvalid'))
    if (!window.confirm(t('restoreConfirm'))) return
    setBusy(true)
    if (await restoreBackup(b)) {
      onToast(t('restoreDone'))
      setTimeout(() => window.location.reload(), 600)
    } else {
      setBusy(false)
      onToast(t('restoreFail'))
    }
  }

  return (
    <Modal title={t('settings')} onClose={onClose}>
      <div className="space-y-2 pb-2">
        <button className={row} onClick={onSound} aria-pressed={sound}>
          <span>{sound ? '🔊' : '🔇'} {t('soundSetting')}</span>
          <span className="text-sm text-cocoa-soft">{sound ? t('on') : t('off')}</span>
        </button>
        <button className={row} onClick={onLang}>
          <span>🌐 {t('languageSetting')}</span>
          <span className="text-sm text-cocoa-soft">{lang === 'ko' ? '한국어' : 'English'}</span>
        </button>
      </div>

      <h3 className="mt-3 mb-1 text-sm font-bold">☁️ {t('backupTitle')}</h3>
      <p className="mb-3 text-sm leading-relaxed text-cocoa-soft">{t('backupHint')}</p>
      <div className="space-y-2">
        <button disabled={busy} onClick={save} className="min-h-12 w-full rounded-full bg-blush px-4 font-bold text-white shadow disabled:opacity-50">
          📤 {t('backupMake')}
        </button>
        <button disabled={busy} onClick={() => fileRef.current?.click()} className="min-h-12 w-full rounded-full bg-petal px-4 font-bold shadow-sm disabled:opacity-50">
          📥 {t('restoreFile')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label={t('restoreFile')}
          onChange={(e) => {
            void load(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </Modal>
  )
}
