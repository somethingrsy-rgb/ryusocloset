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

const BUILD = /assets\/index-[\w-]+\.js/
/** 지금 실행 중인 앱 코드의 파일 이름 (개발 모드에서는 없음) */
function runningBuild(): string | null {
  if (typeof document === 'undefined') return null
  for (const script of Array.from(document.scripts ?? [])) { const m = BUILD.exec(script.src); if (m) return m[0] }
  return null
}
/** 서버에 올라가 있는 최신 앱 코드 이름 (캐시를 거치지 않고 index.html 을 직접 읽는다) */
async function latestBuild(): Promise<string | null> {
  try {
    const response = await timeout(fetch(`./index.html?_=${Date.now()}`, { cache: 'no-store' }), 6000)
    if (!response.ok) return null
    return BUILD.exec(await response.text())?.[0] ?? null
  } catch { return null }
}
/** 최신 버전이 서버에 있는데 이 화면은 아직 옛 버전인가 */
async function isBehind(): Promise<boolean> {
  const running = runningBuild()
  if (!running) return false
  const latest = await latestBuild()
  return !!latest && latest !== running
}
/**
 * 서비스 워커가 새 버전을 못 받아 와서 새로고침해도 옛 화면이 다시 뜰 때의 마지막 수단:
 * 서비스 워커와 앱 코드 캐시(precache)를 지우고 다시 연다. 저장해 둔 그림 캐시(ryuso-images)는 남긴다. 코디·방·농장·게임 기록(localStorage, IndexedDB)은 건드리지 않는다.
 */
async function hardRefresh(): Promise<void> {
  try { for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister() } catch { /* 이어서 진행 */ }
  try { if (typeof caches !== 'undefined') for (const name of await caches.keys()) if (/precache/i.test(name)) await caches.delete(name) } catch { /* 이어서 진행 */ }
  window.location.reload()
}

/** 새 버전을 받아 와서 적용하고 다시 연다. 서비스 워커가 못 받아 오면 옛 코드 캐시를 지우고 다시 연다. 저장한 기록은 지우지 않는다. */
export async function refreshApp(): Promise<void> {
  if (!navigator.onLine) throw new Error('offline')
  const behind = await isBehind()
  const reload = () => (behind ? hardRefresh() : (window.location.reload(), Promise.resolve()))
  if (!('serviceWorker' in navigator)) { window.location.reload(); return }
  try {
    const current = registration ?? await timeout(navigator.serviceWorker.getRegistration())
    if (!current) return await reload()
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
    if (!waiting) return await reload()
    await new Promise<void>((resolve, reject) => {
      const container = navigator.serviceWorker
      const cleanup = () => { clearTimeout(timer); container.removeEventListener('controllerchange', changed) }
      const changed = () => { cleanup(); resolve(); window.location.reload() }
      const timer = setTimeout(() => { cleanup(); reject(new Error('activate-timeout')) }, 8000)
      container.addEventListener('controllerchange', changed)
      try { waiting.postMessage({ type: 'SKIP_WAITING' }) } catch (error) { cleanup(); reject(error) }
    })
  } catch (error) {
    // 서비스 워커 경로가 실패해도 최신 버전이 서버에 있다는 걸 확인했다면 그래도 최신으로 연다
    if (behind) return await hardRefresh()
    throw error
  }
}
