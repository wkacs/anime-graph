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
  { href: '/statistics', key: 'stats' },
  { href: '/versus', key: 'vs' },
  { href: '/wrapped', key: 'wrapped' },
]

/**
 * A felfedezes modjai EGY teruletkent. A Vibe ezert nincs a 'Tovabb' menuben:
 * onmagaban allo menupontkent a felhasznalonak kellett kitalalnia, mikor keres
 * katalogusban es mikor hangulat szerint. Ez nem az o dolga.
 */
// A savban a TERULET neve all („Felfedezes"), a teruleten belul viszont a MODOK
// nevei — a katalogus-mod nem hivhato ugyanugy, mint az egesz terulet.
export const DISCOVER_TABS: NavTab[] = [
  { href: '/browse', key: 'catalog' },
  { href: '/vibe', key: 'vibe' },
]

// A '/' azert all elol, mert a kijelentkezett latogatonak is kell hazafele ut:
// enelkul mobilon se termekjel, se '/'-re mutato fogodzo nem volt sehol
// (§16 wayfinding: „hova mehetek? hogyan jutok ki?"). Utana rogton a Taste
// Scan, az elso ajanlat: az az egyetlen felulet, ami fiok nelkul is mond
// rola valamit.
export const GUEST_TABS: NavTab[] = [
  { href: '/', key: 'news' },
  { href: '/scan', key: 'scan' },
  { href: '/browse', key: 'browse' },
  { href: '/leaderboard', key: 'leaderboard' },
]

// Mobilon a napi-hasznalatu negy. A graf itt van, mert az a termek neve es fo
// megkulonbozteto eleme — ha a 'Tovabb' menuben all, a legtobb mobil-latogato
// sosem latja. A velemenyiras ezzel szemben kontextualis muvelet (befejezett
// cim utan, illetve a profil alatti bejovo listabol), nem napi tab.
const MOBILE_HREFS = ['/', '/list', '/browse', '/graph'] as const

export const MOBILE_TABS: NavTab[] = MOBILE_HREFS.map((href) => {
  const tab = PRIMARY_TABS.find((t) => t.href === href)
  if (!tab) throw new Error(`MOBILE_TABS: nincs ilyen elsodleges tab: ${href}`)
  return tab
})

// A mobil 'Tovabb' menu tartalma. Az elsodleges tabok kozul az kerul ide, ami
// nem fert be a savba; a /settings a komponensben, kulon zaroelemkent all.
export const MOBILE_MORE_TABS: NavTab[] = [
  ...PRIMARY_TABS.filter((t) => !MOBILE_TABS.includes(t)),
  ...MORE_TABS,
]

// Pontos egyezes vagy valodi alutvonal. A korabbi startsWith() a
// '/listazas'-t is a '/lista' tabnak jelolte.
export function isTabActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * A savban levo tab jelolese. A Felfedezes-tab a TERULETET kepviseli, nem egy
 * utvonalat: a Vibe-on allva is annak kell aktivnak latszania, kulonben a
 * felhasznalo ugy erzi, kiesett a navigaciobol.
 */
export function isNavTabActive(tab: NavTab, pathname: string): boolean {
  if (tab.href === DISCOVER_TABS[0].href) {
    return DISCOVER_TABS.some((d) => isTabActive(d.href, pathname))
  }
  return isTabActive(tab.href, pathname)
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

// Az asztali 'Tovabb' legordulo: ott mind az ot elsodleges tab kint van a savban.
export function isMoreActive(pathname: string): boolean {
  return MORE_TABS.some((t) => isTabActive(t.href, pathname))
}

// A mobil 'Tovabb' tobbet fed le, mert a savba csak negy tab fer. A /settings
// a lapon kulon zaroelemkent all, ezert itt is jelolni kell — enelkul a tabsav
// a /settings-en egyetlen aktiv jelolot sem mutatna (§16 wayfinding: a „hol
// vagyok?" kerdesre nem volt valasz).
export function isMobileMoreActive(pathname: string): boolean {
  return (
    MOBILE_MORE_TABS.some((t) => isTabActive(t.href, pathname)) ||
    isTabActive('/settings', pathname)
  )
}
