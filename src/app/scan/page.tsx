'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import PageShell from '@/components/ui/PageShell'
import { Reveal } from '@/components/ui/Reveal'
import ScanResultView from '@/components/ScanResult'
import { isValidAnilistUsername, type ScanResult } from '@/lib/taste-scan'

type Result = ScanResult & { username: string }

// Taste Scan: a hidegindito. Egy kerdes, fiok nelkul, es a valasz mar mond
// valamit a felhasznalorol. A teljes graf, a mentes es a tanulas tudatosan
// marad a regisztracio mogott — ami itt kimegy, az onmagaban is erjen valamit.
export default function ScanPage() {
  const t = useTranslations('scan')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const valid = isValidAnilistUsername(name.trim())

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.trim() }),
      })
      const json = await res.json()
      if (!res.ok) setError(json.error ?? t('genericError'))
      else setResult(json)
    } catch {
      setError(t('genericError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell width="default">
      <Reveal>
        <p className="label-mono">{t('eyebrow')}</p>
        <h1 className="display-l mt-3 text-balance text-silver">{t('title')}</h1>
        <p className="mt-4 max-w-xl text-text-2 leading-relaxed">{t('lead')}</p>
      </Reveal>

      <Reveal>
        <form onSubmit={submit} className="mt-8 flex flex-wrap items-center gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            className="surface-1 min-w-0 flex-1 rounded-[var(--r-md)] px-4 py-3 text-text-1 placeholder:text-text-3 outline-none focus-visible:ring-2 focus-visible:ring-white/25"
          />
          <button type="submit" disabled={!valid || busy} className="btn-solid px-5 py-3 disabled:opacity-40">
            {busy ? t('working') : t('submit')}
          </button>
        </form>
        <p className="mt-3 text-xs text-text-3">{t('privacy')}</p>
        {error && <p className="mt-4 text-sm" style={{ color: 'var(--status-dropped)' }}>{error}</p>}
      </Reveal>

      {result && (
        <div className="mt-14">
          <ScanResultView
            result={result}
            username={result.username}
            // A megoszto link a bongeszo origójából epul: a kod nem tudja, milyen
            // domainen fut, es egy bedrotozott URL rossz kornyezetben halott linket adna.
            shareUrl={typeof window !== 'undefined'
              ? `${window.location.origin}/scan/${result.username}`
              : undefined}
          />
        </div>
      )}
    </PageShell>
  )
}
