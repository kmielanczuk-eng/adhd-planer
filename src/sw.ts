/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
// Offline: każda nawigacja dostaje index.html z cache (routing jest po hashu).
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

interface PushPayload {
  title?: string
  body?: string
  tag?: string
  url?: string
  taskId?: string
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  const scope = self.registration.scope
  const title = data.title || '🔔 Ogarniacz'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || (data.taskId ? `task-${data.taskId}` : undefined),
      icon: scope + 'icon-192.png',
      badge: scope + 'badge-72.png',
      data: { url: data.url || (data.taskId ? `${scope}#/teraz?task=${data.taskId}` : scope) },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url: string = event.notification.data?.url || self.registration.scope
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) {
        if (c.url.startsWith(self.registration.scope)) {
          await c.focus()
          if ('navigate' in c) await (c as WindowClient).navigate(url).catch(() => undefined)
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
