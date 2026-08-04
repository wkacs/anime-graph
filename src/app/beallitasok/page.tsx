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
import Skeleton from '@/components/ui/Skeleton'
import { mutate } from '@/lib/mutate'
import { readMalExport } from '@/lib/mal-export'
import PageShell from '@/components/ui/PageShell'

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
  // A beolvasás állapota KÜLÖN áll. Enélkül egy 401/500/nem-JSON válasz után
  // a két textarea üresen renderelt — megkülönböztethetetlenül attól, hogy a
  // felhasználó sosem írt bele —, a Mentés viszont ÉLES volt. Egy kattintás
  // PUT-olta a `{ tasteLikes:'', tasteDislikes:'' }`-t, és megsemmisítette az
  // ízlésprofilt, ami az összes ajánlást hajtja. Visszavonás nincs (§16.2/§16.3).
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [hasSavedLayout, setHasSavedLayout] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const router = useRouter()
  const tc = useTranslations('common')

  useEffect(() => { setHasSavedLayout(localStorage.getItem(CONFIG_KEY) != null) }, [])

  function loadSettings() {
    setLoadError(false)
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((j) => {
        setLikes(j.tasteLikes ?? '')
        setDislikes(j.tasteDislikes ?? '')
        setPublicToken(j.publicToken ?? null)
        setLoaded(true)
      })
      .catch(() => setLoadError(true))
  }

  useEffect(loadSettings, [])

  async function togglePublicLink() {
    const creating = !publicToken
    setSaveError('')
    const res = await mutate<{ publicToken?: string }>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicToken: creating ? true : null }),
    })
    // csak VALÓS siker után írjuk át a helyi állapotot; létrehozásnál pedig
    // csak akkor, ha tényleg érkezett token — különben egy nem létező
    // /p/<token> útvonalat mutatnánk késznek
    if (!res.ok) { setSaveError(t('genericError')); return }
    if (creating) {
      if (!res.data?.publicToken) { setSaveError(t('genericError')); return }
      setPublicToken(res.data.publicToken)
    } else {
      setPublicToken(null)
    }
  }

  async function copyPublicLink() {
    if (!publicToken) return
    await navigator.clipboard.writeText(`${location.origin}/p/${publicToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveTaste() {
    // PUT SOSEM indulhat feloldatlan olvasásból
    if (!loaded) return
    setSaving(true)
    setSaveError('')
    const res = await mutate('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasteLikes: likes, tasteDislikes: dislikes }),
    })
    setSaving(false)
    // A „✓ mentve" eddig FELTÉTEL NÉLKÜL megjelent: 500-nál, rate-limitnél,
    // offline fülnél is azt üzente, hogy elmentettük. Egy meg nem történt
    // művelet nyugtázása rosszabb, mint a semmi (§16.7).
    if (!res.ok) { setSaveError(t('genericError')); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function saveHierarchyDefault() {
    const current = localStorage.getItem(CONFIG_KEY)
    // null-t PUT-olni és sikert jelenteni félrevezető: ha nincs mentett
    // elrendezés, a gomb eleve tiltva van (lásd a `disabled`-et lent)
    if (!current) return
    setSaveError('')
    const res = await mutate('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hierarchyDefault: JSON.parse(current) }),
    })
    if (!res.ok) { setSaveError(t('genericError')); return }
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
    <PageShell width="compact" className="flex flex-col gap-5">
      <h1 className="display-m">{t('title')}</h1>

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
        {loadError && (
          <div className="mb-4 flex items-center gap-3">
            <p className="text-sm text-[color:var(--status-dropped)]">{t('loadFailed')}</p>
            <button onClick={loadSettings} className="btn-ghost border border-white/10 px-4 py-1.5 text-xs">
              {tc('retry')}
            </button>
          </div>
        )}
        {!loaded && !loadError && (
          <div className="mb-4 flex flex-col gap-2"><Skeleton variant="text" count={5} /></div>
        )}
        {loaded && (
          <>
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
          </>
        )}
        <div className="flex items-center gap-3">
          <button onClick={saveTaste} disabled={saving || !loaded} className="btn-solid px-5 py-2 text-sm">
            {saving ? t('saving') : t('save')}
          </button>
          {/* siker és hiba EGY helyen lakik: nem lehet mindkettőt látni */}
          {saved && !saveError && <span className="label-mono text-[color:var(--status-watching)]">{t('savedBadge')}</span>}
          {saveError && <span className="label-mono text-[color:var(--status-dropped)]">{saveError}</span>}
        </div>
      </section>

      <section className="glass rounded-3xl p-6">
        <p className="label-mono mb-1">{t('graphKicker')}</p>
        <p className="text-sm text-text-2 mb-4">{t('graphText')}</p>
        <div className="flex items-center gap-3">
          {/* A vezérlő attól a gráftól MESSZE lakik, amit befolyásol (§16:
              a vezérlő álljon amellett, amire hat). Amíg át nem költözik a
              HierarchyPanelbe, legalább ne PUT-oljon null-t sikert jelentve:
              mentett elrendezés nélkül tiltva van, és a link odavisz. */}
          <button
            onClick={saveHierarchyDefault}
            disabled={!hasSavedLayout}
            className="btn-ghost border border-white/10 px-5 py-2 text-sm disabled:opacity-40"
          >
            {t('graphSave')}
          </button>
          {!hasSavedLayout && (
            <a href="/graph" className="text-xs text-text-3 underline underline-offset-4 hover:text-text-1">
              {t('graphOpen')}
            </a>
          )}
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

      {/* A fióktörlés LEGALULRA került, és az űrlapja lenyíló mögé.
          Korábban tizenkét szekció állt egy szinten, és a visszafordíthatatlan
          művelet űrlapja VÉGIG kinyitva ült közöttük — a §16.6 szerint a
          gyakori út jön elöl, a haladó/veszélyes egy szinttel lejjebb.
          A nyitás-mechanika a SeasonFilterBar bevált 0fr→1fr rácsa. */}
      <section className="rounded-3xl border border-red-400/25 bg-red-500/5 p-6">
        <button
          onClick={() => setDeleteOpen((o) => !o)}
          aria-expanded={deleteOpen}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <span>
            <span className="label-mono mb-1 block text-red-200">{t('deleteKicker')}</span>
            <span className="block text-sm text-text-2">{t('deleteText')}</span>
          </span>
          <span aria-hidden className="shrink-0 text-text-3">{deleteOpen ? '▾' : '▸'}</span>
        </button>
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{ gridTemplateRows: deleteOpen ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div className="grid gap-3 max-w-md pt-5">
              <input
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder={t('currentPassword')}
                className="field px-4 py-2 text-sm"
                tabIndex={deleteOpen ? 0 : -1}
              />
              <input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={t('typeDelete')}
                className="field px-4 py-2 text-sm"
                tabIndex={deleteOpen ? 0 : -1}
              />
              <button
                onClick={deleteAccount}
                disabled={deleting || !deletePassword || deleteConfirmation !== 'DELETE'}
                tabIndex={deleteOpen ? 0 : -1}
                className="btn-ghost border border-red-400/35 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-40"
              >
                {deleting ? t('deleting') : t('deleteCta')}
              </button>
              {deleteError && <p className="text-sm text-red-200">{deleteError}</p>}
            </div>
          </div>
        </div>
      </section>

      <ProfileReveal open={revealOpen} onClose={() => setRevealOpen(false)} />
    </PageShell>
  )
}
