export function eloExpected(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400))
}

export function eloUpdate(winner: number, loser: number, k = 32): { winner: number; loser: number } {
  const exp = eloExpected(winner, loser)
  const delta = k * (1 - exp)
  return { winner: winner + delta, loser: loser - delta }
}

// pick a random anime, then a near-elo opponent (small random pool keeps pairs varied)
export function pickDuelPair<T extends { id: number; elo: number }>(
  rows: T[],
  rand: () => number = Math.random,
): [T, T] | null {
  if (rows.length < 2) return null
  const a = rows[Math.floor(rand() * rows.length)]
  const others = rows
    .filter((r) => r.id !== a.id)
    .sort((x, y) => Math.abs(x.elo - a.elo) - Math.abs(y.elo - a.elo))
  const pool = others.slice(0, Math.min(3, others.length))
  const b = pool[Math.floor(rand() * pool.length)]
  return [a, b]
}
