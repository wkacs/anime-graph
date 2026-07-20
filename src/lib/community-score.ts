// MAL-style weighted rating: low-vote titles are pulled toward the global mean
// so a single 10/10 does not top the chart. prior = strength of that pull.
export function bayesianScore(
  sum: number, n: number, globalMean: number, prior = 10,
): number | null {
  if (n <= 0) return null
  return (prior * globalMean + sum) / (prior + n)
}
