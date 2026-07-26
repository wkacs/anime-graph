import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

// AI NELKUL: a meglevo teny szoveget osszevetjuk a cim mufaj- es tagneveivel.
// Durva, de ingyen ad kiindulasi jelkeszletet. A `note` kimarad (nincs polaritasa),
// es a globalis, cim nelkuli tenyek (source='settings') sem kerulnek be.
async function main() {
  const rows = await sql`
    SELECT tm.user_id, tm.kind, tm.text, a.title_id, t.genres, t.tags
    FROM taste_memory tm
    JOIN anime a ON a.id = tm.anime_id
    JOIN title t ON t.id = a.title_id
    WHERE tm.anime_id IS NOT NULL AND tm.kind IN ('like','dislike')`

  let written = 0
  for (const r of rows) {
    const lower = r.text.toLowerCase()
    const names = [
      ...(r.genres ?? []).map((g) => [`g:${g.toLowerCase()}`, g.toLowerCase()]),
      ...(r.tags ?? []).map((t) => [`t:${t.name.toLowerCase()}`, t.name.toLowerCase()]),
    ]
    const polarity = r.kind === 'like' ? 1 : -1
    for (const [key, needle] of names) {
      if (!lower.includes(needle)) continue
      // strength 0.5: a szoveg-egyezes gyengebb bizonyitek, mint egy celzott AI-jel
      const res = await sql`
        INSERT INTO taste_signal (user_id, title_id, feature, polarity, strength, source)
        VALUES (${r.user_id}, ${r.title_id}, ${key}, ${polarity}, 0.5, 'backfill')
        ON CONFLICT (user_id, title_id, feature) DO NOTHING
        RETURNING id`
      written += res.length
    }
  }
  console.log(`backfill-taste-signals: ${rows.length} teny, ${written} uj jel`)
}
main().catch((e) => { console.error(e); process.exit(1) })
