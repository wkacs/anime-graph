'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'register' | 'forgot' | 'reset'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  // a meghívó-mező csak akkor jelenik meg, ha a szerver tényleg kéri (invite mód)
  const [inviteNeeded, setInviteNeeded] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  // window.location-ből olvassuk, nem useSearchParams-szal: az Suspense-határt
  // követelne ezen a statikusan renderelt oldalon.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('reset')
    if (token) { setResetToken(token); setMode('reset') }
  }, [])

  function switchTo(next: Mode) {
    setMode(next); setError(''); setNotice('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setNotice(''); setBusy(true)
    try {
      if (mode === 'forgot') {
        await fetch('/api/auth/forgot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        // szándékosan ugyanaz a válasz létező és nem létező címre
        setNotice('Ha van ilyen fiók, elküldtük a linket.')
        return
      }

      if (mode === 'reset') {
        const res = await fetch('/api/auth/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password }),
        })
        if (res.ok) { router.push('/'); return }
        setError((await res.json().catch(() => null))?.error ?? 'Hiba történt')
        return
      }

      const res = await fetch(mode === 'login' ? '/api/auth' : '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login'
            ? { username, password }
            : { username, email, password, invite, locale: 'hu' },
        ),
      })
      if (res.ok) { router.push(mode === 'register' ? '/onboarding' : '/'); return }
      const json = await res.json().catch(() => null)
      if (res.status === 403) setInviteNeeded(true)
      setError(json?.error ?? 'Hiba történt')
    } finally {
      setBusy(false)
    }
  }

  const submitLabel = {
    login: 'Belépés',
    register: 'Fiók létrehozása',
    forgot: 'Link küldése',
    reset: 'Új jelszó mentése',
  }[mode]

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="glass rounded-3xl flex flex-col gap-4 w-80 px-8 py-10">
        <div className="text-center mb-1">
          <p className="label-mono mb-2">アニメグラフ</p>
          <h1 className="text-xl font-semibold tracking-tight">Anime Graph</h1>
        </div>

        {(mode === 'login' || mode === 'register') && (
          <div className="flex rounded-full bg-white/5 p-1 text-sm">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchTo(m)}
                className={`flex-1 rounded-full py-1.5 transition-colors ${
                  mode === m ? 'bg-white/12 text-text-1' : 'text-text-3 hover:text-text-2'
                }`}
              >
                {m === 'login' ? 'Belépés' : 'Regisztráció'}
              </button>
            ))}
          </div>
        )}

        {mode === 'forgot' && (
          <p className="text-[13px] text-text-2 text-center -mt-1">
            Add meg az e-mail-címed, és küldünk egy visszaállító linket.
          </p>
        )}
        {mode === 'reset' && (
          <p className="text-[13px] text-text-2 text-center -mt-1">
            Adj meg egy új jelszót. A mentés minden más eszközön kilépteti a fiókot.
          </p>
        )}

        {(mode === 'login' || mode === 'register') && (
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Felhasználónév"
            autoComplete="username"
            className="field px-4 py-2.5 text-sm"
            autoFocus
          />
        )}

        {(mode === 'register' || mode === 'forgot') && (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail-cím"
            autoComplete="email"
            className="field px-4 py-2.5 text-sm"
          />
        )}

        {mode !== 'forgot' && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'login' ? 'Jelszó' : 'Jelszó (min. 8 karakter)'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="field px-4 py-2.5 text-sm"
          />
        )}

        {mode === 'register' && inviteNeeded && (
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="Meghívó-kód"
            className="field px-4 py-2.5 text-sm"
          />
        )}

        {error && <p className="text-[13px] text-[color:var(--status-dropped)] -mt-1">{error}</p>}
        {notice && <p className="text-[13px] text-text-2 -mt-1">{notice}</p>}

        <button type="submit" disabled={busy} className="btn-solid py-2.5 text-sm">
          {busy ? '…' : submitLabel}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            onClick={() => switchTo('forgot')}
            className="text-xs text-text-3 hover:text-text-2 transition-colors"
          >
            Elfelejtettem a jelszavam
          </button>
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <button
            type="button"
            onClick={() => switchTo('login')}
            className="text-xs text-text-3 hover:text-text-2 transition-colors"
          >
            Vissza a belépéshez
          </button>
        )}
      </form>
    </main>
  )
}
