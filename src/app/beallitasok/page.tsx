'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PushToggle from '@/components/PushToggle'
import ProfileReveal from '@/components/ProfileReveal'
import SyncAccounts from '@/components/SyncAccounts'

const CONFIG_KEY = 'anime-graph-config'

export default function BeallitasokPage() {
  const [likes, setLikes] = useState('')
  const [dislikes, setDislikes] = useState('')
  const [saved, setSaved] = useState(false)
  const [hierarchySaved, setHierarchySaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [anilistUser, setAnilistUser] = useState('')
  const [importing, setImporting] = useState<'anilist' | 'mal' | null>(null)
  const [importResult, setImportResult] = useState('')
  const [publicToken, setPublicToken] = useState<string | null>(null)
  const [revealOpen, setRevealOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((j) => {
      setLikes(j.tasteLikes ?? '')
      setDislikes(j.tasteDislikes ?? '')
      setPublicToken(j.publicToken ?? null)
    })
  }, [])

  async function togglePublicLink() {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicToken: publicToken ? null : true }),
    })
    const json = await res.json().catch(() => null)
    setPublicToken(publicToken ? null : json?.publicToken ?? null)
  }

  async function copyPublicLink() {
    if (!publicToken) return
    await navigator.clipboard.writeText(`${location.origin}/p/${publicToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

  async function importAnilist() {
    if (!anilistUser.trim()) return
    setImporting('anilist')
    setImportResult('')
    const res = await fetch('/api/import/anilist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: anilistUser.trim() }),
    })
    const json = await res.json()
    setImporting(null)
    setImportResult(res.ok
      ? `✓ ${json.added} új, ${json.updated} frissítve`
      : `✕ ${json.error ?? 'Hiba történt'}`)
    if (res.ok && json.added + json.updated > 0) setRevealOpen(true)
  }

  async function importMal(file: File) {
    setImporting('mal')
    setImportResult('')
    const xml = await file.text()
    const res = await fetch('/api/import/mal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xml }),
    })
    const json = await res.json()
    setImporting(null)
    setImportResult(res.ok
      ? `✓ ${json.added} új, ${json.updated} frissítve${json.notFound ? `, ${json.notFound} nem található AniList-en` : ''}`
      : `✕ ${json.error ?? 'Hiba történt'}`)
    if (res.ok && json.added + json.updated > 0) setRevealOpen(true)
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

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">Értesítések</p>
        <p className="text-sm text-text-2 mb-3">Push, amikor egy követett animéd új része adásba kerül.</p>
        <PushToggle />
      </section>

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">Import</p>
        <p className="text-sm text-text-2 mb-5">
          Meglévő listád behúzása pontszámokkal és státusszal. Ami már fent van, annak
          a státusza/pontja frissül.
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            value={anilistUser}
            onChange={(e) => setAnilistUser(e.target.value)}
            placeholder="AniList felhasználónév"
            className="field px-4 py-2 text-sm w-56"
          />
          <button
            onClick={importAnilist}
            disabled={importing !== null || !anilistUser.trim()}
            className="btn-solid px-4 py-2 text-sm"
          >
            {importing === 'anilist' ? 'Import…' : 'AniList import'}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`btn-ghost border border-white/10 px-4 py-2 text-sm cursor-pointer ${importing ? 'opacity-40 pointer-events-none' : ''}`}>
            {importing === 'mal' ? 'Import…' : 'MAL export (.xml) feltöltése'}
            <input
              type="file"
              accept=".xml,text/xml"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importMal(f); e.target.value = '' }}
            />
          </label>
        </div>
        {importResult && (
          <p className={`label-mono mt-4 ${importResult.startsWith('✓') ? 'text-[color:var(--status-watching)]' : 'text-[color:var(--status-dropped)]'}`}>
            {importResult}
          </p>
        )}
      </section>

      <SyncAccounts />

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">Publikus link</p>
        <p className="text-sm text-text-2 mb-4">
          Jelszó nélküli, csak-olvasható nézet a gyűjteményedről (borítók, státuszok, pontok).
          Vélemények és ízlés-adatok nem látszanak.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={togglePublicLink} className="btn-ghost border border-white/10 px-4 py-2 text-sm">
            {publicToken ? 'Link visszavonása' : 'Link létrehozása'}
          </button>
          {publicToken && (
            <button onClick={copyPublicLink} className="btn-solid px-4 py-2 text-sm">
              {copied ? '✓ Másolva' : 'Link másolása'}
            </button>
          )}
          {publicToken && (
            <code className="font-mono text-xs text-text-3 break-all">/p/{publicToken}</code>
          )}
        </div>
      </section>

      <section className="glass rounded-3xl p-6 flex items-center justify-between">
        <div>
          <p className="label-mono mb-1">Onboarding</p>
          <p className="text-sm text-text-2">Első-lépések varázsló és oldal-túrák újraindítása.</p>
        </div>
        <button
          onClick={() => {
            Object.keys(localStorage)
              .filter((k) => k.startsWith('anime-graph-tour:'))
              .forEach((k) => localStorage.removeItem(k))
            router.push('/onboarding')
          }}
          className="btn-ghost border border-white/10 px-5 py-2 text-sm"
        >
          Újraindítás
        </button>
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

      <ProfileReveal open={revealOpen} onClose={() => setRevealOpen(false)} />
    </main>
  )
}
