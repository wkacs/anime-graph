'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

// A nyílt regisztráció előtti fiókoknak nincs e-mail-címük, tehát nincs
// jelszó-visszaállításuk sem. Ez a sáv kéri be, és újraindítja a megerősítést.
export default function EmailPrompt() {
  const t = useTranslations('emailPrompt')
  const tc = useTranslations('common')
  const [needed, setNeeded] = useState(false)
  const [unverified, setUnverified] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setNeeded(j != null && !j.email)
        setUnverified(j != null && Boolean(j.email) && !j.emailVerified)
      })
      .catch(() => {})
  }, [])

  if (!needed && !unverified) return null
  if (done) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-text-2">
        {t('saved')}
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2">
      {unverified && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-text-2 flex-1 min-w-[200px]">{t('unverified')}</span>
          <button
            disabled={busy}
            className="btn-ghost border border-white/10 px-3.5 py-1.5 text-xs"
            onClick={async () => {
              setError(''); setBusy(true)
              try {
                const r = await fetch('/api/auth/verify/resend', { method: 'POST' })
                if (r.ok) setDone(true)
                else setError((await r.json().catch(() => null))?.error ?? tc('error'))
              } finally {
                setBusy(false)
              }
            }}
          >{busy ? '…' : t('resend')}</button>
        </div>
      )}
      {needed && (
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-text-2 flex-1 min-w-[200px]">
          {t('noEmail')}
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('placeholder')}
          className="field px-3 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <button
          disabled={busy}
          className="btn-ghost border border-white/10 px-3.5 py-1.5 text-xs"
          onClick={async () => {
            setError(''); setBusy(true)
            try {
              const r = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
              })
              if (r.ok) setDone(true)
              else setError((await r.json().catch(() => null))?.error ?? tc('error'))
            } finally {
              setBusy(false)
            }
          }}
        >{busy ? '…' : tc('save')}</button>
      </div>
      )}
      {error && <p className="text-[13px] text-[color:var(--status-dropped)]">{error}</p>}
    </div>
  )
}
