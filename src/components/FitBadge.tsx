'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { fitTier, fitConfidence, type FitTier } from '@/lib/fit-score'

type Fit = { score: number; top: { name: string }[]; against: { name: string }[] }
type FitResponse = {
  fit: Fit | null; drop?: Fit | null; authed: boolean
  sample?: number; related?: number
}

// A fokozat viszi a fo informaciot, ezert az kap szint. A 'low' az egyetlen
// elutasito allapot — az 'experimental' szandekosan semleges, mert az „nem
// tipikus neked", nem pedig „rossz".
const TIER_COLOR: Record<FitTier, string> = {
  strong: 'var(--status-watching)',
  mixed: 'var(--text-1)',
  experimental: 'var(--text-2)',
  low: 'var(--status-dropped)',
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
  const tier = fitTier(score)
  // A szamlalok nelkul (regi valaszalak) nem allitunk megbizhatosagot.
  const evidence =
    res.sample != null && res.related != null
      ? { level: fitConfidence(res.sample, res.related), related: res.related }
      : null

  return (
    <section data-tour="fit" className="glass rounded-3xl px-5 py-4">
      {/* A fokozat all elol es nagyobb: egy heurisztikus becslesnel a „Strong fit"
          allitas fedezete megvan, a ket tizedesnyi pontossagot sugallo szazaleke nem. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="label-mono">{t('title')}</span>
        <span className="text-lg font-medium tracking-tight" style={{ color: TIER_COLOR[tier] }}>
          {t(`tier.${tier}`)}
        </span>
        <span className="font-mono text-sm text-text-3">{score}%</span>
      </div>

      {evidence && (
        <p className="mt-1.5 text-xs text-text-3">
          {t(`confidence.${evidence.level}`)} · {t('basedOn', { count: evidence.related })}
        </p>
      )}

      {(top.length > 0 || against.length > 0 || res.drop) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
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
        </div>
      )}
    </section>
  )
}
