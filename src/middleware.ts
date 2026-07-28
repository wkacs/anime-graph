import { NextRequest, NextResponse } from 'next/server'
import { createSession, verifySession, SESSION_DAYS, SESSION_RENEW_AFTER_MS } from '@/lib/auth'
import { isPublicPath } from '@/lib/public-paths'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (isPublicPath(pathname)) return NextResponse.next()
  const claims = await verifySession(
    process.env.SESSION_SECRET!,
    req.cookies.get('session')?.value,
  )
  if (claims) {
    const res = NextResponse.next()
    // Csúszó megújítás: a felezőpont után friss sütit adunk, így az aktív user
    // sosem esik ki. Adatbázis nem kell hozzá — a meglévő claimeket írjuk alá
    // új lejárattal, a tokenVersion változatlan marad, tehát egy reset utáni
    // régi token nem tud "örökre" megújulni: a requireUserId elutasítja.
    if (claims.expiresAt - Date.now() < SESSION_RENEW_AFTER_MS) {
      const fresh = await createSession(
        process.env.SESSION_SECRET!, claims.userId, claims.tokenVersion, SESSION_DAYS,
      )
      res.cookies.set('session', fresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * SESSION_DAYS,
        path: '/',
      })
    }
    return res
  }
  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  matcher: ['/((?!_next|favicon\\.ico).*)'],
}
