import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { settings } from '@/db/schema'

const LIMIT = () => Number(process.env.AI_DAILY_LIMIT ?? 20)

// közös GLM-kulcs, fejenkénti napi sapka — túllépésnél barátságos hibával dob
export async function consumeAiQuota(userId: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10)
  const key = `aiDay:${day}`
  const [row] = await db.select().from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, key)))
  const count = row ? Number((row.value as { count?: number }).count ?? 0) : 0
  if (count >= LIMIT()) {
    throw new Error(`Elérted a napi AI-keretet (${LIMIT()} hívás) — holnap folytathatod`)
  }
  await db.insert(settings)
    .values({ userId, key, value: { count: 1 } })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
      set: { value: sql`jsonb_build_object('count', coalesce((${settings.value}->>'count')::int, 0) + 1)` },
    })
}
