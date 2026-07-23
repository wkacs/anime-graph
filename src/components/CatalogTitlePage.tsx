import { notFound } from 'next/navigation'
import { canonicalPath, resolveTitleBySlug } from '@/lib/catalog-page'
import { buildTitleJsonLd, jsonLdScript, siteUrl } from '@/lib/seo'
import { stripHtml } from '@/lib/description'
import OwnerOverlay from '@/components/OwnerOverlay'
import FitBadge from '@/components/FitBadge'
import CharacterGrid from '@/components/CharacterGrid'
import ThemesPlayer from '@/components/ThemesPlayer'
import StreamLinks from '@/components/StreamLinks'

// Shared public canonical page for /anime/[slug] and /manga/[slug]. Server-rendered
// and ISR-cached: reads ONLY the public `title` row — no session, no owner data.
// The client OwnerOverlay adds personalized controls in a separate dynamic boundary.
export default async function CatalogTitlePage({
  mediaType, slug,
}: { mediaType: 'ANIME' | 'MANGA'; slug: string }) {
  const t = await resolveTitleBySlug(mediaType, slug)
  if (!t) notFound()

  const countChip = t.mediaType === 'MANGA'
    ? (t.chapters != null ? `${t.chapters} fejezet` : t.volumes != null ? `${t.volumes} kötet` : null)
    : (t.episodes != null ? `${t.episodes} rész` : null)
  const chips = [
    t.year != null ? String(t.year) : null,
    t.format,
    countChip,
    t.mediaType !== 'MANGA' && t.durationMin != null ? `${t.durationMin} perc` : null,
    t.studio,
    t.avgScore != null ? `AniList ${t.avgScore}%` : null,
    t.communityScore != null ? `★ ${t.communityScore.toFixed(1)} (${t.communityCount})` : null,
  ].filter(Boolean) as string[]

  const jsonLd = buildTitleJsonLd(t, `${siteUrl()}${canonicalPath(t.mediaType, t.slug)}`)

  return (
    <main className="min-h-screen pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      {(t.bannerUrl ?? t.coverUrl) && (
        <div className="fixed inset-x-0 top-0 h-[42vh] -z-10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.bannerUrl ?? t.coverUrl!} alt="" className="w-full h-full object-cover opacity-25 blur-2xl scale-110" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#09090b]" />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 pt-28 flex flex-col gap-5">
        <header className="flex flex-col sm:flex-row gap-6">
          {t.coverUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={t.coverUrl} alt="" className="w-40 rounded-2xl border border-white/10 shadow-2xl self-start" />
          )}
          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-3xl font-semibold tracking-tight leading-tight">{t.titleRomaji}</h1>
            {t.titleNative && <p className="text-text-3 mt-1">{t.titleNative}</p>}
            {t.titleEnglish && t.titleEnglish !== t.titleRomaji && (
              <p className="text-text-2 text-sm mt-0.5">{t.titleEnglish}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {chips.map((chip) => (
                <span key={chip} className="glass rounded-full px-3 py-1 text-xs font-mono text-text-2">{chip}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {t.genres.map((g) => (
                <span key={g} className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-2">{g}</span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <StreamLinks anilistId={t.anilistId} />
              <a
                href={`https://anilist.co/${t.mediaType === 'MANGA' ? 'manga' : 'anime'}/${t.anilistId}`}
                target="_blank" rel="noreferrer"
                className="text-xs text-text-2 hover:text-text-1 underline underline-offset-4 decoration-white/20"
              >AniList ↗</a>
            </div>
          </div>
        </header>

        {/* personalized, dynamic — not part of the cached shell */}
        <FitBadge titleId={t.id} />
        <OwnerOverlay
          titleId={t.id}
          watchlistMeta={{ anilistId: t.anilistId, title: t.titleRomaji, coverUrl: t.coverUrl, mediaType: t.mediaType }}
        />

        {t.description && (
          <section className="glass rounded-3xl p-5">
            <p className="label-mono mb-2">Leírás</p>
            <p className="text-sm text-text-1 leading-relaxed">{stripHtml(t.description)}</p>
          </section>
        )}

        <CharacterGrid anilistId={t.anilistId} readOnly />

        <ThemesPlayer
          anilistId={t.anilistId}
          trailerSite={t.trailerSite}
          trailerId={t.trailerId}
          titleRomaji={t.titleRomaji}
          bannerUrl={t.bannerUrl}
        />

        {t.relations.length > 0 && (
          <section className="glass rounded-3xl p-5">
            <p className="label-mono mb-3">Kapcsolódó</p>
            <ul className="flex flex-col gap-1.5">
              {t.relations.map((r) => (
                <li key={`${r.type}-${r.anilistId}`} className="flex items-center gap-3 text-sm">
                  <span className="label-mono w-24 shrink-0">{r.type.toLowerCase().replace('_', ' ')}</span>
                  <a
                    href={`https://anilist.co/anime/${r.anilistId}`}
                    target="_blank" rel="noreferrer"
                    className="text-text-2 hover:text-text-1 truncate"
                  >{r.title}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
