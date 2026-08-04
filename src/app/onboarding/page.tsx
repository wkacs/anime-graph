'use client'
import { useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import PushToggle from '@/components/PushToggle'
import Dialog from '@/components/ui/Dialog'
import type { TasteProfile } from '@/lib/profile'
import { readMalExport } from '@/lib/mal-export'
import PageShell from '@/components/ui/PageShell'

const SEED_MIN = 5

type SeedTitle = { anilistId: number; titleRomaji: string; coverUrl: string | null }

// Seedhez ISMERŐS címek kellenek → AniList popularitás-toplista (CORS-t ad, kulcs nélkül);
// ha nem elérhető, a saját katalógus top-scored listája a fallback.
async function fetchSeedPool(): Promise<SeedTitle[]> {
  try {
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query{Page(perPage:24){media(type:ANIME,sort:POPULARITY_DESC){id title{romaji}coverImage{large}}}}',
      }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const j = await res.json() as { data?: { Page?: { media?: { id: number; title: { romaji: string }; coverImage: { large: string | null } }[] } } }
    const media = j.data?.Page?.media ?? []
    if (!media.length) throw new Error('empty')
    return media.map((m) => ({ anilistId: m.id, titleRomaji: m.title.romaji, coverUrl: m.coverImage.large }))
  } catch {
    const res = await fetch('/api/browse?sort=SCORE_DESC')
    const j = await res.json() as { media?: { anilistId: number; titleRomaji: string; coverUrl: string | null }[] }
    return (j.media ?? []).map((m) => ({ anilistId: m.anilistId, titleRomaji: m.titleRomaji, coverUrl: m.coverUrl }))
  }
}

// Onboarding-wizard: (1) lista (import VAGY seed-választás) → (2) AI-profil-reveal →
// (3) push → (4) indulás (?tour=1 → News-túra). Minden lépés kihagyható,
// az 1.-nél megerősítéssel (enélkül üres az ajánló/gráf).
export default function OnboardingPage() {
  const t = useTranslations('onboarding')
  const tc = useTranslations('common')
  const skipHeadingId = useId()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [tab, setTab] = useState<'import' | 'seed'>('import')
  const [hasList, setHasList] = useState(false)
  const [skipConfirm, setSkipConfirm] = useState(false)

  const [anilistUser, setAnilistUser] = useState('')
  const [importing, setImporting] = useState<'anilist' | 'mal' | 'seed' | null>(null)
  const [importResult, setImportResult] = useState('')

  const [seeds, setSeeds] = useState<SeedTitle[]>([])
  const [picked, setPicked] = useState<Set<number>>(new Set())

  const [profile, setProfile] = useState<TasteProfile | null>(null)
  const [profileState, setProfileState] = useState<'idle' | 'busy' | 'error'>('idle')

  useEffect(() => {
    if (tab !== 'seed' || seeds.length) return
    fetchSeedPool()
      .then((pool) => setSeeds(pool.filter((m) => m.coverUrl).slice(0, 24)))
      .catch(() => setSeeds([]))
  }, [tab, seeds.length])

  useEffect(() => {
    if (step !== 2 || !hasList || profileState !== 'idle') return
    setProfileState('busy')
    fetch('/api/profile', { method: 'POST' })
      .then((r) => r.json())
      .then((j) => { if (j.profile) { setProfile(j.profile); setProfileState('idle') } else setProfileState('error') })
      .catch(() => setProfileState('error'))
  }, [step, hasList, profileState])

  async function importAnilist() {
    if (!anilistUser.trim()) return
    setImporting('anilist')
    setImportResult('')
    const res = await fetch('/api/import/anilist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: anilistUser.trim() }),
    })
    const json = await res.json()
    setImporting(null)
    if (res.ok && json.added + json.updated > 0) {
      setHasList(true)
      setStep(2)
    } else {
      setImportResult(res.ok ? t('emptyImport') : `✕ ${json.error ?? t('genericError')}`)
    }
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
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ xml }),
    })
    const json = await res.json()
    setImporting(null)
    if (res.ok && json.added + json.updated > 0) {
      setHasList(true)
      setStep(2)
    } else {
      setImportResult(res.ok ? t('emptyImport') : `✕ ${json.error ?? t('genericError')}`)
    }
  }

  async function saveSeeds() {
    setImporting('seed')
    for (const anilistId of picked) {
      await fetch('/api/anime', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anilistId, status: 'completed' }),
      }).catch(() => { /* egy-egy hiba nem állítja meg a többit */ })
    }
    setImporting(null)
    setHasList(true)
    setStep(2)
  }

  async function finishWizard() {
    await fetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingDone: true }),
    }).catch(() => { /* flag nélkül is induljon az app */ })
    router.push('/?tour=1')
  }

  const stepLabel = [t('step1'), t('step2'), t('step3'), t('step4')][step - 1]

  return (
    <PageShell width="compact" className="flex flex-col gap-5">
      <div>
        <p className="label-mono mb-1">{t('kicker', { step, label: stepLabel })}</p>
        {/* A már elhagyott lépések VISSZAKATTINTHATÓK. A varázsló eddig csak
            előre engedett: egy elgépelt AniList-név vagy rossz gombválasztás
            után nem volt út vissza (§16.2 — kínálj választást, ne kényszeríts
            egyetlen útra). A `picked`/`anilistUser`/`hasList` komponens-állapot
            és nem törlődik lépéskor, tehát a korábbi lépés a beírt adattal jön. */}
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            s < step ? (
              <button
                key={s}
                onClick={() => setStep(s)}
                aria-label={t('backToStep', { step: s })}
                className="h-1 flex-1 rounded-full bg-white/70 hover:bg-white cursor-pointer"
              />
            ) : (
              <span key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-white/70' : 'bg-white/10'}`} />
            )
          ))}
        </div>
      </div>

      {step === 1 && (
        <section className="glass rounded-3xl p-6 flex flex-col gap-4">
          <div>
            <h1 className="display-m mb-1">{t('s1Title')}</h1>
            <p className="text-sm text-text-2">{t('s1Text')}</p>
          </div>
          <div className="flex gap-2">
            {([['import', t('tabImport')], ['seed', t('tabSeed')]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-full px-4 py-1.5 text-xs font-mono uppercase tracking-wide border transition-colors ${
                  tab === k ? 'border-white/50 text-text-1' : 'border-white/10 text-text-3 hover:text-text-1'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'import' ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={anilistUser}
                  onChange={(e) => setAnilistUser(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') importAnilist() }}
                  placeholder={t('anilistPlaceholder')}
                  className="field px-4 py-2 text-sm w-56"
                />
                <button onClick={importAnilist} disabled={importing !== null || !anilistUser.trim()} className="btn-solid px-4 py-2 text-sm">
                  {importing === 'anilist' ? t('importing') : t('importCta')}
                </button>
              </div>
              <label className={`btn-ghost border border-white/10 px-4 py-2 text-sm cursor-pointer self-start ${importing ? 'opacity-40 pointer-events-none' : ''}`}>
                {importing === 'mal' ? t('importing') : t('malUpload')}
                <input
                  type="file" accept=".xml,.gz,application/xml,text/xml,application/gzip" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importMal(f); e.target.value = '' }}
                />
              </label>
              {importResult && <p className="label-mono text-[color:var(--status-dropped)]">{importResult}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-2">{t('seedIntro', { min: SEED_MIN })}</p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {seeds.map((s) => {
                  const on = picked.has(s.anilistId)
                  return (
                    <button
                      key={s.anilistId}
                      onClick={() => setPicked((p) => { const n = new Set(p); if (on) n.delete(s.anilistId); else n.add(s.anilistId); return n })}
                      title={s.titleRomaji}
                      className={`relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all ${
                        on ? 'border-white scale-95' : 'border-transparent hover:border-white/40'
                      }`}
                    >
                      <Image src={s.coverUrl!} alt={s.titleRomaji} fill sizes="120px" className="object-cover" />
                      {on && <span className="absolute top-1 right-1 glass rounded-full w-6 h-6 grid place-items-center text-xs">✓</span>}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={saveSeeds}
                disabled={picked.size < SEED_MIN || importing !== null}
                className="btn-solid px-5 py-2 text-sm self-start disabled:opacity-40"
              >
                {importing === 'seed' ? t('saving') : t('seedNext', { picked: picked.size, min: SEED_MIN })}
              </button>
            </div>
          )}

          <button onClick={() => setSkipConfirm(true)} className="text-xs text-text-3 hover:text-text-1 self-start">
            {t('skip')}
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="glass rounded-3xl p-6">
          <p className="label-mono mb-1">{t('s2Kicker')}</p>
          <h1 className="display-m mb-4">{t('s2Title')}</h1>
          {profileState === 'busy' && <p className="text-sm text-text-2 animate-pulse py-4">{t('s2Busy')}</p>}
          {profileState === 'error' && (
            <p className="text-sm text-text-3 py-4">{t('s2Error')}</p>
          )}
          {profile && (
            <>
              <p className="text-sm text-text-1 leading-relaxed mb-4">{profile.portrait}</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.badges.map((b) => (
                  // chip-inset, nem glass: üveg fölé nem kerülhet üveg (§12)
                  <span key={b} className="chip-inset rounded-full px-3.5 py-1.5 text-xs font-mono text-text-1">{b}</span>
                ))}
              </div>
            </>
          )}
          <div className="flex items-center gap-3 mt-4">
            <button onClick={() => setStep(1)} className="btn-ghost px-4 py-2 text-sm">{tc('back')}</button>
            <button onClick={() => setStep(3)} className="btn-solid px-5 py-2 text-sm">{t('next')}</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="glass rounded-3xl p-6">
          <p className="label-mono mb-1">{t('s3Kicker')}</p>
          <h1 className="display-m mb-2">{t('s3Title')}</h1>
          <p className="text-sm text-text-2 mb-4">{t('s3Text')}</p>
          <PushToggle />
          <div className="flex items-center gap-3 mt-5">
            <button onClick={() => setStep(2)} className="btn-ghost px-4 py-2 text-sm">{tc('back')}</button>
            <button onClick={() => setStep(4)} className="btn-solid px-5 py-2 text-sm">{t('next')}</button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="glass rounded-3xl p-6">
          <p className="label-mono mb-1">{t('s4Kicker')}</p>
          <h1 className="display-m mb-2">{t('s4Title')}</h1>
          <p className="text-sm text-text-2 mb-5">{t('s4Text')}</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setStep(3)} className="btn-ghost px-4 py-2 text-sm">{tc('back')}</button>
            <button onClick={finishWizard} className="btn-solid px-6 py-2.5 text-sm">{t('s4Cta')}</button>
          </div>
        </section>
      )}

      {step === 1 && (
        <p className="text-xs text-text-3">{t('s1Note')}</p>
      )}

      {/* eddig mozgás nélkül vágott be és tűnt el, aria és Escape nélkül */}
      <Dialog
        open={skipConfirm}
        onClose={() => setSkipConfirm(false)}
        labelledBy={skipHeadingId}
        panelClassName="glass-strong rounded-3xl w-full max-w-sm p-6"
      >
        <p id={skipHeadingId} className="label-mono mb-1">{t('skipConfirmTitle')}</p>
        <p className="text-sm text-text-2 mb-5">{t('skipConfirmText')}</p>
        <div className="flex items-center justify-end gap-3">
          <button onClick={() => setSkipConfirm(false)} className="btn-solid px-4 py-2 text-sm">{t('skipBack')}</button>
          <button
            onClick={() => { setSkipConfirm(false); setStep(3) }}
            className="btn-ghost px-4 py-2 text-sm text-text-3"
          >
            {t('skipAnyway')}
          </button>
        </div>
      </Dialog>
    </PageShell>
  )
}
