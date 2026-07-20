// Blend text relevance with popularity: among similar text matches the more
// popular title wins, but a strong text match still beats a weak one on a
// popular title. Log-damped so blockbusters don't drown out exact matches.
export function rankBlend(textRank: number, popularity: number): number {
  return textRank + Math.log10(Math.max(0, popularity) + 1) * 0.05
}
