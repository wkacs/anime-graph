'use client'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { LOCALES, LOCALE_COOKIE } from '@/lib/locale'

// A választás cookie-ba megy (anonim látogatónak is működik), és belépve
// a users.locale oszlopba is, hogy eszközök között kövessen.
export default function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const current = useLocale()

  async function pick(next: string) {
    if (next === current) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    window.dispatchEvent(new CustomEvent('anime-graph:locale-change', { detail: next }))
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    }).catch(() => { /* anonim latogatonal 401 — a cookie akkor is all */ })
    router.refresh()
  }

  return (
    <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => pick(l)}
          aria-current={l === current}
          className={`px-1.5 py-1 text-[11px] font-mono rounded transition-colors ${
            l === current ? 'text-text-1 bg-white/10' : 'text-text-3 hover:text-text-2'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
