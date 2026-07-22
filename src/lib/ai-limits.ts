export type Tier = 'free' | 'paid'

export const AI_LIMITS: Record<string, { free: number; paid: number }> = {
  recommend: { free: 5, paid: 50 },
  vibe: { free: 10, paid: 100 },
  default: { free: 20, paid: 200 },
}

export function resolveLimit(endpoint: string, tier: Tier): number {
  const row = AI_LIMITS[endpoint] ?? AI_LIMITS.default
  return row[tier]
}
