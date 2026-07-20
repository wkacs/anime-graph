'use client'
import { useEffect, useState } from 'react'

// Streaming links for a title, fetched client-side by anilistId (public data;
// kept out of the cached server shell so the shell stays fast + viewer-independent).
export default function StreamLinks({ anilistId }: { anilistId: number }) {
  const [links, setLinks] = useState<{ site: string; url: string }[]>([])
  useEffect(() => {
    fetch(`/api/links/${anilistId}`)
      .then((r) => r.json())
      .then((j) => setLinks(j.links ?? []))
      .catch(() => { /* linkek nélkül is él az oldal */ })
  }, [anilistId])
  if (!links.length) return null
  return (
    <>
      {links.map((l) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank" rel="noreferrer"
          className="rounded-full border border-white/15 px-3 py-1 text-xs text-text-1 hover:bg-white/10 transition-colors"
        >
          ▶ {l.site}
        </a>
      ))}
    </>
  )
}
