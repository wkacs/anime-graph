import { constantTimeEqual } from './auth'

export type CronAuthResult = 'ok' | 'unauthorized' | 'misconfigured'

// A cron endpoint sosem lehet nyilvanos: a hianyzó secret konfiguracios hiba,
// nem pedig engedely a futasra.
export function authorizeCron(secret: string | undefined, authorization: string | null): CronAuthResult {
  if (!secret) return 'misconfigured'
  const expected = `Bearer ${secret}`
  return authorization != null && constantTimeEqual(authorization, expected)
    ? 'ok'
    : 'unauthorized'
}
