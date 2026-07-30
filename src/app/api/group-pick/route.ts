import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, settings, title, users } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { canViewProfile } from '@/lib/profile-visibility'
import { buildTasteVector } from '@/lib/fit-score'
import { rankGroupPicks } from '@/lib/group-pick'
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

const POOL_SIZE = 400

// Klub-ajánló (D5): POST { usernames: string[] } — a hívó + a megadott belső userek
// közös ízlés-metszete a lokális katalóguson. AI-hívás nincs, kvótát nem fogyaszt.
export async function POST(req: NextRequest) {
  const callerId = await requireUserId()
  if (!callerId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const names: string[] = Array.isArray(body.usernames)
    ? body.usernames.map((s: unknown) => String(s).trim()).filter(Boolean)
    : []
  if (!names.length) return apiError('atLeastOneUsername', 400)

  const found = await db.select({ id: users.id, username: users.username })
    .from(users).where(inArray(users.username, names))
  const missing = names.filter((n) => !found.some((f) => f.username === n))
  if (missing.length) {
    return apiError('noSuchUsers', 404, { names: missing.join(', ') })
  }
  const visibilityRows = found.length
    ? await db.select({ userId: settings.userId, value: settings.value }).from(settings)
        .where(and(inArray(settings.userId, found.map((f) => f.id)), eq(settings.key, 'profileVisibility')))
    : []
  const visibilityByUser = new Map(visibilityRows.map((row) => [row.userId, row.value]))
  const hidden = found.filter((user) => !canViewProfile(callerId, user.id, visibilityByUser.get(user.id)))
  if (hidden.length) {
    return apiError('noSuchUsers', 404, { names: hidden.map((u) => u.username).join(', ') })
  }
  const memberIds = [...new Set([callerId, ...found.map((f) => f.id)])]
  if (memberIds.length < 2) return apiError('needOtherMembers', 400)

  const select = { userId: anime.userId, anilistId: anime.anilistId, genres: anime.genres, tags: anime.tags, status: anime.status, myScore: anime.myScore }
  const allItems = await db.select(select).from(anime).where(inArray(anime.userId, memberIds))
  const vectors = memberIds.map((id) => buildTasteVector(allItems.filter((r) => r.userId === id)))
  const ownedAnilist = new Set(allItems.map((r) => r.anilistId))

  const pool = await db.select({
    anilistId: title.anilistId, titleRomaji: title.titleRomaji, coverUrl: title.coverUrl,
    slug: title.slug, genres: title.genres, tags: title.tags,
  }).from(title)
    // pool = a katalógus AniList-pontszám szerinti krémje (a belső popularity/communityScore
    // kis instancián még üres/torz lenne)
    .where(and(eq(title.mediaType, 'ANIME'), eq(title.isAdult, 0), isNotNull(title.avgScore)))
    .orderBy(desc(title.avgScore))
    .limit(POOL_SIZE)

  const picks = rankGroupPicks(
    vectors,
    pool.filter((p) => !ownedAnilist.has(p.anilistId)),
  )

  const memberNames = memberIds.map((id) =>
    id === callerId ? 'te' : (found.find((f) => f.id === id)?.username ?? `#${id}`))

  return NextResponse.json({
    members: memberNames,
    picks: picks.map((p) => ({
      anilistId: p.candidate.anilistId,
      title: p.candidate.titleRomaji,
      coverUrl: p.candidate.coverUrl,
      slug: p.candidate.slug,
      groupScore: p.groupScore,
      perMember: p.perMember,
    })),
  })
}
