import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { settings, users } from '@/db/schema'
import {
  GLOBAL_QUOTA_USER_ID, globalDailyLimit, quotaVerdict, resolveLimit, type Tier,
} from './ai-limits'
import { rateLimit } from './rate-limit'

const INC = sql`jsonb_build_object('count', coalesce((${settings.value}->>'count')::int, 0) + 1)`
const DEC = sql`jsonb_build_object('count', greatest(coalesce((${settings.value}->>'count')::int, 0) - 1, 0))`

/** Atomi novelés; a visszaadott érték a novelés UTÁNI állás. */
async function bump(userId: number, key: string): Promise<number> {
  const [row] = await db.insert(settings)
    .values({ userId, key, value: { count: 1 } })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
      set: { value: INC },
    })
    .returning({ value: settings.value })
  return Number((row?.value as { count?: number })?.count ?? 1)
}

/** Visszavonás a visszautasított ágon. `greatest(...,0)`: a számláló nem megy negatívba. */
async function unbump(userId: number, key: string): Promise<void> {
  await db.update(settings).set({ value: DEC })
    .where(and(eq(settings.userId, userId), eq(settings.key, key)))
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

  // ELOSZOR novelunk, aztan dontunk a novelés ELOTTI állásból (`after - 1`).
  // Beolvasás-majd-írás esetén két párhuzamos kérés ugyanazt a szabad helyet
  // látná, és mindkettő átmenne a kereten; így a hely foglalása maga a mérés.
  const [globalAfter, userAfter] = await Promise.all([
    globalLimit > 0 ? bump(GLOBAL_QUOTA_USER_ID, globalKey) : Promise.resolve(0),
    bump(userId, userKey),
  ])

  const verdict = quotaVerdict({
    userCount: userAfter - 1,
    userLimit,
    globalCount: globalLimit > 0 ? globalAfter - 1 : 0,
    globalLimit,
  })
  if (!verdict.allowed) {
    // A visszautasított hívás egyik számlálót se fogyaszthatja el: ami nem ment
    // modellhez, az nem költség. A visszavonás a hibaüzenet előtt fut le.
    await Promise.all([
      unbump(userId, userKey),
      globalLimit > 0 ? unbump(GLOBAL_QUOTA_USER_ID, globalKey) : Promise.resolve(),
    ])
    throw new Error(
      verdict.reason === 'global'
        ? 'A mai közös AI-keret elfogyott. Holnap újraindul.'
        : `Elérted a napi AI-keretet (${userLimit} hívás). Holnap folytathatod.`,
    )
  }
}
