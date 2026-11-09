import { useEffect, useState } from 'react'

export function MultiplayerNotifications() {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [api, setApi] = useState<typeof import('../lib/mp/notifications') | null>(null)
  useEffect(() => {
    let alive = true
    void import('../lib/mp/notifications').then(async mod => {
      if (!alive) return
      setApi(mod); setNote(mod.notificationHint() ?? '')
      const on = await mod.notificationsEnabled().catch(() => false)
      if (alive) setEnabled(on)
    })
    return () => { alive = false }
  }, [])
  const toggle = async () => {
    if (!api) return
    setBusy(true)
    try {
      if (enabled) await api.disableNotifications(); else await api.enableNotifications()
      setEnabled(!enabled)
      setNote(enabled ? '알림을 껐어요.' : '자리 비움 중 채팅과 부르기 알림을 받아요.')
    } catch (e) { setNote(e instanceof Error ? e.message : '알림 설정을 저장하지 못했어요.') }
    finally { setBusy(false) }
  }
  return <div className="border-t border-[#f0c6cd] pt-2 text-xs">
    <button type="button" disabled={!api || busy} onClick={toggle} className="min-h-9 rounded-full bg-[#f3e6ea] px-3 font-bold disabled:opacity-50">{busy ? '설정 중…' : enabled ? '🔕 알림 끄기' : '🔔 친구 알림 켜기'}</button>
    {note && <p role="status" className="my-1 text-[#6b4b52]">{note}</p>}
  </div>
}
