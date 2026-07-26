'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { STATUS_LABELS, STATUS_CSS_VARS } from '@/lib/status'
import type { OpinionQueueInput } from '@/lib/opinion-queue'

// Vélemény-váró oldal: minden saját cím, amihez még nincs (sikeres) vélemény —
// a kártyán azonnal írható, nem kell átugrani a címoldalra.
export default function VelemenyekPage() {
  const [items, setItems] = useState<OpinionQueueInput[] | null>(null)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<Set<number>>(new Set())
  const [cardErrors, setCardErrors] = useState<Record<number, string>>({})

  useEffect(() => {
    fetch('/api/opinions/pending')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Hiba történt')
        const j = await r.json() as { items: OpinionQueueInput[] }
        setItems(j.items)
      })
      .catch((e) => setError(String(e.message ?? e)))
  }, [])

  async function save(item: OpinionQueueInput) {
    const rawText = (drafts[item.id] ?? '').trim()
    if (!rawText) return
    setSaving((s) => new Set(s).add(item.id))
    setCardErrors((e) => ({ ...e, [item.id]: '' }))
    try {
      const res = await fetch('/api/opinion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animeId: item.id, rawText }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Hiba történt')
      // failed extract is mentve van — a szöveg megmaradt, az AI-kinyerés újrázható,
      // de a sorból már kikerülhet a kártya, mert vélemény létezik
      setItems((list) => (list ?? []).filter((i) => i.id !== item.id))
    } catch (e) {
      setCardErrors((errs) => ({ ...errs, [item.id]: String((e as Error).message ?? e) }))
    } finally {
      setSaving((s) => { const n = new Set(s); n.delete(item.id); return n })
    }
  }

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 pt-24 pb-24 md:pb-16 flex flex-col gap-6">
      <div>
        <p className="label-mono mb-1">Vélemények</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Véleményre vár{items != null ? ` · ${items.length}` : ''}
        </h1>
        <p className="text-sm text-text-2 mt-1">
          Írd le pár mondatban, mi tetszett és mi nem — az AI ízlés-tényeket nyer ki belőle,
          és ettől lesz pontosabb minden ajánlás.
        </p>
      </div>

      {error && <p className="text-sm text-[color:var(--status-dropped)]">{error}</p>}

      {items == null && !error && (
        <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="label-mono">
          Betöltés…
        </motion.p>
      )}

      {items != null && items.length === 0 && (
        <div className="glass rounded-3xl px-8 py-12 text-center">
          <p className="text-lg font-medium">Minden címedről van vélemény 🎉</p>
          <p className="text-sm text-text-2 mt-1">Ha új animét fejezel be, itt fog várni rád.</p>
        </div>
      )}

      {items != null && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="glass rounded-3xl p-4 flex gap-4">
              {item.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.coverUrl} alt="" className="w-20 self-start aspect-[2/3] object-cover rounded-xl border border-white/8 shrink-0" />
              ) : (
                <div className="w-20 aspect-[2/3] rounded-xl bg-white/5 shrink-0" />
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div>
                  <p className="text-sm font-medium leading-tight">{item.titleRomaji}</p>
                  <p className="flex items-center gap-1.5 mt-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CSS_VARS[item.status] ?? 'white' }} />
                    <span className="label-mono !text-[9px]">
                      {STATUS_LABELS[item.status] ?? item.status}
                      {item.myScore != null ? ` · ${item.myScore}/10` : ''}
                      {item.extractStatus === 'failed' ? ' · előző kinyerés hibázott' : ''}
                    </span>
                  </p>
                </div>
                <textarea
                  value={drafts[item.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                  placeholder="Mi tetszett? Mi nem? Milyen hangulata volt?"
                  rows={3}
                  className="field rounded-2xl px-3 py-2 text-sm resize-y min-h-16"
                />
                {cardErrors[item.id] && (
                  <p className="text-xs text-[color:var(--status-dropped)]">{cardErrors[item.id]}</p>
                )}
                <button
                  onClick={() => save(item)}
                  disabled={saving.has(item.id) || !(drafts[item.id] ?? '').trim()}
                  className="btn-solid self-end px-4 py-1.5 text-xs disabled:opacity-40"
                >
                  {saving.has(item.id) ? 'AI dolgozik…' : 'Mentés'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
