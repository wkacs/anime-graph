export type NavTab = {
  href: string
  /** a messages/*.json `nav` névtér kulcsa */
  key: string
  pendingBadge?: boolean
}

export const PRIMARY_TABS: NavTab[] = [
  { href: '/', key: 'news' },
  { href: '/graph', key: 'graph' },
  { href: '/list', key: 'list' },
  { href: '/browse', key: 'browse' },
  { href: '/reviews', key: 'opinions', pendingBadge: true },
]

export const MORE_TABS: NavTab[] = [
  { href: '/leaderboard', key: 'leaderboard' },
  { href: '/community', key: 'community' },
  { href: '/notifications', key: 'notifications' },
  { href: '/vibe', key: 'vibe' },
  { href: '/statistics', key: 'stats' },
  { href: '/versus', key: 'vs' },
  { href: '/wrapped', key: 'wrapped' },
]

export const GUEST_TABS: NavTab[] = [
  { href: '/browse', key: 'browse' },
  { href: '/leaderboard', key: 'leaderboard' },
]

// Mobilon a napi-hasznalatu negy. A 3D-graf tudatosan kimarad: egy
// force-graph 390px-en nem napi muvelet, a 'Tovabb' menubol elerheto.
const MOBILE_HREFS = ['/', '/list', '/browse', '/reviews'] as const

export const MOBILE_TABS: NavTab[] = MOBILE_HREFS.map((href) => {
  const tab = PRIMARY_TABS.find((t) => t.href === href)
  if (!tab) throw new Error(`MOBILE_TABS: nincs ilyen elsodleges tab: ${href}`)
  return tab
})

// Pontos egyezes vagy valodi alutvonal. A korabbi startsWith() a
// '/listazas'-t is a '/lista' tabnak jelolte.
export function isTabActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function isNavHidden(pathname: string): boolean {
  return pathname === '/login' || pathname === '/p' || pathname.startsWith('/p/')
}

// A gráf 3D-vászna és a wrapped snap-sztorija saját, teljes nézetmagasságot
// kezel — ott egy lábléc-sáv eltolná vagy elvágná a tartalmat. Ahol a nav is
// rejtve van (login, megosztott lista), ott a lábléc sem kell.
const FULL_VIEW_ROUTES = ['/graph', '/wrapped']

export function isFooterHidden(pathname: string): boolean {
  if (isNavHidden(pathname)) return true
  return FULL_VIEW_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

export function isMoreActive(pathname: string): boolean {
  return MORE_TABS.some((t) => isTabActive(t.href, pathname))
}
