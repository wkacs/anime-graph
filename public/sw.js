// Verziozott cache-nev: emeld, ha az offline oldal tartalma valtozik.
const CACHE = 'ag-shell-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .catch(() => self.clients.claim()),
  )
})

// A telepithetoseg feltetele, hogy legyen fetch handler ES hogy a lap offline is
// valaszoljon — enelkul a Chrome NEM tuzeli a beforeinstallprompt-ot, tehat a
// "kezdokepernyohoz adas" sav sosem jelenne meg.
//
// Szandekosan CSAK a navigacios kereseket kezeljuk, azokat is halozat-eloszor.
// Az /api/* valaszok soha nem kerulnek cache-be: egy elavult watchlist rosszabb,
// mint egy hibauzenet. Szemelyre szabott HTML-t sem cache-elunk — kijelentkezes
// utan offline visszakoszonne az elozo felhasznalo kezdolapja.
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  if (req.mode !== 'navigate') return

  e.respondWith(
    fetch(req).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => cached ?? Response.error()),
    ),
  )
})

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
