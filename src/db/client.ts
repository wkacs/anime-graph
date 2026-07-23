import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

type DB = ReturnType<typeof drizzle<typeof schema>>

// Lazy init: module-level neon() would throw at build time (page-data collection
// imports the route modules before env vars are guaranteed).
let _db: DB | null = null

function getDb(): DB {
  if (!_db) {
    // no-store: Neon HTTP responses got cached on Vercel in a previous project without it
    const sql = neon(process.env.DATABASE_URL!, {
      fetchOptions: { cache: 'no-store' },
    })
    _db = drizzle(sql, { schema })
  }
  return _db
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<PropertyKey, unknown>
    const value = real[prop]
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value
  },
})

// ISR-kompatibilis kliens a statikusan cache-elt oldalak (katalógus-shell) olvasásaihoz.
// A globális `cache: 'no-store'` ISR-oldalon DYNAMIC_SERVER_USAGE-dzsel 500-at dob
// (`next start` alatt), a frissesség-aggály itt nem él: az ISR maga 24h-ra cache-el.
let _dbStatic: DB | null = null

function getDbStatic(): DB {
  if (!_dbStatic) {
    _dbStatic = drizzle(neon(process.env.DATABASE_URL!), { schema })
  }
  return _dbStatic
}

export const dbStatic = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDbStatic() as unknown as Record<PropertyKey, unknown>
    const value = real[prop]
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value
  },
})
