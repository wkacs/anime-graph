export type NavTab = {
  href: string
  /** a messages/*.json `nav` névtér kulcsa */
  key: string
  pendingBadge?: boolean
}

export const PRIMARY_TABS: NavTab[] = [
  { href: '/', key: 'news' },
  { href: '/graf', key: 'graph' },
  { href: '/lista', key: 'list' },
  { href: '/bongeszo', key: 'browse' },
  { href: '/velemenyek', key: 'opinions', pendingBadge: true },
]

export const MORE_TABS: NavTab[] = [
  { href: '/toplista', key: 'leaderboard' },
  { href: '/vibe', key: 'vibe' },
  { href: '/stats', key: 'stats' },
  { href: '/vs', key: 'vs' },
  { href: '/wrapped', key: 'wrapped' },
]

// Mobilon a napi-hasznalatu negy. A 3D-graf tudatosan kimarad: egy
// force-graph 390px-en nem napi muvelet, a 'Tovabb' menubol elerheto.
const MOBILE_HREFS = ['/', '/lista', '/bongeszo', '/velemenyek'] as const

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

export function isMoreActive(pathname: string): boolean {
  return MORE_TABS.some((t) => isTabActive(t.href, pathname))
}
