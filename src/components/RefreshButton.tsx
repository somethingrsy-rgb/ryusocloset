import { useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { appUpdatePending, refreshApp, subscribeAppUpdate } from '../lib/appUpdate'
export function RefreshButton() {
  const { lang } = useI18n(); const ko = lang === 'ko'
  const pending = useSyncExternalStore(subscribeAppUpdate, appUpdatePending)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <div className="space-y-2">
    <button disabled={busy} className="flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl bg-petal/50 px-4 text-left font-semibold disabled:opacity-50" onClick={async () => {
      setBusy(true); setError('')
      try { await refreshApp() } catch {
        setError(ko ? '업데이트하지 못했어요. 인터넷 연결을 확인하고 다시 눌러주세요.' : 'Could not update. Check your connection and try again.')
      } finally { setBusy(false) }
    }}><span>🔄 {busy ? (ko ? '최신 버전 확인 중…' : 'Checking for updates…') : (ko ? '새로고침 · 최신 버전 적용' : 'Refresh · apply latest version')}</span>{pending && <span className="shrink-0 rounded-full bg-blush px-2 py-1 text-xs text-white">{ko ? '새 버전' : 'Update'}</span>}</button>
    <p className="m-0 px-1 text-xs text-cocoa-soft">{ko ? '코디·방·농장·게임 기록을 유지한 채 다시 열어요. 진행 중인 미니게임은 종료돼요.' : 'Saved outfits, rooms, farm and records stay. An active minigame ends.'}</p>
    {error && <p role="alert" className="px-1 text-sm text-red-700">{error}</p>}
  </div>
}
