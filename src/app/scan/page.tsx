'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import PageShell from '@/components/ui/PageShell'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/Reveal'
import ScanConstellation from '@/components/ScanConstellation'
import {
  isValidAnilistUsername, DOMINANT_ISLAND_SHARE, type ScanInsight, type ScanResult,
} from '@/lib/taste-scan'

type Result = ScanResult & { username: string }

// Taste Scan: a hidegindito. Egy kerdes, fiok nelkul, es a valasz mar mond
// valamit a felhasznalorol. A teljes graf, a mentes es a tanulas tudatosan
// marad a regisztracio mogott — ami itt kimegy, az onmagaban is erjen valamit.
export default function ScanPage() {
  const t = useTranslations('scan')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const valid = isValidAnilistUsername(name.trim())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.trim() }),
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

  // Az allitasokat a lib adja strukturaltan, a szoveg itt szuletik: igy a
  // szamok es a fogalmazas nem csusznak szet, es forditani is lehet.
  function insightText(i: ScanInsight): string {
    switch (i.kind) {
      case 'islands':
        return i.dominant
          ? t('insightIslandsDominant', { name: i.dominant, count: i.count - 1 })
          : t('insightIslands', { count: i.count, names: i.names.join(' · ') })
      case 'signature':
        return t('insightSignature', { feature: i.feature, lift: i.lift })
      case 'topStudio':
        return t('insightStudio', { studio: i.studio, count: i.count })
      case 'rating':
        return t(i.direction === 'harsh' ? 'insightHarsh' : 'insightGenerous', { delta: i.delta })
      case 'niche':
        return t(i.score >= 60 ? 'insightNiche' : 'insightMainstream', { score: i.score })
    }
  }

  return (
    <PageShell width="default">
      <Reveal>
        <p className="label-mono">{t('eyebrow')}</p>
        <h1 className="display-l mt-3 text-balance text-silver">{t('title')}</h1>
        <p className="mt-4 max-w-xl text-text-2 leading-relaxed">{t('lead')}</p>
      </Reveal>

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
          <button type="submit" disabled={!valid || busy} className="btn-solid px-5 py-3 disabled:opacity-40">
            {busy ? t('working') : t('submit')}
          </button>
        </form>
        <p className="mt-3 text-xs text-text-3">{t('privacy')}</p>
        {error && <p className="mt-4 text-sm" style={{ color: 'var(--status-dropped)' }}>{error}</p>}
      </Reveal>

      {result && (
        <div className="mt-14 flex flex-col gap-10">
          <Reveal>
            <div className="glass grid gap-6 rounded-[var(--r-lg)] p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:items-center">
              <div>
                <p className="label-mono">{t('resultKicker', { username: result.username })}</p>
                <p className="h2 mt-2 text-text-1">
                  {result.islands[0] && result.islands[0].share >= DOMINANT_ISLAND_SHARE
                    ? t('resultTitleDominant', { name: result.islands[0].name })
                    : t('resultTitle', { count: result.islands.length })}
                </p>
                <p className="mt-2 text-sm text-text-2">
                  {t('resultMeta', { sample: result.sample, rated: result.rated })}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {result.islands.map((isl) => (
                    <span key={isl.name} className="surface-2 rounded-full px-3 py-1.5 text-xs text-text-1">
                      {isl.name}
                      <span className="ml-1.5 font-mono text-text-3">{Math.round(isl.share * 100)}%</span>
                    </span>
                  ))}
                </div>

                {/* A tengelyek ide, a terkep melle tartoznak: kulon savkent lent
                    egy foltnyi ures hely maradt a kartya bal oldalan. */}
                <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/8 pt-5">
                  {result.loves.length > 0 && (
                    <div>
                      <dt className="label-mono">{t('loves')}</dt>
                      <dd className="mt-1 text-sm text-text-1">{result.loves.join(', ')}</dd>
                    </div>
                  )}
                  {result.avoids.length > 0 && (
                    <div>
                      <dt className="label-mono">{t('avoids')}</dt>
                      <dd className="mt-1 text-sm text-text-2">{result.avoids.join(', ')}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="label-mono">{t('nicheAxis')}</dt>
                    <dd className="mt-1 font-mono text-sm text-text-1">{result.nicheScore}/100</dd>
                  </div>
                </dl>
              </div>
              {/* reszleges graf: a teljes, mozgathato 3D-vaszon a fiok mogott van */}
              <div className="relative mx-auto aspect-square w-full max-w-[320px]">
                <ScanConstellation
                  nodes={result.constellation}
                  edges={result.edges}
                  islands={result.islands}
                />
              </div>
            </div>
          </Reveal>

          <RevealGroup className="grid gap-4 sm:grid-cols-3">
            {result.insights.map((i) => (
              <RevealItem key={i.kind} className="min-w-0">
                <div className="surface-1 h-full rounded-[var(--r-md)] p-5">
                  <p className="label-mono">{t(`insightLabel.${i.kind}`)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-text-1">{insightText(i)}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal>
            <div className="glass flex flex-wrap items-center justify-between gap-4 rounded-[var(--r-lg)] p-6">
              <div className="max-w-md">
                <p className="h2 text-text-1">{t('ctaTitle')}</p>
                <p className="mt-1.5 text-sm text-text-2">{t('ctaText')}</p>
              </div>
              <Link href="/login" className="btn-solid px-5 py-3">{t('ctaButton')}</Link>
            </div>
          </Reveal>
        </div>
      )}
    </PageShell>
  )
}
