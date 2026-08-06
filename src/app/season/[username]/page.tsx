import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { and, eq } from 'drizzle-orm'
import { dbStatic as db } from '@/db/client'
import { title } from '@/db/schema'
import PageShell from '@/components/ui/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/Reveal'
import { loadScanEntries } from '@/lib/scan-service'
import { rankSeason, type SeasonCandidate } from '@/lib/season-fit'
import { currentSeason } from '@/lib/seasonal'

export const dynamic = 'force-dynamic'

// „Ez a szezon a te izlesed szerint." Szezononkent ujraindulo, megoszthato oldal:
// a termek maga termeli a tartalmat, nem kell hozza sem kampany, sem AI-hivas.
//
// A rangsor a LOKALIS katalogusbol megy, a nezo izlese pedig a publikus
// AniList-listajabol — fiok nelkul is teljes ertekű.
//
// 🔴 noindex, mint a tobbi nevre szolo oldal: barmelyik publikus nevre eloall.
const SHOWN = 12

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> },
): Promise<Metadata> {
  const { username } = await params
  const t = await getTranslations('seasonFit')
  const title = t('shareTitle', { username })
  const description = t('shareDescription', { username })
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: false, follow: false },
  }
}

export default async function SeasonFitPage(
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params
  const t = await getTranslations('seasonFit')
  const tc = await getTranslations('browse')
  const loaded = await loadScanEntries(username)

  if (!loaded.ok) {
    return (
      <PageShell width="default">
        <EmptyState
          eyebrow={t('eyebrow')}
          title={t(`error.${loaded.error}`)}
          action={<Link href="/scan" className="btn-solid px-5 py-3">{t('ownCta')}</Link>}
        />
      </PageShell>
    )
  }

  const season = currentSeason(new Date())
  const rows = await db.select({
    anilistId: title.anilistId, slug: title.slug,
    titleRomaji: title.titleRomaji, titleEnglish: title.titleEnglish,
    coverUrl: title.coverUrl, genres: title.genres, tags: title.tags,
  }).from(title).where(and(
    eq(title.mediaType, 'ANIME'),
    eq(title.isAdult, 0),
    eq(title.season, season.season),
    eq(title.year, season.year),
  ))

  const picks = rankSeason(loaded.entries, rows as SeasonCandidate[], SHOWN)
  const seasonName = `${tc(`season_${season.season}`)} ${season.year}`

  return (
    <PageShell width="wide">
      <p className="label-mono">{t('eyebrow')}</p>
      <h1 className="display-l mt-3 text-balance text-silver">
        {t('heading', { username, season: seasonName })}
      </h1>
      <p className="mt-4 max-w-xl leading-relaxed text-text-2">
        {t('lead', { count: rows.length, season: seasonName })}
      </p>

      {picks.length === 0 ? (
        <div className="mt-10">
          <EmptyState title={t('noPicks')} text={t('noPicksText')} />
        </div>
      ) : (
        <RevealGroup className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {picks.map((p) => (
            <RevealItem key={p.anilistId} className="min-w-0">
              <Link href={`/anime/${p.slug}`} className="group block min-w-0">
                <div className="glass-lite relative aspect-[2/3] overflow-hidden rounded-[var(--r-sm)]">
                  {p.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.coverUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                </div>
                <p className="mt-2 truncate text-sm font-medium text-text-1">
                  {p.titleEnglish ?? p.titleRomaji}
                </p>
                {/* a fokozat all elol, a szazalek masodlagos — ugyanaz a szabaly,
                    mint a cimoldali fit-badge-en */}
                <p className="mt-0.5 text-xs text-text-2">
                  {t(`tier.${p.tier}`)}
                  <span className="ml-1.5 font-mono text-text-3">{p.score}%</span>
                </p>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      )}

      <Reveal>
        <div className="glass mt-12 flex flex-wrap items-center justify-between gap-4 rounded-[var(--r-lg)] p-6">
          <div className="max-w-md">
            <p className="h2 text-text-1">{t('ctaTitle')}</p>
            <p className="mt-1.5 text-sm text-text-2">{t('ctaText')}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/scan/${loaded.username}`} className="btn-ghost surface-1 px-5 py-3">
              {t('mapCta')}
            </Link>
            <Link href="/login" className="btn-solid px-5 py-3">{t('ctaButton')}</Link>
          </div>
        </div>
      </Reveal>
    </PageShell>
  )
}
