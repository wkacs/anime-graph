'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

type Compat = { score: number; common: string[] }

// Kompatibilitás-chip a publikus profilon — csak bejelentkezett nézőnek jelenik meg.
export default function CompatChip({ token }: { token: string }) {
  const [compat, setCompat] = useState<Compat | null>(null)
  const t = useTranslations('compat')

  useEffect(() => {
    fetch(`/api/compat?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCompat(j?.compat ?? null))
      .catch(() => setCompat(null))
  }, [token])

  if (!compat) return null

  return (
    <div className="glass-chip rounded-full px-4 py-2 inline-flex items-center gap-2.5 self-start">
      <span className="label-mono">{t('tasteMatch')}</span>
      <span className="font-mono font-semibold" style={{ color: compat.score >= 70 ? 'var(--status-watching)' : undefined }}>
        {compat.score}%
      </span>
      {compat.common.length > 0 && (
        <span className="text-xs text-text-3">{t('shared', { list: compat.common.join(', ') })}</span>
      )}
    </div>
  )
}
