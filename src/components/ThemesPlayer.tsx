'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AnimeTheme } from '@/lib/themes'

// OP/ED player (animethemes.moe), trailer fallback. Client-side by anilistId.
export default function ThemesPlayer({
  anilistId, trailerSite, trailerId, titleRomaji, bannerUrl,
}: {
  anilistId: number
  trailerSite: string | null
  trailerId: string | null
  titleRomaji: string
  bannerUrl: string | null
}) {
  const [themes, setThemes] = useState<AnimeTheme[]>([])
  const [active, setActive] = useState<AnimeTheme | null>(null)
  const t = useTranslations('themes')

  useEffect(() => {
    fetch(`/api/themes/${anilistId}`)
      .then((r) => r.json())
      .then((j) => { setThemes(j.themes ?? []); setActive((j.themes ?? [])[0] ?? null) })
      .catch(() => { /* marad a trailer-fallback */ })
  }, [anilistId])

  return (
    <section className="glass rounded-3xl p-5">
      <p className="label-mono mb-3">{themes.length ? t('openingsEndings') : t('openingTrailer')}</p>
      {themes.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {themes.map((t) => (
              <button
                key={t.slug}
                onClick={() => setActive(t)}
                className={`rounded-full px-3 py-1 text-xs font-mono transition-colors ${
                  active?.slug === t.slug ? 'bg-white text-black font-semibold' : 'bg-white/6 text-text-2 hover:bg-white/12'
                }`}
              >
                {t.slug}
              </button>
            ))}
          </div>
          {active && (
            <>
              <video
                key={active.videoUrl}
                src={active.videoUrl}
                controls
                preload="none"
                poster={bannerUrl ?? undefined}
                className="w-full aspect-video rounded-2xl bg-black"
              />
              {active.song && (
                <p className="label-mono mt-2">
                  {active.song}{active.artist ? ` — ${active.artist}` : ''}
                </p>
              )}
            </>
          )}
        </>
      ) : trailerSite === 'youtube' && trailerId ? (
        <iframe
          className="w-full aspect-video rounded-2xl"
          src={`https://www.youtube-nocookie.com/embed/${trailerId}`}
          title="Trailer"
          loading="lazy"
          allowFullScreen
        />
      ) : (
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(titleRomaji + ' opening')}`}
          target="_blank" rel="noreferrer"
          className="text-sm text-text-2 hover:text-text-1 underline underline-offset-4 decoration-white/20"
        >{t('searchOnYoutube')}</a>
      )}
    </section>
  )
}
