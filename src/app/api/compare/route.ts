import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { anime, settings, title, users } from '@/db/schema'
import { fetchUserList } from '@/lib/anilist'
import { compareLists, type TheirEntry } from '@/lib/compare'
import { requireUserId } from '@/lib/session'
import { canViewProfile } from '@/lib/profile-visibility'
import { and, eq } from 'drizzle-orm'
import { apiError } from '@/lib/api-error'

export async function POST(req: NextRequest) {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const username = String(body?.username ?? '').trim()
  const internalUsername = String(body?.internalUsername ?? '').trim()
  if (!username && !internalUsername) {
    return apiError('usernameRequired', 400)
  }

  let theirs: TheirEntry[]
  let displayName: string
  let otherUserId: number | null = null

  if (internalUsername) {
    // belső mód: regisztrált user listája a DB-ből (csak lista-szintű adatok,
    // vélemény/taste_memory SOSEM kerül a válaszba)
    const [other] = await db.select().from(users).where(eq(users.username, internalUsername))
    if (!other) return apiError('noSuchUser', 404)
    if (other.id === userId) {
      return apiError('cannotCompareSelf', 400)
    }
    const [visibility] = await db.select({ value: settings.value }).from(settings)
      .where(and(eq(settings.userId, other.id), eq(settings.key, 'profileVisibility')))
    // Ugyanaz a 404, mint ismeretlen névnél: a privát profil létezését sem
    // szabad az API-nak elárulnia.
    if (!canViewProfile(userId, other.id, visibility?.value)) {
      return apiError('noSuchUser', 404)
    }
    const otherRows = await db.select({
      anilistId: anime.anilistId,
      titleRomaji: anime.titleRomaji,
      coverUrl: anime.coverUrl,
      myScore: anime.myScore,
    }).from(anime)
      .innerJoin(title, eq(title.id, anime.titleId))
      .where(and(
        eq(anime.userId, other.id),
        eq(anime.mediaType, 'ANIME'),
        eq(title.isAdult, 0),
      ))
    if (!otherRows.length) {
      return apiError('otherUserEmptyList', 404)
    }
    theirs = otherRows.map((r) => ({
      anilistId: r.anilistId,
      title: r.titleRomaji,
      coverUrl: r.coverUrl,
      score: r.myScore,
    }))
    displayName = internalUsername
    otherUserId = other.id
  } else {
    let entries
    try {
      entries = await fetchUserList(username)
    } catch (e) {
      return NextResponse.json({ error: `AniList: ${String(e)}` }, { status: 502 })
    }
    if (!entries.length) {
      return apiError('emptyOrPrivateList', 404)
    }
    theirs = entries.map((e) => ({
      anilistId: e.media.id,
      title: e.media.title.romaji,
      coverUrl: e.media.coverImage?.large ?? null,
      score: e.score && e.score >= 1 ? Math.round(e.score) : null,
    }))
    displayName = username
  }

  const rows = await db.select().from(anime)
    .where(and(eq(anime.userId, userId), eq(anime.mediaType, 'ANIME')))
  const mine = rows.map((r) => ({
    anilistId: r.anilistId,
    title: r.titleRomaji,
    coverUrl: r.coverUrl,
    myScore: r.myScore,
  }))

  return NextResponse.json({ username: displayName, otherUserId, ...compareLists(mine, theirs) })
}
