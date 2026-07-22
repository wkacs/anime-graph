import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { settings, users } from '@/db/schema'
import { resolveLimit, type Tier } from './ai-limits'

// közös AI-kulcs, fejenkénti + endpointonkénti napi sapka a tier szerint
export async function consumeAiQuota(userId: number, endpoint: string): Promise<void> {
  const [u] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, userId))
  const tier: Tier = u?.tier === 'paid' ? 'paid' : 'free'
  const envCap = Number(process.env.AI_DAILY_LIMIT ?? 0)
  const limit = envCap > 0
    ? Math.min(envCap, resolveLimit(endpoint, tier))
    : resolveLimit(endpoint, tier)

  const day = new Date().toISOString().slice(0, 10)
  const key = `aiDay:${day}:${endpoint}`
  const [row] = await db.select().from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, key)))
  const count = row ? Number((row.value as { count?: number }).count ?? 0) : 0
  if (count >= limit) {
    throw new Error(`Elérted a napi AI-keretet (${limit} hívás) — holnap folytathatod`)
  }
  await db.insert(settings)
    .values({ userId, key, value: { count: 1 } })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
      set: { value: sql`jsonb_build_object('count', coalesce((${settings.value}->>'count')::int, 0) + 1)` },
    })
}
