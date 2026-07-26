import { createHash, randomBytes } from 'node:crypto'

// E-mail-megerősítés és jelszó-visszaállítás tokenjei.
// node-only (route-ok) — a middleware sosem importálja.

export type TokenKind = 'verify' | 'reset'

const TTL_SEC: Record<TokenKind, number> = {
  verify: 24 * 3600,
  reset: 3600,
}

/** URL-biztos véletlen token — ez megy a linkbe, ezt SOHA nem tároljuk */
export function newToken(): string {
  return randomBytes(32).toString('base64url')
}

/** csak a hash kerül adatbázisba: szivárgás esetén sem használható fiók-átvételre */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function tokenExpiry(kind: TokenKind, now = new Date()): Date {
  return new Date(now.getTime() + TTL_SEC[kind] * 1000)
}

export function isTokenUsable(
  row: { expiresAt: Date; usedAt: Date | null },
  now = new Date(),
): boolean {
  return row.usedAt == null && row.expiresAt.getTime() > now.getTime()
}
