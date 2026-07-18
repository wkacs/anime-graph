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
    <main className="min-h-screen flex items-center justify-center bg-[#04060f] text-slate-200">
      <form onSubmit={submit} className="flex flex-col gap-4 w-72 p-8 rounded-xl bg-slate-900/80 border border-slate-700">
        <h1 className="text-xl font-semibold text-center">Anime Graph</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Jelszó"
          className="rounded-md bg-slate-800 border border-slate-600 px-3 py-2 outline-none focus:border-cyan-400"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" className="rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold py-2">
          Belépés
        </button>
      </form>
    </main>
  )
}
