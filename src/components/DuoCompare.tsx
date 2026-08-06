'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Reveal } from '@/components/ui/Reveal'
import { isValidAnilistUsername } from '@/lib/taste-scan'
import type { CompareResult } from '@/lib/compare'

type Result = CompareResult & { a: string; b: string }

// Az eredmeny SZANDEKOSAN reszleges: atfedes, kozos kedvencek es par ajanlas.
// A teljes kozos graf a regisztracio mogott van — ha itt mindent megadnank,
// a link nem vezetne sehova.
const MAX_SHOWN = 6

export default function DuoCompare({ inviter }: { inviter: string }) {
  const t = useTranslations('duo')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const valid = isValidAnilistUsername(name.trim())
  const same = name.trim().toLowerCase() === inviter.toLowerCase()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || same || busy) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/duo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: inviter, b: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error ?? t('genericError'))
      else setResult(json)
    } catch {
      setError(t('genericError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Reveal>
        <form onSubmit={submit} className="mt-8 flex flex-wrap items-center gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            className="surface-1 min-w-0 flex-1 rounded-[var(--r-md)] px-4 py-3 text-text-1 placeholder:text-text-3 outline-none focus-visible:ring-2 focus-visible:ring-white/25"
          />
          <button
            type="submit"
            disabled={!valid || same || busy}
            className="btn-solid px-5 py-3 disabled:opacity-40"
          >
            {busy ? t('working') : t('submit')}
          </button>
        </form>
        {same && <p className="mt-3 text-xs text-text-3">{t('sameName')}</p>}
        {error && <p className="mt-4 text-sm" style={{ color: 'var(--status-dropped)' }}>{error}</p>}
      </Reveal>

      {result && (
        <div className="mt-12 flex flex-col gap-8">
          <Reveal>
            <div className="glass rounded-[var(--r-lg)] p-6">
              <p className="label-mono">{t('resultKicker', { a: result.a, b: result.b })}</p>
              <p className="display-l mt-2 text-text-1">{result.overlapPct}%</p>
              <p className="mt-1 text-sm text-text-2">
                {/* `mine` a kepernyo elott ulo (b) listaja: a /api/duo a
                    MEGHIVOTTAT adja a compareLists „mine" oldalanak. */}
                {t('resultMeta', {
                  common: result.commonCount, mine: result.mineCount, theirs: result.theirsCount,
                })}
              </p>
            </div>
          </Reveal>

          {result.commonFavorites.length > 0 && (
            <Reveal>
              <p className="label-mono">{t('commonFavorites')}</p>
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {result.commonFavorites.slice(0, MAX_SHOWN).map((c) => (
                  <div key={c.anilistId} className="min-w-0">
                    <div className="glass-lite relative aspect-[2/3] overflow-hidden rounded-[var(--r-sm)]">
                      {c.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <p className="mt-2 truncate text-xs text-text-2">{c.title}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          {result.theyRecommend.length > 0 && (
            <Reveal>
              <p className="label-mono">{t('theyRecommend', { username: result.a })}</p>
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {result.theyRecommend.slice(0, MAX_SHOWN).map((c) => (
                  <div key={c.anilistId} className="min-w-0">
                    <div className="glass-lite relative aspect-[2/3] overflow-hidden rounded-[var(--r-sm)]">
                      {c.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <p className="mt-2 truncate text-xs text-text-2">{c.title}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          <Reveal>
            <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-[var(--r-lg)] p-6">
              <div className="max-w-md">
                <p className="h2 text-text-1">{t('ctaTitle')}</p>
                <p className="mt-1.5 text-sm text-text-2">{t('ctaText')}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/scan/${result.b}`} className="btn-ghost surface-1 px-5 py-3">
                  {t('ownScanCta')}
                </Link>
                <Link href="/login" className="btn-solid px-5 py-3">{t('ctaButton')}</Link>
              </div>
            </div>
          </Reveal>
        </div>
      )}
    </>
  )
}
