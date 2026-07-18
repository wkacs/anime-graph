'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const CONFIG_KEY = 'anime-graph-config'

export default function BeallitasokPage() {
  const [likes, setLikes] = useState('')
  const [dislikes, setDislikes] = useState('')
  const [saved, setSaved] = useState(false)
  const [hierarchySaved, setHierarchySaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((j) => {
      setLikes(j.tasteLikes ?? '')
      setDislikes(j.tasteDislikes ?? '')
    })
  }, [])

  async function saveTaste() {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasteLikes: likes, tasteDislikes: dislikes }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function saveHierarchyDefault() {
    const current = localStorage.getItem(CONFIG_KEY)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hierarchyDefault: current ? JSON.parse(current) : null }),
    })
    setHierarchySaved(true)
    setTimeout(() => setHierarchySaved(false), 2500)
  }

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 pt-24 pb-16 flex flex-col gap-5">
      <h1 className="text-xl font-semibold tracking-tight">Beállítások</h1>

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">Ízlés-profil</p>
        <p className="text-sm text-text-2 mb-5">
          Soronként egy dolog. Ezek minden ajánlásnál bemennek az AI-nak a vélemény-kivonataid mellé.
        </p>
        <label className="block mb-4">
          <span className="text-sm text-text-1 mb-1.5 block">Nagyon szeretem</span>
          <textarea
            value={likes}
            onChange={(e) => setLikes(e.target.value)}
            rows={5}
            placeholder={'pl.\nokos time-travel sztorik\njó zenéjű openingek\nrövid, feszes évadok'}
            className="field w-full rounded-2xl p-4 text-sm leading-relaxed"
          />
        </label>
        <label className="block mb-4">
          <span className="text-sm text-text-1 mb-1.5 block">Nem szeretem</span>
          <textarea
            value={dislikes}
            onChange={(e) => setDislikes(e.target.value)}
            rows={5}
            placeholder={'pl.\nvéget nem érő filler részek\nfanservice öncélúan\n300+ részes sorozatok'}
            className="field w-full rounded-2xl p-4 text-sm leading-relaxed"
          />
        </label>
        <div className="flex items-center gap-3">
          <button onClick={saveTaste} disabled={saving} className="btn-solid px-5 py-2 text-sm">
            {saving ? 'Mentés…' : 'Mentés'}
          </button>
          {saved && <span className="label-mono text-[color:var(--status-watching)]">✓ mentve</span>}
        </div>
      </section>

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">Gráf</p>
        <p className="text-sm text-text-2 mb-4">
          A gráf-oldalon beállított hierarchia (szintek, sorrend, élek) elmentése alapértelmezettként
          — más eszközön is ez töltődik be.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={saveHierarchyDefault} className="btn-ghost border border-white/10 px-5 py-2 text-sm">
            Jelenlegi elrendezés mentése
          </button>
          {hierarchySaved && <span className="label-mono text-[color:var(--status-watching)]">✓ mentve</span>}
        </div>
      </section>

      <section className="glass rounded-3xl p-6 flex items-center justify-between">
        <div>
          <p className="label-mono mb-1">Munkamenet</p>
          <p className="text-sm text-text-2">Kijelentkezés erről az eszközről.</p>
        </div>
        <button onClick={logout} className="btn-ghost border border-white/10 px-5 py-2 text-sm hover:text-[color:var(--status-dropped)]">
          Kijelentkezés
        </button>
      </section>
    </main>
  )
}
