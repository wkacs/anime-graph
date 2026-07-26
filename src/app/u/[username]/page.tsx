import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { users, settings, title as titleTable, favoriteCharacters } from '@/db/schema'
import { toPublicPinned } from '@/lib/public-view'
import PinnedShowcase from '@/components/PinnedShowcase'
import Avatar from '@/components/Avatar'

// force-dynamic + no-store `db`: a profil a friss adatot mutassa. Nem ISR-oldal,
// tehát a DYNAMIC_SERVER_USAGE-korlát (lásd isr-db-client.test.ts) itt nem él.
export const dynamic = 'force-dynamic'

// A pinnedTitles kulcs title.id-kat tárol, a pinnedChars favorite_characters.char_id-kat
// (lásd src/app/api/pins/route.ts) — ugyanazt a két listát olvassuk ki itt is.
async function load(username: string) {
  const [user] = await db.select().from(users)
    .where(eq(users.username, username.toLowerCase()))
  if (!user) return null

  const rows = await db.select().from(settings).where(eq(settings.userId, user.id))
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const ids = (key: string) =>
    Array.isArray(map[key]) ? (map[key] as number[]).filter((n) => Number.isInteger(n)) : []

  const titleIds = ids('pinnedTitles')
  const charIds = ids('pinnedChars')
  const titles = titleIds.length
    ? await db.select({
        titleRomaji: titleTable.titleRomaji, coverUrl: titleTable.coverUrl,
        slug: titleTable.slug, mediaType: titleTable.mediaType,
      }).from(titleTable).where(inArray(titleTable.id, titleIds))
    : []
  const chars = charIds.length
    ? await db.select({ name: favoriteCharacters.name, image: favoriteCharacters.image })
        .from(favoriteCharacters).where(inArray(favoriteCharacters.charId, charIds))
    : []

  return {
    user,
    visibility: (map.profileVisibility as string) ?? 'public',
    pinned: toPublicPinned(titles, chars),
  }
}

// A profil-oldalak szándékosan nincsenek indexelve ebben a körben: üres
// profilokból tízezret indexeltetni ártana, nem használna.
export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> },
): Promise<Metadata> {
  const { username } = await params
  const data = await load(username)
  if (!data || data.visibility !== 'public') {
    return { robots: { index: false, follow: false } }
  }
  return {
    title: `${data.user.username} — Anime Graph`,
    description: data.user.bio ?? `${data.user.username} profile on Anime Graph`,
    robots: { index: false, follow: false },
  }
}

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const data = await load(username)
  // Privát profil 404-et ad, nem 403-at: a 403 elárulná, hogy a felhasználónév létezik.
  if (!data || data.visibility !== 'public') notFound()

  return (
    <main className="min-h-screen pb-24 md:pb-16">
      <div className="max-w-3xl mx-auto px-4 pt-28 flex flex-col gap-6">
        <header className="flex items-center gap-5">
          <Avatar username={data.user.username} size={72} />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{data.user.username}</h1>
            {data.user.bio && (
              <p className="text-sm text-text-2 mt-1 whitespace-pre-line">{data.user.bio}</p>
            )}
          </div>
        </header>

        <PinnedShowcase pinned={data.pinned} />
      </div>
    </main>
  )
}
