import { registerSW } from 'virtual:pwa-register'
let registration: ServiceWorkerRegistration | undefined
let initialized = false
let pending = false
const listeners = new Set<() => void>()
export const subscribeAppUpdate = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const appUpdatePending = () => pending
const notify = () => { pending = true; listeners.forEach(fn => fn()) }
export function initAppUpdates() {
  if (initialized) return
  initialized = true
  registerSW({
    immediate: true,
    onNeedRefresh: notify,
    onRegisteredSW: (_url, value) => { registration = value },
  })
  const check = () => {
    if (document.hidden || !navigator.onLine) return
    void registration?.update().catch(() => undefined)
  }
  window.addEventListener('online', check)
  document.addEventListener('visibilitychange', check)
  window.setInterval(check, 5 * 60 * 1000)
}
function timeout<T>(work: Promise<T>, milliseconds = 12000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('update-timeout')), milliseconds) })]).finally(() => clearTimeout(timer))
}
/** Wait for downloaded code before reloading; never clear game storage or caches. */
export async function refreshApp(): Promise<void> {
  if (!navigator.onLine) throw new Error('offline')
  if (!('serviceWorker' in navigator)) { window.location.reload(); return }
  const current = registration ?? await timeout(navigator.serviceWorker.getRegistration())
  if (!current) { window.location.reload(); return }
  await timeout(current.update())
  const installing = current.installing
  if (installing && installing.state !== 'installed' && installing.state !== 'activated') {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); installing.removeEventListener('statechange', changed) }
      const changed = () => {
        if (installing.state === 'installed' || installing.state === 'activated') { cleanup(); resolve() }
        else if (installing.state === 'redundant') { cleanup(); reject(new Error('install-failed')) }
      }
      const timer = setTimeout(() => { cleanup(); reject(new Error('install-timeout')) }, 12000)
      installing.addEventListener('statechange', changed)
      changed()
    })
  }
  const waiting = current.waiting
  if (!waiting) { window.location.reload(); return }
  await new Promise<void>((resolve, reject) => {
    const container = navigator.serviceWorker
    const cleanup = () => { clearTimeout(timer); container.removeEventListener('controllerchange', changed) }
    const changed = () => { cleanup(); resolve(); window.location.reload() }
    const timer = setTimeout(() => { cleanup(); reject(new Error('activate-timeout')) }, 12000)
    container.addEventListener('controllerchange', changed)
    try { waiting.postMessage({ type: 'SKIP_WAITING' }) } catch (error) { cleanup(); reject(error) }
  })
}
