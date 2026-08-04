'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { useStatusLabel } from '@/components/useLabels'
import { STATUS_CSS_VARS } from '@/lib/status'
import type { OpinionQueueInput } from '@/lib/opinion-queue'
import PageShell from '@/components/ui/PageShell'

// Vélemény-váró oldal: minden saját cím, amihez még nincs (sikeres) vélemény —
// a kártyán azonnal írható, nem kell átugrani a címoldalra.
export default function VelemenyekPage() {
  const [items, setItems] = useState<OpinionQueueInput[] | null>(null)
  // null = nincs hiba; '' = van hiba, de a szerver nem adott sajat uzenetet
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState<Set<number>>(new Set())
  const [cardErrors, setCardErrors] = useState<Record<number, string>>({})
  const t = useTranslations('opinions')
  const tc = useTranslations('common')
  const statusLabel = useStatusLabel()

  useEffect(() => {
    fetch('/api/opinions/pending')
      .then(async (r) => {
        // Ures uzenet = "nincs sajat szoveg", a forditott alapertelmezes a
        // renderben lep be. A `tc` itt fuggosegge valna, es mivel a forditó
        // nem referencia-stabil, minden renderben ujra lefutna a fetch.
        if (!r.ok) throw new Error((await r.json()).error ?? '')
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
      if (!res.ok) throw new Error(j.error ?? tc('error'))
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
    <PageShell width="default" className="flex flex-col gap-6">
      <div>
        <p className="label-mono mb-1">{t('kicker')}</p>
        <h1 className="h2">
          {t('heading')}{items != null ? ` · ${items.length}` : ''}
        </h1>
        <p className="text-sm text-text-2 mt-1">{t('lead')}</p>
      </div>

      {error != null && (
        <p className="text-sm text-[color:var(--status-dropped)]">{error || tc('error')}</p>
      )}

      {items == null && !error && (
        <motion.p animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} className="label-mono">
          {tc('loading')}
        </motion.p>
      )}

      {items != null && items.length === 0 && (
        <div className="glass rounded-3xl px-8 py-12 text-center">
          <p className="text-lg font-medium">{t('emptyTitle')}</p>
          <p className="text-sm text-text-2 mt-1">{t('emptyText')}</p>
        </div>
      )}

      {items != null && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.id} className="glass rounded-3xl p-4 flex gap-4">
              {item.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.coverUrl} alt="" className="w-28 self-start aspect-[2/3] object-cover rounded-xl border border-white/10 shrink-0" />
              ) : (
                <div className="w-28 aspect-[2/3] rounded-xl bg-white/5 shrink-0" />
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div>
                  <p className="text-base font-medium leading-tight">{item.titleRomaji}</p>
                  <p className="flex items-center gap-1.5 mt-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CSS_VARS[item.status] ?? 'white' }} />
                    <span className="label-mono !text-[9px]">
                      {statusLabel(item.status)}
                      {item.myScore != null ? ` · ${item.myScore}/10` : ''}
                      {item.extractStatus === 'failed' ? ` · ${t('previousExtractFailed')}` : ''}
                    </span>
                  </p>
                </div>
                <textarea
                  value={drafts[item.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                  placeholder={t('placeholder')}
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
                  {saving.has(item.id) ? t('aiWorking') : tc('save')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
