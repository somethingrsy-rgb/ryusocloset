import { useRef, useState } from 'react'
import { useI18n, type MsgKey } from '../i18n'
import { backupName, makeBackup, parseBackup, restoreBackup } from '../lib/backup'
import { syncAvailable } from '../lib/sync/config'
import { signInWith, signOutNow, syncNow, useSyncStatus } from '../lib/sync/manager'
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
  const st = useSyncStatus()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const auth = async (create: boolean) => {
    setBusy(true)
    setMsg(null)
    const err = await signInWith(email.trim(), pw, create)
    setBusy(false)
    if (err) setMsg(err)
    else setPw('')
  }

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

      <h3 className="mt-5 mb-1 text-sm font-bold">🔄 {t('syncTitle')}</h3>
      {!syncAvailable ? (
        <p className="mb-3 text-sm leading-relaxed text-cocoa-soft">{t('syncNotSetup')}</p>
      ) : st.email ? (
        <div className="mb-3 space-y-2">
          <p className="text-sm leading-relaxed text-cocoa-soft">
            {t('syncSignedIn', { email: st.email })}{' '}
            {st.state === 'syncing' ? t('syncing') : st.state === 'error' ? t((st.errorKey ?? 'syncErrGeneric') as MsgKey) : st.last ? t('syncLast', { time: new Date(st.last).toLocaleTimeString() }) : ''}
          </p>
          {st.skipped > 0 && <p className="text-sm text-blush-deep">{t('syncSkipped', { n: st.skipped })}</p>}
          <div className="flex gap-2">
            <button onClick={() => void syncNow()} className="min-h-11 flex-1 rounded-full bg-blush px-3 font-bold text-white shadow">
              {t('syncNow')}
            </button>
            <button onClick={() => void signOutNow()} className="min-h-11 flex-1 rounded-full bg-petal px-3 font-bold">
              {t('syncSignOut')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-3 space-y-2">
          <p className="text-sm leading-relaxed text-cocoa-soft">{t('syncHint')}</p>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t('syncEmail')}
            aria-label={t('syncEmail')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block min-h-11 w-full rounded-xl bg-petal/50 px-3 text-base outline-none ring-2 ring-petal focus:ring-blush"
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder={t('syncPassword')}
            aria-label={t('syncPassword')}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="block min-h-11 w-full rounded-xl bg-petal/50 px-3 text-base outline-none ring-2 ring-petal focus:ring-blush"
          />
          {msg && <p className="text-sm font-semibold text-blush-deep">{t(msg as MsgKey)}</p>}
          <div className="flex gap-2">
            <button disabled={busy || !email || !pw} onClick={() => void auth(false)} className="min-h-11 flex-1 rounded-full bg-blush px-3 font-bold text-white shadow disabled:opacity-50">
              {t('syncLogin')}
            </button>
            <button disabled={busy || !email || !pw} onClick={() => void auth(true)} className="min-h-11 flex-1 rounded-full bg-petal px-3 font-bold disabled:opacity-50">
              {t('syncCreate')}
            </button>
          </div>
        </div>
      )}

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
