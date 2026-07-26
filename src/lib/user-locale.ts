import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { DEFAULT_LOCALE, type Locale } from './locale'

// Route-oldali segéd: az AI-válaszok és a levelek nyelve a fiók beállítása.
// Külön fájl a locale.ts-től, mert az kliens-komponensekbe is bekerül,
// ide viszont a DB-kliens jön be.
export async function userLocale(userId: number): Promise<Locale> {
  const [row] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId))
  return row?.locale === 'hu' || row?.locale === 'en' ? row.locale : DEFAULT_LOCALE
}
