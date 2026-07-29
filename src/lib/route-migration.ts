// Az angol URL az új, megosztható kanonikus forma. A régi magyar útvonalakat
// 308-cal átirányítjuk; az új címeket a meglévő app-route könyvtárakra rewrite-oljuk.
export const LEGACY_ROUTE_REDIRECTS: Record<string, string> = {
  '/bongeszo': '/browse', '/toplista': '/leaderboard', '/beallitasok': '/settings',
  '/lista': '/list', '/velemenyek': '/reviews', '/graf': '/graph',
  '/stats': '/statistics', '/vs': '/versus',
}

export const ENGLISH_ROUTE_REWRITES: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_ROUTE_REDIRECTS).map(([legacy, canonical]) => [canonical, legacy]),
)

export function legacyRedirect(pathname: string): string | null {
  return LEGACY_ROUTE_REDIRECTS[pathname] ?? null
}

export function internalRoute(pathname: string): string | null {
  return ENGLISH_ROUTE_REWRITES[pathname] ?? null
}
