import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/db/client'
import { title } from '@/db/schema'
import { fetchMedia } from '@/lib/anilist'
import { stripHtml } from '@/lib/description'
import { canonicalPath } from '@/lib/catalog-page'
import { serverT } from '@/lib/server-i18n'
import PreviewAddButtons from '@/components/PreviewAddButtons'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// listán kívüli cím előnézete AniList-adatból; ha már fent van, átirányít a saját oldalára
export default async function PreviewPage({ params }: { params: Promise<{ anilistId: string }> }) {
  const { anilistId: raw } = await params
  const anilistId = Number(raw)
  if (!Number.isInteger(anilistId) || anilistId <= 0) notFound()

  // in our catalog -> the canonical page serves it (public sections + owner overlay)
  const [cat] = await db.select({ mediaType: title.mediaType, slug: title.slug }).from(title)
    .where(eq(title.anilistId, anilistId)).orderBy(title.mediaType)
  if (cat) redirect(canonicalPath(cat.mediaType, cat.slug))

  // not synced yet -> AniList fallback preview
  const media = await fetchMedia(anilistId, true).catch(() => null)
  if (!media) notFound()

  const isManga = media.type === 'MANGA'
  const desc = stripHtml(media.description)
  // force-dynamic oldal, tehat a felhasznalo nyelven rendelhet (lasd server-i18n)
  const t = await serverT('preview')

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-4 pt-24 pb-24 md:pb-16 flex flex-col gap-6">
      {media.bannerImage && (
        <div className="relative h-40 sm:h-56 rounded-3xl overflow-hidden">
          <Image src={media.bannerImage} alt="" fill sizes="896px" className="object-cover opacity-70" />
        </div>
      )}
      <div className="flex gap-5 items-start">
        {media.coverImage?.large && (
          <div className="relative w-32 sm:w-40 aspect-[2/3] rounded-2xl overflow-hidden shrink-0 glass">
            <Image src={media.coverImage.large} alt={media.title.romaji} fill sizes="160px" className="object-cover" />
          </div>
        )}
        <div className="min-w-0 flex flex-col gap-2">
          <p className="label-mono">{t('kicker')}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight leading-tight">{media.title.romaji}</h1>
          {media.title.english && media.title.english !== media.title.romaji && (
            <p className="text-sm text-text-2">{media.title.english}</p>
          )}
          {media.title.native && <p className="text-sm text-text-3">{media.title.native}</p>}
          <p className="label-mono">
            {[
              media.format,
              media.seasonYear ?? undefined,
              isManga
                ? (media.chapters ? t('chapterCount', { count: media.chapters }) : undefined)
                : (media.episodes ? t('episodeCount', { count: media.episodes }) : undefined),
              media.averageScore != null ? `AniList ${media.averageScore}` : undefined,
            ].filter(Boolean).join(' · ')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {media.genres.map((g) => (
              <span key={g} className="glass rounded-full px-2.5 py-0.5 text-[11px] text-text-2">{g}</span>
            ))}
          </div>
          <div className="mt-2">
            <PreviewAddButtons
              anilistId={anilistId}
              watchlistMeta={{ title: media.title.romaji, coverUrl: media.coverImage?.large ?? null, mediaType: media.type ?? 'ANIME' }}
            />
          </div>
        </div>
      </div>

      {desc && (
        <section className="glass rounded-3xl p-5">
          <p className="label-mono mb-2">{t('description')}</p>
          <p className="text-sm text-text-1 leading-relaxed">{desc}</p>
        </section>
      )}

      {media.trailer?.site === 'youtube' && media.trailer.id && (
        <section className="glass rounded-3xl p-5">
          <p className="label-mono mb-3">Trailer</p>
          <iframe
            className="w-full aspect-video rounded-2xl"
            src={`https://www.youtube-nocookie.com/embed/${media.trailer.id}`}
            title="Trailer"
            loading="lazy"
            allowFullScreen
          />
        </section>
      )}
    </main>
  )
}
