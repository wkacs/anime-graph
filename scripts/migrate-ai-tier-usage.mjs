import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free'`
  await sql`
    CREATE TABLE IF NOT EXISTS ai_usage_log (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      endpoint text NOT NULL,
      model text NOT NULL,
      prompt_tokens integer NOT NULL DEFAULT 0,
      completion_tokens integer NOT NULL DEFAULT 0,
      est_cost_usd real NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now()
    )`
  await sql`CREATE INDEX IF NOT EXISTS ai_usage_user_day ON ai_usage_log (user_id, created_at)`
  console.log('migrate-ai-tier-usage: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
