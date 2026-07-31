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

// A globális számláló a settings táblában lakik, user-sor helyett rendszer-soron.
// A settings.user_id-n NINCS idegen kulcs, a users.id pedig 1-től induló serial,
// ezért a 0 biztonságos szentinel és nem kell hozzá migráció.
export const GLOBAL_QUOTA_USER_ID = 0

/**
 * Napi ÖSSZ-keret minden felhasználóra együtt. A fejenkénti kvóta fölött ül:
 * enélkül a számla lineárisan nő a regisztrálók számával, közös AI-kulcson.
 * Fejlesztésben a hiányzó érték megtartja a korábbi korlátlan viselkedést.
 * Productionben viszont fail-closed: a hiányzó/hibás költségplafon konfigurációs hiba.
 */
export function parseGlobalDailyLimit(value: string | undefined, strict = false): number {
  const raw = Number(value ?? 0)
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw)
  if (strict) {
    throw new Error('AI_GLOBAL_DAILY_LIMIT productionben pozitív egész szám kell legyen')
  }
  return 0
}

export function globalDailyLimit(): number {
  return parseGlobalDailyLimit(
    process.env.AI_GLOBAL_DAILY_LIMIT,
    process.env.NODE_ENV === 'production',
  )
}

export type QuotaVerdict = { allowed: true } | { allowed: false; reason: 'user' | 'global' }

/** Tiszta döntés, hogy a DB-réteg csak számokat adjon be és üzenetet vegyen ki. */
export function quotaVerdict(o: {
  userCount: number; userLimit: number
  globalCount: number; globalLimit: number
}): QuotaVerdict {
  // A globális elsőbbséget élvez: ha a szolgáltatás futott keretbe, az a
  // pontosabb magyarázat, nem az, hogy a user sokat használta.
  if (o.globalLimit > 0 && o.globalCount >= o.globalLimit) return { allowed: false, reason: 'global' }
  if (o.userCount >= o.userLimit) return { allowed: false, reason: 'user' }
  return { allowed: true }
}
