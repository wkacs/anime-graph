import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { cache } from 'react'
import { getTranslations } from 'next-intl/server'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  anime, episodeLog, favoriteCharacters, settings, title as titleTable, users, userTitle,
} from '@/db/schema'
import { toPublicPinned } from '@/lib/public-view'
import { canViewProfile, profileVisibility } from '@/lib/profile-visibility'
import { sanitizeProfileCustom, type ProfileCustom } from '@/lib/profile-custom'
import { buildProfileStats, type ProfileStats } from '@/lib/profile-stats'
import { buildHeatmapCells, type HeatCell } from '@/lib/heatmap'
import { requireUserId } from '@/lib/session'
import PinnedShowcase from '@/components/PinnedShowcase'
import PageShell from '@/components/ui/PageShell'
import Avatar from '@/components/Avatar'
import { GenreRadar, Bars } from '@/components/charts'
import { STATUS_CSS_VARS } from '@/lib/status'

// force-dynamic + no-store `db`: a profil a friss adatot mutassa. Nem ISR-oldal,
// tehát a DYNAMIC_SERVER_USAGE-korlát (lásd isr-db-client.test.ts) itt nem él.
export const dynamic = 'force-dynamic'

const HEAT_ALPHA = [0.05, 0.22, 0.42, 0.65, 0.95]

// A pinnedTitles kulcs title.id-kat tárol, a pinnedChars favorite_characters.char_id-kat
// (lásd src/app/api/pins/route.ts) — ugyanazt a két listát olvassuk ki itt is.
const load = cache(async (username: string) => {
  const [user] = await db.select().from(users)
    .where(eq(users.username, username.toLowerCase()))
  if (!user) return null

  const rows = await db.select().from(settings).where(eq(settings.userId, user.id))
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const ids = (key: string) =>
    Array.isArray(map[key]) ? (map[key] as number[]).filter((n) => Number.isInteger(n)) : []

  // Mentéskor is a sanitizer fut, de a régi/kézzel írt settings-sor ellen itt is véd.
  const custom = sanitizeProfileCustom(map.profileCustom)

  const titleIds = ids('pinnedTitles')
  const charIds = ids('pinnedChars')
  const titles = titleIds.length
    ? await db.select({
        titleRomaji: titleTable.titleRomaji, coverUrl: titleTable.coverUrl,
        slug: titleTable.slug, mediaType: titleTable.mediaType,
      }).from(titleTable).where(and(inArray(titleTable.id, titleIds), eq(titleTable.isAdult, 0)))
    : []
  const chars = charIds.length
    ? await db.select({ name: favoriteCharacters.name, image: favoriteCharacters.image })
        .from(favoriteCharacters)
        .innerJoin(anime, eq(anime.id, favoriteCharacters.animeId))
        .innerJoin(titleTable, eq(titleTable.id, anime.titleId))
        .where(and(
          eq(favoriteCharacters.userId, user.id),
          inArray(favoriteCharacters.charId, charIds),
          eq(titleTable.isAdult, 0),
        ))
    : []

  // A stat-blokkok alapja: a teljes (nem felnőtt) lista whitelistelt oszlopokkal.
  // Vélemény-szöveg / ízlés-memória ide be sem kerül.
  const listRows = await db.select({
    titleRomaji: titleTable.titleRomaji, coverUrl: titleTable.coverUrl,
    slug: titleTable.slug, mediaType: titleTable.mediaType,
    status: userTitle.status, myScore: userTitle.myScore,
    year: titleTable.year, genres: titleTable.genres,
    durationMin: titleTable.durationMin, episodes: titleTable.episodes,
    progress: userTitle.progress,
  }).from(userTitle)
    .innerJoin(titleTable, eq(titleTable.id, userTitle.titleId))
    .where(and(eq(userTitle.userId, user.id), eq(titleTable.isAdult, 0)))

  const stats = buildProfileStats(listRows)

  // banner: csak saját, nem felnőtt cím bannere lehet (mentéskor is így validálunk)
  let bannerUrl: string | null = null
  if (custom.bannerTitleId != null) {
    const [b] = await db.select({ bannerUrl: titleTable.bannerUrl })
      .from(titleTable)
      .where(and(eq(titleTable.id, custom.bannerTitleId), eq(titleTable.isAdult, 0)))
    bannerUrl = b?.bannerUrl ?? null
  }

  let heatCells: HeatCell[] = []
  if (custom.sections.activity) {
    const logs = await db.select({ watchedAt: episodeLog.watchedAt })
      .from(episodeLog).where(eq(episodeLog.userId, user.id))
    const counts = new Map<string, number>()
    for (const r of logs) {
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest' })
        .format(new Date(r.watchedAt))
      counts.set(date, (counts.get(date) ?? 0) + 1)
    }
    heatCells = buildHeatmapCells(
      [...counts.entries()].map(([date, count]) => ({ date, count })),
      new Date(), 26,
    )
  }

  return {
    user,
    visibility: profileVisibility(map.profileVisibility),
    pinned: toPublicPinned(titles, chars),
    custom,
    bannerUrl,
    stats,
    heatCells,
  }
})

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
  const name = data.custom.displayName ?? data.user.username
  return {
    title: `${name} — Anime Graph`,
    description: data.user.bio ?? `${name} profile on Anime Graph`,
    robots: { index: false, follow: false },
  }
}

function StatValue({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="glass rounded-3xl px-5 py-4">
      <p className="label-mono mb-1.5">{label}</p>
      <p className="text-3xl font-semibold tracking-tight tabular-nums">
        {value}
        {unit && <span className="text-sm font-normal text-text-3 ml-1.5">{unit}</span>}
      </p>
    </div>
  )
}

async function StatsSections({ stats, heatCells, showActivity }: {
  stats: ProfileStats
  heatCells: HeatCell[]
  showActivity: boolean
}) {
  const t = await getTranslations('stats')
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatValue label={t('tileTitles')} value={String(stats.total)} />
        <StatValue label={t('tileWatchedTime')} value={String(stats.watchedHours)} unit={t('hoursUnit')} />
        <StatValue label={t('tileCompleted')} value={String(stats.completed)} />
        <StatValue
          label={t('tileAvgScore')}
          value={stats.avgScore != null ? stats.avgScore.toFixed(1) : '–'}
          unit={stats.avgScore != null ? '/ 10' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stats.topGenres.length >= 3 && (
          <section className="glass rounded-3xl p-5">
            <p className="label-mono mb-2">{t('genreRadar')}</p>
            <GenreRadar data={stats.topGenres} ariaLabel={t('genreRadar')} />
          </section>
        )}
        {stats.scoreDist.some((s) => s.count > 0) && (
          <section className="glass rounded-3xl p-5 flex flex-col">
            <p className="label-mono mb-4">{t('scoreDistribution')}</p>
            <div className="mt-auto">
              <Bars data={stats.scoreDist} ariaLabel={t('scoreDistributionAria')} />
            </div>
          </section>
        )}
      </div>

      {showActivity && heatCells.some((c) => c.count > 0) && (
        <section className="glass rounded-3xl p-5">
          <p className="label-mono mb-4">{t('activity')}</p>
          <div className="overflow-x-auto no-scrollbar">
            <div className="grid grid-rows-7 grid-flow-col gap-[3px] w-max">
              {heatCells.map((c) => (
                <span
                  key={c.date}
                  title={t('heatTooltip', { date: c.date, count: c.count })}
                  className="w-2.5 h-2.5 rounded-[3px]"
                  style={{ background: `rgba(250,250,250,${HEAT_ALPHA[c.level]})` }}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}

async function TopTitles({ stats }: { stats: ProfileStats }) {
  const t = await getTranslations('publicProfile')
  if (stats.topTitles.length === 0) return null
  return (
    <section className="glass rounded-3xl p-5">
      <p className="label-mono mb-4">{t('topTitles')}</p>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {stats.topTitles.map((x) => (
          <Link
            key={`${x.mediaType}-${x.slug}`}
            href={`/${x.mediaType === 'MANGA' ? 'manga' : 'anime'}/${x.slug}`}
            className="group shrink-0 w-24"
          >
            <div className="relative">
              {x.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={x.coverUrl}
                  alt={x.title}
                  loading="lazy"
                  className="w-24 aspect-[2/3] object-cover rounded-[var(--r-sm)] border border-white/10 group-hover:border-white/25 transition-colors"
                />
              ) : (
                <div className="w-24 aspect-[2/3] rounded-[var(--r-sm)] bg-white/5" />
              )}
              <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/75 px-2 py-0.5 font-mono text-xs tabular-nums text-text-1">
                {x.myScore}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-text-2">{x.title}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function accentStyle(custom: ProfileCustom): CSSProperties | undefined {
  // az accent a palettából validált hex — CSS-injekció kizárva
  return custom.accent ? { ['--profile-accent' as string]: custom.accent } : undefined
}

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const [data, viewerId] = await Promise.all([load(username), requireUserId()])
  // Privát profil 404-et ad, nem 403-at: a 403 elárulná, hogy a felhasználónév létezik.
  if (!data || !canViewProfile(viewerId, data.user.id, data.visibility)) notFound()

  const { custom, stats } = data
  const name = custom.displayName ?? data.user.username

  return (
    <PageShell width="default">
      <div style={accentStyle(custom)} className="flex flex-col gap-4">
        {/* Fejléc: a választott cím bannere adja a színt és a hangulatot; accent
            nélkül is él, bannerrel a monokróm shell fölött a tartalom színe szól. */}
        <header className="relative">
          {data.bannerUrl ? (
            <div className="relative h-44 sm:h-60 rounded-[var(--r-lg)] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.bannerUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/35 to-transparent" />
            </div>
          ) : custom.accent ? (
            <div
              aria-hidden
              className="h-24 sm:h-32 rounded-[var(--r-lg)]"
              style={{
                background: `radial-gradient(80% 140% at 50% 0%, color-mix(in srgb, var(--profile-accent) 22%, transparent), transparent 70%)`,
              }}
            />
          ) : null}

          {/* se banner, se accent: nincs üres "hero-doboz", a fejléc-sor önmagában áll */}
          <div className={`flex flex-wrap items-end gap-5 px-2 sm:px-4 relative ${
            data.bannerUrl ? '-mt-12' : custom.accent ? '-mt-10' : 'pt-2'
          }`}>
            <div
              className="rounded-full p-1 bg-[#09090b]"
              style={custom.accent ? { boxShadow: '0 0 0 1px color-mix(in srgb, var(--profile-accent) 45%, transparent), 0 8px 28px -8px color-mix(in srgb, var(--profile-accent) 35%, transparent)' } : undefined}
            >
              <Avatar username={data.user.username} size={88} src={custom.avatarUrl} />
            </div>
            <div className="min-w-0 pb-1">
              <h1 className="display-l text-text-1 leading-none">{name}</h1>
              {/* nem label-mono: az verzálissá tenné a felhasználónevet (@KACS),
                  pedig a handle kisbetűs identitás */}
              <p className="font-mono text-xs tracking-wider text-text-3 mt-2">@{data.user.username}</p>
            </div>
          </div>
        </header>

        {(data.user.bio || custom.favGenres.length > 0) && (
          <section className="px-2 sm:px-4 flex flex-col gap-3">
            {data.user.bio && (
              <p className="text-sm text-text-2 whitespace-pre-line max-w-2xl">{data.user.bio}</p>
            )}
            {custom.favGenres.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {custom.favGenres.map((g) => (
                  <li
                    key={g}
                    className="rounded-full border px-3 py-1 text-xs"
                    style={custom.accent ? {
                      borderColor: 'color-mix(in srgb, var(--profile-accent) 40%, transparent)',
                      color: 'color-mix(in srgb, var(--profile-accent) 80%, white)',
                    } : { borderColor: 'rgba(255,255,255,0.12)', color: 'var(--text-2)' }}
                  >
                    {g}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <PinnedShowcase pinned={data.pinned} />

        {custom.sections.stats && stats.total > 0 && (
          <StatsSections stats={stats} heatCells={data.heatCells} showActivity={custom.sections.activity} />
        )}

        {custom.sections.top && <TopTitles stats={stats} />}

        {/* status breakdown a lap alján: egy pillantásra látszik, mennyi fut / kész */}
        {custom.sections.stats && stats.total > 0 && (
          <section className="glass rounded-3xl p-5">
            <div className="flex h-3 rounded-full overflow-hidden gap-[2px]">
              {stats.statusCounts.filter((s) => s.count > 0).map((s) => (
                <span
                  key={s.status}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${(s.count / stats.total) * 100}%`,
                    background: STATUS_CSS_VARS[s.status],
                  }}
                />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
              {stats.statusCounts.filter((s) => s.count > 0).map((s) => (
                <li key={s.status} className="flex items-center gap-2 text-sm text-text-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: STATUS_CSS_VARS[s.status] }} />
                  <StatusLabel status={s.status} />
                  <span className="font-mono text-xs text-text-3">{s.count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  )
}

async function StatusLabel({ status }: { status: string }) {
  const t = await getTranslations('status')
  return <>{t(status)}</>
}
