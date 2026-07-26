// Egy szinskala minden pontszam-badge-hez. Korabban negy helyen volt
// egymastol fuggetlenul masolva, ket kulonbozo kuszobbel.
export type ScoreKind = 'fit' | 'taste'

export const SCORE_THRESHOLDS: Record<ScoreKind, { high: number; mid: number }> = {
  // lokalis fit-becsles: engedobb, mert becsles
  fit: { high: 70, mid: 45 },
  // AI-taste pontszam: szigorubb, mert kevesebb es megfontoltabb
  taste: { high: 75, mid: 50 },
}

export function scoreColor(score: number, kind: ScoreKind = 'fit'): string {
  const { high, mid } = SCORE_THRESHOLDS[kind]
  if (score >= high) return 'var(--status-watching)'
  if (score >= mid) return 'var(--text-1)'
  return 'var(--status-dropped)'
}
