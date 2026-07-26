'use client'
import { useEffect, useState } from 'react'

// A nyílt regisztráció előtti fiókoknak nincs e-mail-címük, tehát nincs
// jelszó-visszaállításuk sem. Ez a sáv kéri be, és újraindítja a megerősítést.
export default function EmailPrompt() {
  const [needed, setNeeded] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setNeeded(j != null && !j.email))
      .catch(() => {})
  }, [])

  if (!needed) return null
  if (done) {
    return (
      <div className="glass rounded-2xl p-4 text-sm text-text-2">
        Elmentve. Küldtünk egy megerősítő levelet — kattints a benne lévő linkre.
      </div>
    )
  }

  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-text-2 flex-1 min-w-[200px]">
          Nincs e-mail a fiókodon, így nincs jelszó-visszaállításod.
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@pelda.hu"
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
              else setError((await r.json().catch(() => null))?.error ?? 'Hiba történt')
            } finally {
              setBusy(false)
            }
          }}
        >{busy ? '…' : 'Mentés'}</button>
      </div>
      {error && <p className="text-[13px] text-[color:var(--status-dropped)]">{error}</p>}
    </div>
  )
}
