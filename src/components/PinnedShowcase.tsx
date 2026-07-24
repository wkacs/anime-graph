import Link from 'next/link'
import type { PublicPinned } from '@/lib/public-view'

// Kitűzött kedvencek sávja — a publikus profil hero-ja és a saját stats teteje
// ugyanazt a megjelenítést kapja. linkable=false a publikus nézeten (ott nincs kattintás-cél).
export default function PinnedShowcase({ pinned, linkable = true }: { pinned: PublicPinned; linkable?: boolean }) {
  if (pinned.titles.length === 0 && pinned.chars.length === 0) return null
  return (
    <section className="glass rounded-3xl p-5 flex flex-wrap items-center gap-6">
      {pinned.titles.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="label-mono shrink-0">📌 Kedvencek</span>
          <div className="flex gap-2">
            {pinned.titles.map((t) => {
              const img = t.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.coverUrl} alt={t.title} title={t.title}
                  className="w-14 aspect-[2/3] object-cover rounded-xl border border-white/12 shadow-lg" />
              ) : (
                <div title={t.title} className="w-14 aspect-[2/3] rounded-xl bg-white/5" />
              )
              return linkable ? (
                <Link key={`${t.mediaType}-${t.slug}`} href={`/${t.mediaType === 'MANGA' ? 'manga' : 'anime'}/${t.slug}`}>
                  {img}
                </Link>
              ) : (
                <span key={`${t.mediaType}-${t.slug}`}>{img}</span>
              )
            })}
          </div>
        </div>
      )}
      {pinned.chars.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="label-mono shrink-0">Karakterek</span>
          <div className="flex gap-2">
            {pinned.chars.map((c) => (
              c.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={c.name} src={c.image} alt={c.name} title={c.name}
                  className="w-11 h-11 rounded-full object-cover border border-white/12" />
              ) : (
                <span key={c.name} title={c.name} className="w-11 h-11 rounded-full bg-white/5 inline-flex items-center justify-center text-xs text-text-3">
                  {c.name.slice(0, 2)}
                </span>
              )
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
