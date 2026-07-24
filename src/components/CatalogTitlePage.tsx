import { notFound } from 'next/navigation'
import Link from 'next/link'
import { canonicalPath, pickSourceRelation, resolveRelationLocal, resolveTitleBySlug } from '@/lib/catalog-page'
import { getCachedStaff } from '@/lib/staff-cache'
import { buildTitleJsonLd, jsonLdScript, siteUrl } from '@/lib/seo'
import { stripHtml } from '@/lib/description'
import OwnerOverlay from '@/components/OwnerOverlay'
import FitBadge from '@/components/FitBadge'
import TourSpotlight from '@/components/TourSpotlight'
import type { TourStep } from '@/lib/tour'

const TITLE_TOUR: TourStep[] = [
  { selector: 'fit', title: 'Neked való?', text: 'Az ízlésedből számolt egyezés — mellette/ellene érvekkel, és ha hasonlókat szoktál dobni, arra is figyelmeztet.' },
  { selector: 'opinion', title: 'Vélemény = a rendszer lelke', text: 'Írd le szabadon, mi tetszett és mi nem — az AI ízlés-tényeket nyer ki belőle, és ettől lesz egyre pontosabb minden ajánlás.' },
]
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
    t.avgScore != null ? `AniList ${t.avgScore}%` : null,
    t.communityScore != null ? `★ ${t.communityScore.toFixed(1)} (${t.communityCount})` : null,
  ].filter(Boolean) as string[]

  // eredeti mű / adaptáció kiemelése + stáb (api_cache-elt AniList-query, hibánál üres)
  const sourceRel = pickSourceRelation(t.relations, t.mediaType === 'MANGA' ? 'MANGA' : 'ANIME')
  const sourceLocal = sourceRel
    ? await resolveRelationLocal(sourceRel.anilistId, t.mediaType === 'MANGA' ? 'ANIME' : 'MANGA')
    : null
  const staff = await getCachedStaff(t.anilistId, t.mediaType)
  const otherRelations = sourceRel
    ? t.relations.filter((r) => !(r.type === sourceRel.type && r.anilistId === sourceRel.anilistId))
    : t.relations

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
              {t.studio && (
                <Link
                  href={`/bongeszo?studio=${encodeURIComponent(t.studio)}`}
                  title={`További ${t.studio}-címek a böngészőben`}
                  className="glass rounded-full px-3 py-1 text-xs font-mono text-text-2 hover:text-text-1 transition-colors"
                >
                  {t.studio} →
                </Link>
              )}
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
        <TourSpotlight page="title" steps={TITLE_TOUR} />
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

        {sourceRel && (
          <section className="glass rounded-3xl p-5">
            <p className="label-mono mb-3">{t.mediaType === 'MANGA' ? 'Anime-adaptáció' : 'Eredeti mű'}</p>
            <div className="flex items-center gap-4">
              {sourceLocal?.coverUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={sourceLocal.coverUrl} alt="" className="w-16 aspect-[2/3] object-cover rounded-xl border border-white/10 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{sourceRel.title}</p>
                <p className="text-xs text-text-3 mt-0.5">{t.mediaType === 'MANGA' ? 'ebből készült az anime-változat' : 'ebből készült ez a feldolgozás'}</p>
              </div>
              {sourceLocal ? (
                <Link
                  href={canonicalPath(sourceLocal.mediaType, sourceLocal.slug)}
                  className="btn-ghost border border-white/10 px-3.5 py-1.5 text-xs shrink-0"
                >
                  Megnyitás →
                </Link>
              ) : (
                <a
                  href={`https://anilist.co/${t.mediaType === 'MANGA' ? 'anime' : 'manga'}/${sourceRel.anilistId}`}
                  target="_blank" rel="noreferrer"
                  className="btn-ghost border border-white/10 px-3.5 py-1.5 text-xs shrink-0"
                >
                  AniList ↗
                </a>
              )}
            </div>
          </section>
        )}

        <CharacterGrid anilistId={t.anilistId} readOnly />

        {staff.length > 0 && (
          <section className="glass rounded-3xl p-5">
            <p className="label-mono mb-3">Stáb</p>
            <div className="flex flex-wrap gap-4">
              {staff.map((s) => (
                <div key={s.staffId} className="flex items-center gap-2.5">
                  {s.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.image} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight">{s.name}</p>
                    <p className="text-[10px] text-text-3 leading-tight">{s.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <ThemesPlayer
          anilistId={t.anilistId}
          trailerSite={t.trailerSite}
          trailerId={t.trailerId}
          titleRomaji={t.titleRomaji}
          bannerUrl={t.bannerUrl}
        />

        {otherRelations.length > 0 && (
          <section className="glass rounded-3xl p-5">
            <p className="label-mono mb-3">Kapcsolódó</p>
            <ul className="flex flex-col gap-1.5">
              {otherRelations.map((r) => (
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
