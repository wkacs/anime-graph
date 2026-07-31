import { and, eq, gt, isNull, ne } from 'drizzle-orm'
import { db } from '@/db/client'
import { authTokens } from '@/db/schema'
import {
  hashToken, newToken, tokenExpiry, type TokenKind,
} from './auth-token'

export type IssuedAuthToken = {
  id: number
  raw: string
  tokenHash: string
}

export async function issueAuthToken(userId: number, kind: TokenKind): Promise<IssuedAuthToken> {
  const raw = newToken()
  const tokenHash = hashToken(raw)
  const [row] = await db.insert(authTokens).values({
    userId,
    kind,
    tokenHash,
    expiresAt: tokenExpiry(kind),
  }).returning({ id: authTokens.id })
  if (!row) throw new Error('Az auth-token létrehozása sikertelen')
  return { id: row.id, raw, tokenHash }
}

/** Egy token atomi lefoglalása: két párhuzamos kérésből legfeljebb az egyik kap sort. */
export async function consumeAuthToken(raw: string, kind: TokenKind) {
  const now = new Date()
  const [row] = await db.update(authTokens)
    .set({ usedAt: now })
    .where(and(
      eq(authTokens.tokenHash, hashToken(raw)),
      eq(authTokens.kind, kind),
      isNull(authTokens.usedAt),
      gt(authTokens.expiresAt, now),
    ))
    .returning()
  return row ?? null
}

export async function discardAuthToken(id: number): Promise<void> {
  await db.update(authTokens).set({ usedAt: new Date() })
    .where(and(eq(authTokens.id, id), isNull(authTokens.usedAt)))
}

export async function invalidateOtherAuthTokens(
  userId: number,
  kind: TokenKind,
  exceptId?: number,
): Promise<void> {
  await db.update(authTokens).set({ usedAt: new Date() })
    .where(and(
      eq(authTokens.userId, userId),
      eq(authTokens.kind, kind),
      isNull(authTokens.usedAt),
      exceptId == null ? undefined : ne(authTokens.id, exceptId),
    ))
}

