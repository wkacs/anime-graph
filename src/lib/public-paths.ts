// Mi erheto el bejelentkezes nelkul. A lista a middleware-e volt, de a
// dontesi logika tiszta fuggvenykent tesztelheto — a middleware-t a projekt
// nem tudja integracios teszttel fedni (nincs halozat a tesztekben).
//
// /api/cron a sajat CRON_SECRET-jevel ved; /p + /api/public token-alapu megosztott
// nezet. M2c: a katalogus (cimoldalak, bongeszo, kereso) PUBLIKUS — ez az SEO-wedge;
// a hozzajuk tartozo olvaso-API-k anonim-biztosak (owned/fit: authed:false agat
// adnak, sosem 500).
export const PUBLIC_PATHS = [
  '/',
  '/login', '/api/auth', '/api/cron', '/p/', '/api/public/',
  '/anime/', '/manga/', '/browse', '/leaderboard', '/community', '/u/',
  // A jogi tajekoztatokra a lablec MINDEN publikus oldalrol es a regisztracios
  // urlap is linkel. Auth mogott a link holt, es elfogadhatatlan feltetelt kerne.
  '/aszf', '/adatvedelem',
  '/api/search', '/api/browse', '/api/characters/', '/api/themes/', '/api/links/',
  '/api/leaderboard', '/api/reviews', '/api/health',
  '/api/anime/owned', '/api/fit',
  '/sitemap.xml', '/sitemaps/', '/robots.txt',
  '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/sw.js',
]

/**
 * Puszta `startsWith` helyett szegmens-hataron egyezunk: kulonben az `/aszf`
 * bejegyzes az `/aszfalt`-ot is kinyitna. Egy jovobeli oldal veletlen
 * kinyitasa csendes adatszivargas lenne, ezert a szigorubb egyezes a jo default.
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) =>
    p === '/' ? pathname === '/' : p.endsWith('/') ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`),
  )
}
