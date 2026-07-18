import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

// no-store: Neon HTTP responses got cached on Vercel in a previous project without it
const sql = neon(process.env.DATABASE_URL!, {
  fetchOptions: { cache: 'no-store' },
})

export const db = drizzle(sql, { schema })
