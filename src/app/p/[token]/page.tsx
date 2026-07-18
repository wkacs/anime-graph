'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'

type PublicData = {
  username: string | null
  stats: { total: number; completed: number; topGenres: { name: string; count: number }[] }
  anime: { title: string; coverUrl: string | null; status: string; myScore: number | null; year: number | null }[]
}

export default function PublicProfilePage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/public/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Hiba')
        setData(await r.json())
      })
      .catch((e) => setError(String(e.message ?? e)))
  }, [token])

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-3xl px-10 py-12 text-center">
          <p className="label-mono mb-2">Anime Graph</p>
          <p className="text-sm text-text-2">{error}</p>
        </div>
      </main>
    )
  }
  if (!data) return null

  return (
    <main className="min-h-screen max-w-4xl mx-auto px-4 pt-24 pb-16 flex flex-col gap-6">
      <div>
        <p className="label-mono mb-1">アニメグラフ · {data.username ?? 'megosztott'} gyűjteménye</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {data.stats.total} anime · {data.stats.completed} befejezve
        </h1>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {data.stats.topGenres.map((g) => (
            <span key={g.name} className="rounded-full border border-white/12 px-3 py-1 text-xs text-text-2">
              {g.name} · {g.count}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {data.anime.map((a, i) => (
          <figure key={`${a.title}-${i}`} className="min-w-0">
            {a.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.coverUrl} alt={a.title} className="w-full aspect-[2/3] object-cover rounded-xl border border-white/8" />
            ) : (
              <div className="w-full aspect-[2/3] rounded-xl bg-white/5" />
            )}
            <figcaption className="mt-1.5">
              <p className="text-[11px] leading-tight truncate">{a.title}</p>
              <p className="flex items-center gap-1 mt-0.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: STATUS_CSS_VARS[a.status] ?? 'white' }}
                />
                <span className="label-mono !text-[9px]">
                  {STATUS_LABELS[a.status] ?? a.status}{a.myScore != null ? ` · ${a.myScore}` : ''}
                </span>
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  )
}
