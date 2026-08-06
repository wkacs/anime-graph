'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/Reveal'
import ScanConstellation from '@/components/ScanConstellation'
import { DOMINANT_ISLAND_SHARE, type ScanInsight, type ScanResult } from '@/lib/taste-scan'

// Ugyanaz az eredmeny-blokk szolgalja ki a sajat scant es a megosztott linket.
// Ket peldanyban allva a megosztott oldal eszrevetlenul elcsuszna attol, amit a
// megoszto latott — es pont az a link erteke, hogy ugyanazt mutatja.
export default function ScanResultView({
  result, username, shareUrl,
}: {
  result: ScanResult
  username: string
  /** ha van, megjelenik a megoszto sav; a megosztott oldalon nem kell */
  shareUrl?: string
}) {
  const t = useTranslations('scan')
  const td = useTranslations('duo')
  const [copied, setCopied] = useState<'share' | 'invite' | null>(null)
  const dominant = result.islands[0] && result.islands[0].share >= DOMINANT_ISLAND_SHARE
  // A meghivo-link ugyanabbol az origóbol epul, mint a megoszto.
  const inviteUrl = shareUrl?.replace(/\/scan\/[^/]+$/, `/duo/${username}`) ?? ''

  // Az allitasokat a lib adja strukturaltan, a szoveg itt szuletik: igy a szamok
  // es a fogalmazas nem csusznak szet, es forditani is lehet.
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

  async function copy(url: string, which: 'share' | 'invite') {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(which)
      setTimeout(() => setCopied(null), 2500)
    } catch {
      /* a link a gomb mellett szovegkent is ott van */
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <Reveal>
        <div className="glass grid gap-6 rounded-[var(--r-lg)] p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:items-center">
          <div>
            <p className="label-mono">{t('resultKicker', { username })}</p>
            <p className="h2 mt-2 text-text-1">
              {dominant
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

      {shareUrl && (
        <Reveal>
          <div className="flex flex-col gap-3">
            <div className="surface-1 flex flex-wrap items-center justify-between gap-4 rounded-[var(--r-md)] p-5">
              <div className="min-w-0">
                <p className="label-mono">{t('shareLabel')}</p>
                <p className="mt-1 truncate font-mono text-sm text-text-2">{shareUrl}</p>
              </div>
              <button
                onClick={() => copy(shareUrl, 'share')}
                className="btn-ghost surface-2 shrink-0 px-4 py-2.5 text-sm"
              >
                {copied === 'share' ? t('shareCopied') : t('shareCopy')}
              </button>
            </div>

            {/* A meghivo-link a masik iranyba visz: nem rolad szol, hanem
                kettotokrol — ezert van oka a masik felnek is megnyitni. */}
            <div className="surface-1 flex flex-wrap items-center justify-between gap-4 rounded-[var(--r-md)] p-5">
              <div className="min-w-0">
                <p className="label-mono">{td('inviteLabel')}</p>
                <p className="mt-1 text-sm text-text-2">{td('inviteText')}</p>
              </div>
              <button
                onClick={() => copy(inviteUrl, 'invite')}
                className="btn-ghost surface-2 shrink-0 px-4 py-2.5 text-sm"
              >
                {copied === 'invite' ? t('shareCopied') : t('shareCopy')}
              </button>
            </div>
          </div>
        </Reveal>
      )}

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
  )
}
