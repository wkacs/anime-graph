import { NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  aiUsageLog, anime, animeStaff, duels, episodeLog, favoriteCharacters,
  opinions, recommendations, settings, syncAccounts, tasteMemory, tasteSignal, users,
  watchlistItems,
} from '@/db/schema'
import { accountExportFilename } from '@/lib/account'
import { requireUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

// GDPR-adathordozhatósági export. Jelszóhash, tokenhash és OAuth access/refresh
// token soha nem kerül bele; ezek helyett csak a kapcsolt szolgáltató neve látszik.
export async function GET() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const [user] = await db.select({
    username: users.username, email: users.email, emailVerifiedAt: users.emailVerifiedAt,
    locale: users.locale, bio: users.bio, tier: users.tier, createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId))
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const animeRows = await db.select().from(anime).where(eq(anime.userId, userId))
  const animeIds = animeRows.map((row) => row.id)
  const [
    settingRows, memoryRows, signalRows, favoriteRows, duelRows, episodeRows,
    recommendationRows, usageRows, watchlistRows, staffRows, syncRows, opinionRows,
  ] = await Promise.all([
    db.select().from(settings).where(eq(settings.userId, userId)),
    db.select().from(tasteMemory).where(eq(tasteMemory.userId, userId)),
    db.select().from(tasteSignal).where(eq(tasteSignal.userId, userId)),
    db.select().from(favoriteCharacters).where(eq(favoriteCharacters.userId, userId)),
    db.select().from(duels).where(eq(duels.userId, userId)),
    db.select().from(episodeLog).where(eq(episodeLog.userId, userId)),
    db.select().from(recommendations).where(eq(recommendations.userId, userId)),
    db.select().from(aiUsageLog).where(eq(aiUsageLog.userId, userId)),
    db.select().from(watchlistItems).where(eq(watchlistItems.userId, userId)),
    db.select().from(animeStaff).where(eq(animeStaff.userId, userId)),
    db.select({ provider: syncAccounts.provider, externalUsername: syncAccounts.externalUsername, createdAt: syncAccounts.createdAt })
      .from(syncAccounts).where(eq(syncAccounts.userId, userId)),
    animeIds.length
      ? db.select().from(opinions).where(inArray(opinions.animeId, animeIds))
      : Promise.resolve([]),
  ])

  const payload = {
    format: 'anime-graph-account-export', version: 1, exportedAt: new Date().toISOString(),
    account: user,
    data: {
      anime: animeRows, opinions: opinionRows, settings: settingRows,
      tasteMemory: memoryRows, tasteSignals: signalRows, favoriteCharacters: favoriteRows,
      duels: duelRows, episodeLog: episodeRows, recommendations: recommendationRows,
      aiUsage: usageRows, watchlist: watchlistRows, animeStaff: staffRows,
      syncAccounts: syncRows,
    },
    omittedForSecurity: ['passwordHash', 'session tokens', 'verification/reset token hashes', 'OAuth access and refresh tokens'],
  }
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${accountExportFilename(user.username)}"`,
      'Cache-Control': 'no-store',
    },
  })
}
