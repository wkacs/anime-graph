import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { settings, users } from '@/db/schema'
import {
  GLOBAL_QUOTA_USER_ID, globalDailyLimit, quotaVerdict, resolveLimit, type Tier,
} from './ai-limits'
import { rateLimit } from './rate-limit'

const INC = sql`jsonb_build_object('count', coalesce((${settings.value}->>'count')::int, 0) + 1)`

async function readCount(userId: number, key: string): Promise<number> {
  const [row] = await db.select().from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.key, key)))
  return row ? Number((row.value as { count?: number }).count ?? 0) : 0
}

async function bump(userId: number, key: string): Promise<void> {
  await db.insert(settings)
    .values({ userId, key, value: { count: 1 } })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
      set: { value: INC },
    })
}

/**
 * Közös AI-kulcs, két szintű napi sapka:
 *  - fejenkénti + endpointonkénti, a tier szerint
 *  - GLOBÁLIS össz-keret minden felhasználóra együtt (AI_GLOBAL_DAILY_LIMIT)
 *
 * A globális szint nélkül a számla lineárisan nőtt volna a regisztrálók
 * számával: 500 user × napi 20 hívás korlátlan költség ugyanazon a kulcson.
 * A globális számláló a settings tábla 0-s rendszer-során ül (lásd ai-limits).
 */
export async function consumeAiQuota(userId: number, endpoint: string): Promise<void> {
  // Löket-védelem: a napi keret a VOLUMENT fogja meg, a percenkénti lökést nem.
  // Enélkül egy script a napi keretet másodpercek alatt elégeti, és közben
  // párhuzamos modellhívásokat tart nyitva. Itt egy helyen ül, így mind a
  // nyolc AI-végpont megkapja, route-onkénti módosítás nélkül.
  if (!(await rateLimit('ai-burst', String(userId), 8, 60))) {
    throw new Error('Túl sok kérés egymás után. Várj egy percet.')
  }

  const [u] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, userId))
  const tier: Tier = u?.tier === 'paid' ? 'paid' : 'free'
  const envCap = Number(process.env.AI_DAILY_LIMIT ?? 0)
  const userLimit = envCap > 0
    ? Math.min(envCap, resolveLimit(endpoint, tier))
    : resolveLimit(endpoint, tier)
  const globalLimit = globalDailyLimit()

  const day = new Date().toISOString().slice(0, 10)
  const userKey = `aiDay:${day}:${endpoint}`
  // A globális kulcs endpoint-független: az össz-hívásszám a költség, nem az,
  // hogy melyik végponton ment el.
  const globalKey = `aiGlobalDay:${day}`

  const [userCount, globalCount] = await Promise.all([
    readCount(userId, userKey),
    globalLimit > 0 ? readCount(GLOBAL_QUOTA_USER_ID, globalKey) : Promise.resolve(0),
  ])

  const verdict = quotaVerdict({ userCount, userLimit, globalCount, globalLimit })
  if (!verdict.allowed) {
    // Mindkettő mérés ELŐTT dől el, hogy a visszautasított hívás egyik
    // számlálót se fogyassza.
    throw new Error(
      verdict.reason === 'global'
        ? 'A mai közös AI-keret elfogyott. Holnap újraindul.'
        : `Elérted a napi AI-keretet (${userLimit} hívás). Holnap folytathatod.`,
    )
  }

  await bump(userId, userKey)
  if (globalLimit > 0) await bump(GLOBAL_QUOTA_USER_ID, globalKey)
}
