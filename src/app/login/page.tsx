'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) router.push('/')
    else setError('Hibás jelszó')
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="glass rounded-3xl flex flex-col gap-5 w-80 px-8 py-10">
        <div className="text-center">
          <p className="label-mono mb-2">アニメグラフ</p>
          <h1 className="text-xl font-semibold tracking-tight">Anime Graph</h1>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Jelszó"
          className="field px-4 py-2.5 text-sm"
          autoFocus
        />
        {error && <p className="text-[13px] text-[color:var(--status-dropped)] -mt-2">{error}</p>}
        <button type="submit" className="btn-solid py-2.5 text-sm">
          Belépés
        </button>
      </form>
    </main>
  )
}
