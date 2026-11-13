/* 서비스 워커에 붙는 알림 처리(vite.config.ts 의 workbox.importScripts). 앱 창이 보이는 중에는 알림을 띄우지 않는다 */
self.addEventListener('push', (event) => {
  let d = {}
  try { const j = event.data ? event.data.json() : {}; d = j.data || j.notification || j } catch (e) { /* 글자가 아니면 무시 */ }
  const title = d.title || '류소 옷장'
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (wins.some((w) => w.visibilityState === 'visible')) return
    await self.registration.showNotification(title, { body: d.body || '', tag: d.tag || 'ryuso', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true })
  })())
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (wins.length) { try { await wins[0].focus(); return } catch (e) { /* 새로 연다 */ } }
    await self.clients.openWindow(self.registration.scope)
  })())
})
