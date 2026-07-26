'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

type Fit = { score: number; top: { name: string }[]; against: { name: string }[] }
type FitResponse = { fit: Fit | null; drop?: Fit | null; authed: boolean }

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--status-watching)'
  if (score >= 45) return 'rgba(255,255,255,0.85)'
  return 'var(--status-dropped)'
}

// „Neked való?" badge a katalógus-oldalon — bejelentkezve valós fit-score,
// anonim látogatónak teaser (konverziós horog a publikus SEO-oldalakon).
export default function FitBadge({ titleId }: { titleId: number }) {
  const t = useTranslations('fit')
  const [res, setRes] = useState<FitResponse | null>(null)

  useEffect(() => {
    fetch(`/api/fit?titleId=${titleId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setRes)
      .catch(() => setRes(null))
  }, [titleId])

  if (!res) return null

  if (!res.authed) {
    return (
      <section data-tour="fit" className="glass rounded-3xl px-5 py-3.5 flex items-center gap-3">
        <span className="label-mono">{t('title')}</span>
        <a href="/login" className="text-sm text-text-2 hover:text-text-1 underline underline-offset-4 decoration-white/20">
          {t('signInTeaser')}
        </a>
      </section>
    )
  }

  if (!res.fit) return null // kevés adat a listán — inkább semmi, mint vak tipp

  const { score, top, against } = res.fit
  return (
    <section data-tour="fit" className="glass rounded-3xl px-5 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className="label-mono">{t('title')}</span>
      <span className="text-xl font-mono font-semibold tracking-tight" style={{ color: scoreColor(score) }}>
        {score}%
      </span>
      {top.length > 0 && (
        <span className="text-xs text-text-2">
          {t('for', { list: top.map((x) => x.name).join(', ') })}
        </span>
      )}
      {against.length > 0 && (
        <span className="text-xs text-text-3">
          {t('against', { list: against.map((x) => x.name).join(', ') })}
        </span>
      )}
      {res.drop && res.drop.score >= 65 && (
        <span
          className="text-xs font-mono"
          style={{ color: 'var(--status-dropped)' }}
          title={t('dropTooltip', { list: res.drop.top.map((x) => x.name).join(', ') })}
        >
          {t('dropRisk', { score: res.drop.score })}
        </span>
      )}
    </section>
  )
}
