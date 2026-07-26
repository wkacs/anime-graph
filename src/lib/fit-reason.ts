import type { FitResult } from './fit-score'
import type { Locale } from './locale'

// Ingyenes, őszinte indoklás: a vektor pontosan tudja, MI hozta a pontszámot.
// Nincs modellhívás, tehát kvóta kimerülésekor is működik.
export function fitReason(fit: FitResult, locale: Locale): string {
  const names = (xs: { name: string }[]) => xs.map((x) => x.name).join(', ')
  const parts: string[] = []

  if (locale === 'hu') {
    if (fit.top.length) parts.push(`ezeket szereted: ${names(fit.top)}`)
    if (fit.against.length) parts.push(`viszont ${names(fit.against)} általában nem jön be`)
    return parts.length ? parts.join(' — ') : 'Kevés az adat pontos indokláshoz.'
  }

  if (fit.top.length) parts.push(`you like these: ${names(fit.top)}`)
  if (fit.against.length) parts.push(`but ${names(fit.against)} usually is not your thing`)
  return parts.length ? parts.join(' — ') : 'Not enough data for a precise reason.'
}
