'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await fetch(mode === 'login' ? '/api/auth' : '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mode === 'login' ? { username, password } : { username, password, invite }),
    })
    setBusy(false)
    if (res.ok) { router.push('/'); return }
    const json = await res.json().catch(() => null)
    setError(json?.error ?? 'Hiba történt')
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="glass rounded-3xl flex flex-col gap-4 w-80 px-8 py-10">
        <div className="text-center mb-1">
          <p className="label-mono mb-2">アニメグラフ</p>
          <h1 className="text-xl font-semibold tracking-tight">Anime Graph</h1>
        </div>

        <div className="flex rounded-full bg-white/5 p-1 text-sm">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError('') }}
              className={`flex-1 rounded-full py-1.5 transition-colors ${
                mode === m ? 'bg-white/12 text-text-1' : 'text-text-3 hover:text-text-2'
              }`}
            >
              {m === 'login' ? 'Belépés' : 'Regisztráció'}
            </button>
          ))}
        </div>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Felhasználónév"
          autoComplete="username"
          className="field px-4 py-2.5 text-sm"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Jelszó"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="field px-4 py-2.5 text-sm"
        />
        {mode === 'register' && (
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder="Meghívó-kód"
            className="field px-4 py-2.5 text-sm"
          />
        )}
        {error && <p className="text-[13px] text-[color:var(--status-dropped)] -mt-1">{error}</p>}
        <button type="submit" disabled={busy} className="btn-solid py-2.5 text-sm">
          {busy ? '…' : mode === 'login' ? 'Belépés' : 'Fiók létrehozása'}
        </button>
      </form>
    </main>
  )
}
