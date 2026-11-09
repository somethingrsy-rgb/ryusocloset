/* Imported by the existing Workbox worker: one registration for offline caching and push. */
self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch { /* still display a visible fallback */ }
  event.waitUntil(self.registration.showNotification(
    typeof payload.title === 'string' ? payload.title : '류소 옷장',
    {
      body: typeof payload.body === 'string' ? payload.body : '친구가 기다리고 있어요.',
      icon: new URL('icons/icon-192.png', self.registration.scope).href,
      tag: 'ryuso-friends',
      data: { url: new URL('?mpResume=1', self.registration.scope).href },
    },
  ))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil((async () => {
    const scope = new URL(self.registration.scope)
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      const url = new URL(client.url)
      if (url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) {
        await client.focus()
        client.postMessage({ type: 'ryuso:open-chat' })
        return
      }
    }
    await self.clients.openWindow(new URL('?mpResume=1', scope).href)
  })())
})
