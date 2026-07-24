import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/auth'

// /api/cron a saját CRON_SECRET-jével véd; /p + /api/public token-alapú megosztott nézet.
// M2c: a katalógus (címoldalak, böngésző, kereső) PUBLIKUS — ez az SEO-wedge; a hozzájuk
// tartozó olvasó-API-k anonim-biztosak (owned/fit: authed:false ágat adnak, sosem 500).
const PUBLIC_PREFIXES = [
  '/login', '/api/auth', '/api/cron', '/p/', '/api/public/',
  '/anime/', '/manga/', '/bongeszo', '/toplista',
  '/api/search', '/api/browse', '/api/characters/', '/api/themes/', '/api/links/',
  '/api/leaderboard',
  '/api/anime/owned', '/api/fit',
  '/sitemap.xml', '/sitemaps/', '/robots.txt',
  '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/sw.js',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next()
  const userId = await verifySession(
    process.env.SESSION_SECRET!,
    req.cookies.get('session')?.value,
  )
  if (userId) return NextResponse.next()
  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  matcher: ['/((?!_next|favicon\\.ico).*)'],
}
