'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import PushToggle from '@/components/PushToggle'
import ProfileReveal from '@/components/ProfileReveal'
import SyncAccounts from '@/components/SyncAccounts'
import EmailPrompt from '@/components/EmailPrompt'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import ProfileSettings from '@/components/ProfileSettings'
import { readMalExport } from '@/lib/mal-export'

const CONFIG_KEY = 'anime-graph-config'

export default function BeallitasokPage() {
  const t = useTranslations('settings')
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
      if (!res.ok) throw new Error(t('exportFailed'))
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
        setDeleteError(data?.error === 'invalid password' ? t('wrongPassword') : t('deleteFailed'))
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
      ? t('importOk', { added: json.added, updated: json.updated })
      : `✕ ${json.error ?? t('genericError')}`)
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
      setImportResult(`✕ ${e instanceof Error ? e.message : t('fileOpenFailed')}`)
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
      ? `${t('importOk', { added: json.added, updated: json.updated })}${json.notFound ? t('importNotFound', { n: json.notFound }) : ''}`
      : `✕ ${json.error ?? t('genericError')}`)
    if (res.ok && json.added + json.updated > 0) setRevealOpen(true)
  }

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 pt-24 pb-24 md:pb-16 flex flex-col gap-5">
      <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>

      <EmailPrompt />

      <section className="glass rounded-3xl p-6 flex items-center justify-between gap-4">
        <div>
          <p className="label-mono mb-1">{t('langKicker')}</p>
          <p className="text-sm text-text-2">{t('langText')}</p>
        </div>
        <LocaleSwitcher />
      </section>

      <ProfileSettings />

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">{t('tasteKicker')}</p>
        <p className="text-sm text-text-2 mb-5">{t('tasteText')}</p>
        <label className="block mb-4">
          <span className="text-sm text-text-1 mb-1.5 block">{t('likesLabel')}</span>
          <textarea
            value={likes}
            onChange={(e) => setLikes(e.target.value)}
            rows={5}
            placeholder={t('likesPlaceholder')}
            className="field w-full rounded-2xl p-4 text-sm leading-relaxed"
          />
        </label>
        <label className="block mb-4">
          <span className="text-sm text-text-1 mb-1.5 block">{t('dislikesLabel')}</span>
          <textarea
            value={dislikes}
            onChange={(e) => setDislikes(e.target.value)}
            rows={5}
            placeholder={t('dislikesPlaceholder')}
            className="field w-full rounded-2xl p-4 text-sm leading-relaxed"
          />
        </label>
        <div className="flex items-center gap-3">
          <button onClick={saveTaste} disabled={saving} className="btn-solid px-5 py-2 text-sm">
            {saving ? t('saving') : t('save')}
          </button>
          {saved && <span className="label-mono text-[color:var(--status-watching)]">{t('savedBadge')}</span>}
        </div>
      </section>

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">{t('graphKicker')}</p>
        <p className="text-sm text-text-2 mb-4">{t('graphText')}</p>
        <div className="flex items-center gap-3">
          <button onClick={saveHierarchyDefault} className="btn-ghost border border-white/10 px-5 py-2 text-sm">
            {t('graphSave')}
          </button>
          {hierarchySaved && <span className="label-mono text-[color:var(--status-watching)]">{t('savedBadge')}</span>}
        </div>
      </section>

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">{t('notifKicker')}</p>
        <p className="text-sm text-text-2 mb-3">{t('notifText')}</p>
        <PushToggle />
      </section>

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">{t('importKicker')}</p>
        <p className="text-sm text-text-2 mb-5">{t('importText')}</p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            value={anilistUser}
            onChange={(e) => setAnilistUser(e.target.value)}
            placeholder={t('anilistPlaceholder')}
            className="field px-4 py-2 text-sm w-56"
          />
          <button
            onClick={importAnilist}
            disabled={importing !== null || !anilistUser.trim()}
            className="btn-solid px-4 py-2 text-sm"
          >
            {importing === 'anilist' ? t('importing') : t('anilistImportCta')}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className={`btn-ghost border border-white/10 px-4 py-2 text-sm cursor-pointer ${importing ? 'opacity-40 pointer-events-none' : ''}`}>
            {importing === 'mal' ? t('importing') : t('malUpload')}
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
        <p className="label-mono mb-1">{t('publicKicker')}</p>
        <p className="text-sm text-text-2 mb-4">{t('publicText')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={togglePublicLink} className="btn-ghost border border-white/10 px-4 py-2 text-sm">
            {publicToken ? t('linkRevoke') : t('linkCreate')}
          </button>
          {publicToken && (
            <button onClick={copyPublicLink} className="btn-solid px-4 py-2 text-sm">
              {copied ? t('copied') : t('copyLink')}
            </button>
          )}
          {publicToken && (
            <code className="font-mono text-xs text-text-3 break-all">/p/{publicToken}</code>
          )}
        </div>
      </section>

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">{t('dataKicker')}</p>
        <p className="text-sm text-text-2 mb-4">{t('dataText')}</p>
        <button onClick={downloadExport} disabled={exporting} className="btn-ghost border border-white/10 px-4 py-2 text-sm">
          {exporting ? t('exportBusy') : t('exportCta')}
        </button>
      </section>

      <section className="rounded-3xl border border-red-400/25 bg-red-500/5 p-6">
        <p className="label-mono mb-1 text-red-200">{t('deleteKicker')}</p>
        <p className="text-sm text-text-2 mb-4">{t('deleteText')}</p>
        <div className="grid gap-3 max-w-md">
          <input
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder={t('currentPassword')}
            className="field px-4 py-2 text-sm"
          />
          <input
            value={deleteConfirmation}
            onChange={(e) => setDeleteConfirmation(e.target.value)}
            placeholder={t('typeDelete')}
            className="field px-4 py-2 text-sm"
          />
          <button
            onClick={deleteAccount}
            disabled={deleting || !deletePassword || deleteConfirmation !== 'DELETE'}
            className="btn-ghost border border-red-400/35 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-40"
          >
            {deleting ? t('deleting') : t('deleteCta')}
          </button>
          {deleteError && <p className="text-sm text-red-200">{deleteError}</p>}
        </div>
      </section>

      <section className="glass rounded-3xl p-6 flex items-center justify-between">
        <div>
          <p className="label-mono mb-1">{t('onboardingKicker')}</p>
          <p className="text-sm text-text-2">{t('onboardingText')}</p>
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
          {t('restart')}
        </button>
      </section>

      <section className="glass rounded-3xl p-6 flex items-center justify-between">
        <div>
          <p className="label-mono mb-1">{t('sessionKicker')}</p>
          <p className="text-sm text-text-2">{t('sessionText')}</p>
        </div>
        <button onClick={logout} className="btn-ghost border border-white/10 px-5 py-2 text-sm hover:text-[color:var(--status-dropped)]">
          {t('logout')}
        </button>
      </section>

      <ProfileReveal open={revealOpen} onClose={() => setRevealOpen(false)} />
    </main>
  )
}
