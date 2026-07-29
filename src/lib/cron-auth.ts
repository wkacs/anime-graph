export type CronAuthResult = 'ok' | 'unauthorized' | 'misconfigured'

// A cron endpoint sosem lehet nyilvanos: a hianyzó secret konfiguracios hiba,
// nem pedig engedely a futasra.
export function authorizeCron(secret: string | undefined, authorization: string | null): CronAuthResult {
  if (!secret) return 'misconfigured'
  return authorization === `Bearer ${secret}` ? 'ok' : 'unauthorized'
}
