'use client'
import { useEffect, useState } from 'react'
import type { CharacterEntry } from '@/lib/anilist'

// anime-oldali szereplő-rács: szív-gombbal kedvencelhető karakterek (CV-vel).
// readOnly (publikus katalógus-oldal): csak megjelenítés, nincs kedvencelés
// (a favorite a birtokolt user_title id-t igényli, amit csak az owner-context tud).
export default function CharacterGrid({ anilistId, animeId, readOnly = false }: { anilistId: number; animeId?: number; readOnly?: boolean }) {
  const [characters, setCharacters] = useState<CharacterEntry[]>([])
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/characters/${anilistId}`)
      .then((r) => (r.ok ? r.json() : { characters: [], favoriteIds: [] }))
      .then((j) => {
        setCharacters(j.characters ?? [])
        setFavorites(new Set(j.favoriteIds ?? []))
      })
      .catch(() => { /* szereplők nélkül is él az oldal */ })
      .finally(() => setLoaded(true))
  }, [anilistId])

  async function toggle(c: CharacterEntry) {
    if (animeId == null) return
    const isFav = favorites.has(c.charId)
    // optimista váltás
    setFavorites((s) => {
      const next = new Set(s)
      if (isFav) next.delete(c.charId)
      else next.add(c.charId)
      return next
    })
    const res = await fetch('/api/characters/favorite', {
      method: isFav ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isFav ? { charId: c.charId } : { ...c, animeId }),
    })
    if (!res.ok) {
      // visszagörgetés hibánál
      setFavorites((s) => {
        const next = new Set(s)
        if (isFav) next.add(c.charId)
        else next.delete(c.charId)
        return next
      })
    }
  }

  if (loaded && characters.length === 0) return null

  return (
    <section className="glass rounded-3xl p-5">
      <p className="label-mono mb-3">Szereplők{!readOnly && <span className="text-text-3"> — ♥ a kedvenceid a gráfba kerülnek</span>}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {characters.map((c) => {
          const fav = favorites.has(c.charId)
          return (
            <div key={c.charId} className="relative rounded-2xl overflow-hidden bg-white/4 group">
              <div className="relative aspect-[3/4]">
                {c.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.name} className="absolute inset-0 w-full h-full object-cover" />
                )}
                {!readOnly && (
                  <button
                    onClick={() => toggle(c)}
                    aria-label={fav ? 'Kedvenc törlése' : 'Kedvencnek jelölés'}
                    className={`absolute top-1.5 right-1.5 w-7 h-7 rounded-full glass flex items-center justify-center text-sm transition-colors ${
                      fav ? 'text-[color:var(--status-dropped)]' : 'text-text-2 hover:text-text-1'
                    }`}
                  >
                    {fav ? '♥' : '♡'}
                  </button>
                )}
              </div>
              <div className="p-2">
                <p className="text-[11px] font-medium leading-tight line-clamp-1">{c.name}</p>
                {c.vaName && (
                  <p className="flex items-center gap-1 mt-0.5" title={`Seiyuu: ${c.vaName}`}>
                    {c.vaImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.vaImage} alt="" className="w-4 h-4 rounded-full object-cover shrink-0 border border-white/10" />
                    )}
                    <span className="text-[10px] text-text-3 leading-tight line-clamp-1">{c.vaName}</span>
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
