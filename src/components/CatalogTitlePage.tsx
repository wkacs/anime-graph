import { notFound } from 'next/navigation'
import Link from 'next/link'
import { canonicalPath, pickSourceRelation, resolveAnyRelationLocal, resolveRelationLocal, resolveTitleBySlug } from '@/lib/catalog-page'
import { getCachedStaff } from '@/lib/staff-cache'
import { buildTitleJsonLd, jsonLdScript, siteUrl } from '@/lib/seo'
import { stripHtml } from '@/lib/description'
import OwnerOverlay from '@/components/OwnerOverlay'
import FitBadge from '@/components/FitBadge'
import PosterAmbient from '@/components/ui/PosterAmbient'
import SectionHeader from '@/components/ui/SectionHeader'
import Chip from '@/components/ui/Chip'
import MediaCard from '@/components/MediaCard'
import T from '@/components/T'
import TitleTour from '@/components/TitleTour'
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
  // Adult content is not served on public canonical URLs. A later, explicit
  // age-verified mode may opt in, but the launch-safe default is exclusion.
  if (!t || t.isAdult) notFound()

  // A mertekegyseges chipek `<T>`-vel mennek: az oldal ISR-elt szerver-komponens,
  // ott nincs `useTranslations` — a `<T>` a kliensen hidratal a nezo nyelvere.
  const chips: { key: string; node: React.ReactNode }[] = []
  if (t.year != null) chips.push({ key: 'year', node: String(t.year) })
  if (t.format) chips.push({ key: 'format', node: t.format })
  if (t.mediaType === 'MANGA') {
    if (t.chapters != null) chips.push({ key: 'count', node: <T ns="catalog" k="chapterCount" values={{ count: t.chapters }} /> })
    else if (t.volumes != null) chips.push({ key: 'count', node: <T ns="catalog" k="volumeCount" values={{ count: t.volumes }} /> })
  } else if (t.episodes != null) {
    chips.push({ key: 'count', node: <T ns="catalog" k="episodeCount" values={{ count: t.episodes }} /> })
  }
  if (t.mediaType !== 'MANGA' && t.durationMin != null) {
    chips.push({ key: 'duration', node: <T ns="catalog" k="minuteCount" values={{ count: t.durationMin }} /> })
  }
  if (t.avgScore != null) chips.push({ key: 'avg', node: `AniList ${t.avgScore}%` })
  if (t.communityScore != null) {
    chips.push({ key: 'community', node: `★ ${t.communityScore.toFixed(1)} (${t.communityCount})` })
  }

  // eredeti mű / adaptáció kiemelése + stáb (api_cache-elt AniList-query, hibánál üres)
  const sourceRel = pickSourceRelation(t.relations, t.mediaType === 'MANGA' ? 'MANGA' : 'ANIME')
  const sourceLocal = sourceRel
    ? await resolveRelationLocal(sourceRel.anilistId, t.mediaType === 'MANGA' ? 'ANIME' : 'MANGA')
    : null
  const staff = await getCachedStaff(t.anilistId, t.mediaType)
  const otherRelations = sourceRel
    ? t.relations.filter((r) => !(r.type === sourceRel.type && r.anilistId === sourceRel.anilistId))
    : t.relations
  const localRelations = await Promise.all(otherRelations.map(async (relation) => ({
    relation,
    local: await resolveAnyRelationLocal(relation.anilistId),
  })))

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
              {/* text-2, nem text-3: az eredeti cím valódi tartalom, ráadásul
                  a poszter-ambiens fölött áll, ahol a text-3 nem AA-biztos. */}
              {t.titleNative && (
                <p className="font-jp text-text-2 mt-2 text-lg">{t.titleNative}</p>
              )}
              {t.titleEnglish && t.titleEnglish !== t.titleRomaji && (
                <p className="text-text-2 text-sm mt-1">{t.titleEnglish}</p>
              )}

              <div className="flex flex-wrap gap-1.5 mt-5">
                {chips.map((chip) => (
                  <Chip key={chip.key}>{chip.node}</Chip>
                ))}
                {t.studio && (
                  <Chip
                    variant="link"
                    href={`/bongeszo?studio=${encodeURIComponent(t.studio)}`}
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
        <TitleTour />
        <OwnerOverlay
          titleId={t.id}
          watchlistMeta={{ anilistId: t.anilistId, title: t.titleRomaji, coverUrl: t.coverUrl, mediaType: t.mediaType }}
        />

        {t.description && (
          <section>
            <SectionHeader title={<T ns="catalog" k="synopsis" />} />
            <p className="text-[15px] text-text-1 leading-[1.75] max-w-[62ch]">{stripHtml(t.description)}</p>
          </section>
        )}

        {sourceRel && (
          <section>
            <SectionHeader
              eyebrow={<T ns="catalog" k={t.mediaType === 'MANGA' ? 'adaptationEyebrow' : 'sourceEyebrow'} />}
              title={<T ns="catalog" k={t.mediaType === 'MANGA' ? 'adaptationTitle' : 'sourceTitle'} />}
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
                  <T ns="catalog" k="open" />
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
            <SectionHeader title={<T ns="catalog" k="staff" />} />
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

        {localRelations.length > 0 && (
          <section>
            <SectionHeader title={<T ns="catalog" k="otherParts" />} />
            <ul className="surface-1 rounded-[var(--r-lg)] p-2 flex flex-col">
              {localRelations.map(({ relation: r, local }) => (
                <li key={`${r.type}-${r.anilistId}`}>
                  <MediaCard
                    variant="row"
                    title={r.title}
                    coverUrl={null}
                    genres={[r.type.toLowerCase().replace('_', ' ')]}
                    href={local ? canonicalPath(local.mediaType, local.slug) : undefined}
                    footer={local ? (
                      <Link href={canonicalPath(local.mediaType, local.slug)} className="label-mono hover:text-text-1">Megnyitás →</Link>
                    ) : (
                      <a href={`https://anilist.co/anime/${r.anilistId}`} target="_blank" rel="noreferrer" className="label-mono hover:text-text-1">AniList ↗</a>
                    )}
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
