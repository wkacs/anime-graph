import { notFound } from 'next/navigation'
import Link from 'next/link'
import { canonicalPath, pickSourceRelation, resolveRelationLocal, resolveTitleBySlug } from '@/lib/catalog-page'
import { getCachedStaff } from '@/lib/staff-cache'
import { buildTitleJsonLd, jsonLdScript, siteUrl } from '@/lib/seo'
import { stripHtml } from '@/lib/description'
import OwnerOverlay from '@/components/OwnerOverlay'
import FitBadge from '@/components/FitBadge'
import PosterAmbient from '@/components/ui/PosterAmbient'
import SectionHeader from '@/components/ui/SectionHeader'
import Chip from '@/components/ui/Chip'
import MediaCard from '@/components/MediaCard'
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
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      {/* full-bleed kinematografikus hero */}
      <div className="relative">
        {/* a .poster-ambient inset:0-t hasznal, ezert egy meretezett wrapper
            hatarolja — nem Tailwind !important-tal irjuk felul */}
        <div className="absolute inset-x-0 top-0 h-[56vh] overflow-hidden pointer-events-none">
          <PosterAmbient src={t.bannerUrl ?? t.coverUrl} intensity="hero" />
        </div>
        <div className="absolute inset-x-0 top-0 h-[56vh] bg-gradient-to-b from-transparent via-[#09090b]/55 to-[#09090b] pointer-events-none" />

        {/* mobilon nincs felso nav-pill, ezert kevesebb felso levego kell */}
        <div className="relative max-w-5xl mx-auto px-4 pt-16 md:pt-32 pb-8">
          <header className="flex flex-col sm:flex-row gap-7">
            {t.coverUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={t.coverUrl}
                alt=""
                className="w-40 sm:w-48 rounded-[var(--r-lg)] shadow-2xl shadow-black/70 self-start shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="display-xl text-text-1">{t.titleRomaji}</h1>
              {t.titleNative && (
                <p className="font-jp text-text-3 mt-2 text-lg">{t.titleNative}</p>
              )}
              {t.titleEnglish && t.titleEnglish !== t.titleRomaji && (
                <p className="text-text-2 text-sm mt-1">{t.titleEnglish}</p>
              )}

              <div className="flex flex-wrap gap-1.5 mt-5">
                {chips.map((chip) => (
                  <Chip key={chip}>{chip}</Chip>
                ))}
                {t.studio && (
                  <Chip
                    variant="link"
                    href={`/bongeszo?studio=${encodeURIComponent(t.studio)}`}
                    title={`További ${t.studio}-címek a böngészőben`}
                  >
                    {t.studio}
                  </Chip>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {t.genres.map((g) => (
                  <Chip key={g} variant="genre">{g}</Chip>
                ))}
              </div>

              {/* a fit-badge a heroba kerul: a legfontosabb informacio a
                  legerosebb poziciot kapja (korabban kulon kartya volt lejjebb) */}
              <div data-tour="fit" className="mt-5">
                <FitBadge titleId={t.id} />
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
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-24 md:pb-16 flex flex-col gap-14">
        {/* personalized, dynamic — not part of the cached shell */}
        <TourSpotlight page="title" steps={TITLE_TOUR} />
        <OwnerOverlay
          titleId={t.id}
          watchlistMeta={{ anilistId: t.anilistId, title: t.titleRomaji, coverUrl: t.coverUrl, mediaType: t.mediaType }}
        />

        {t.description && (
          <section>
            <SectionHeader eyebrow="Leírás" title="Miről szól" />
            <p className="text-[15px] text-text-1 leading-[1.75] max-w-[62ch]">{stripHtml(t.description)}</p>
          </section>
        )}

        {sourceRel && (
          <section>
            <SectionHeader
              eyebrow={t.mediaType === 'MANGA' ? 'Anime-adaptáció' : 'Eredeti mű'}
              title={t.mediaType === 'MANGA' ? 'Ebből készült az anime' : 'Ebből készült ez a feldolgozás'}
            />
            <div className="surface-1 rounded-[var(--r-lg)] p-3 flex items-center gap-4">
              {sourceLocal?.coverUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={sourceLocal.coverUrl} alt="" className="w-16 aspect-[2/3] object-cover rounded-[var(--r-md)] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium leading-tight">{sourceRel.title}</p>
                <p className="label-mono mt-1">{sourceRel.type.toLowerCase().replace('_', ' ')}</p>
              </div>
              {sourceLocal ? (
                <Link
                  href={canonicalPath(sourceLocal.mediaType, sourceLocal.slug)}
                  className="btn-ghost border border-white/12 px-3.5 py-1.5 text-xs shrink-0"
                >
                  Megnyitás →
                </Link>
              ) : (
                <a
                  href={`https://anilist.co/${t.mediaType === 'MANGA' ? 'anime' : 'manga'}/${sourceRel.anilistId}`}
                  target="_blank" rel="noreferrer"
                  className="btn-ghost border border-white/12 px-3.5 py-1.5 text-xs shrink-0"
                >
                  AniList ↗
                </a>
              )}
            </div>
          </section>
        )}

        <CharacterGrid anilistId={t.anilistId} readOnly />

        {staff.length > 0 && (
          <section>
            <SectionHeader eyebrow="Stáb" title="Kik csinálták" />
            <div className="snap-row no-scrollbar pb-2">
              {staff.map((s) => (
                <div key={s.staffId} className="surface-1 flex items-center gap-2.5 rounded-full pl-1 pr-4 py-1">
                  {s.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.image} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight whitespace-nowrap">{s.name}</p>
                    <p className="label-mono leading-tight">{s.role}</p>
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
          <section>
            <SectionHeader eyebrow="Kapcsolódó" title="A sorozat többi része" />
            <ul className="surface-1 rounded-[var(--r-lg)] p-2 flex flex-col">
              {otherRelations.map((r) => (
                <li key={`${r.type}-${r.anilistId}`}>
                  <MediaCard
                    variant="row"
                    title={r.title}
                    coverUrl={null}
                    genres={[r.type.toLowerCase().replace('_', ' ')]}
                    footer={
                      <a
                        href={`https://anilist.co/anime/${r.anilistId}`}
                        target="_blank" rel="noreferrer"
                        className="label-mono hover:text-text-1"
                      >AniList ↗</a>
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
