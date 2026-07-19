self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {}
  e.waitUntil(self.registration.showNotification(data.title || 'Anime Graph', {
    body: data.body || '',
    icon: '/icon-192.png',
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(clients.matchAll({ type: 'window' }).then((tabs) => {
    const url = e.notification.data && e.notification.data.url ? e.notification.data.url : '/'
    for (const t of tabs) { if ('focus' in t) return t.focus() }
    return clients.openWindow(url)
  }))
})
