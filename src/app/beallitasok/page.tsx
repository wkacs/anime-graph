'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PushToggle from '@/components/PushToggle'
import ProfileReveal from '@/components/ProfileReveal'
import SyncAccounts from '@/components/SyncAccounts'
import EmailPrompt from '@/components/EmailPrompt'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import ProfileSettings from '@/components/ProfileSettings'
import { readMalExport } from '@/lib/mal-export'

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
  const [exporting, setExporting] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
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

  async function downloadExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) throw new Error('Az export most nem sikerült.')
      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') ?? ''
      const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] ?? 'anime-graph-export.json'
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = filename; link.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  async function deleteAccount() {
    setDeleting(true); setDeleteError('')
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword, confirmation: deleteConfirmation }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setDeleteError(data?.error === 'invalid password' ? 'Hibás jelszó.' : 'A törlés nem sikerült.')
        return
      }
      localStorage.clear()
      router.replace('/login')
    } finally {
      setDeleting(false)
    }
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
    let xml: string
    try {
      xml = await readMalExport(file)
    } catch (e) {
      setImporting(null)
      setImportResult(`✕ ${e instanceof Error ? e.message : 'A fájl megnyitása nem sikerült'}`)
      return
    }
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
    <main className="min-h-screen max-w-2xl mx-auto px-4 pt-24 pb-24 md:pb-16 flex flex-col gap-5">
      <h1 className="text-xl font-semibold tracking-tight">Beállítások</h1>

      <EmailPrompt />

      <section className="glass rounded-3xl p-6 flex items-center justify-between gap-4">
        <div>
          <p className="label-mono mb-1">Nyelv / Language</p>
          <p className="text-sm text-text-2">
            Az alkalmazás és az AI-válaszok nyelve.
          </p>
        </div>
        <LocaleSwitcher />
      </section>

      <ProfileSettings />

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
            {importing === 'mal' ? 'Import…' : 'MAL export (.xml vagy .xml.gz) feltöltése'}
            <input
              type="file"
              accept=".xml,.gz,application/xml,text/xml,application/gzip"
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

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">Adataid</p>
        <p className="text-sm text-text-2 mb-4">
          Letöltheted a saját listádat, beállításaidat, véleményeidet és az ajánlási előzményeidet JSON formátumban.
        </p>
        <button onClick={downloadExport} disabled={exporting} className="btn-ghost border border-white/10 px-4 py-2 text-sm">
          {exporting ? 'Export készül…' : 'Adatok letöltése'}
        </button>
      </section>

      <section className="rounded-3xl border border-red-400/25 bg-red-500/5 p-6">
        <p className="label-mono mb-1 text-red-200">Fiók törlése</p>
        <p className="text-sm text-text-2 mb-4">
          Végleg törli a fiókodat és minden személyes adatodat. Ez nem vonható vissza.
        </p>
        <div className="grid gap-3 max-w-md">
          <input
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Jelenlegi jelszó"
            className="field px-4 py-2 text-sm"
          />
          <input
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder="Írd be: DELETE"
            className="field px-4 py-2 text-sm"
          />
          <button
            onClick={deleteAccount}
            disabled={deleting || !deletePassword || deleteConfirmation !== 'DELETE'}
            className="btn-ghost border border-red-400/35 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-40"
          >
            {deleting ? 'Fiók törlése…' : 'Fiók végleges törlése'}
          </button>
          {deleteError && <p className="text-sm text-red-200">{deleteError}</p>}
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
