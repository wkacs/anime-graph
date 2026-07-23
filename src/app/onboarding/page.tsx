'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import PushToggle from '@/components/PushToggle'
import type { TasteProfile } from '@/lib/profile'

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
    if (!media.length) throw new Error('üres')
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
      setImportResult(res.ok ? 'Üres lista jött vissza — próbáld a másik fület' : `✕ ${json.error ?? 'Hiba történt'}`)
    }
  }

  async function importMal(file: File) {
    setImporting('mal')
    setImportResult('')
    const xml = await file.text()
    const res = await fetch('/api/import/mal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ xml }),
    })
    const json = await res.json()
    setImporting(null)
    if (res.ok && json.added + json.updated > 0) {
      setHasList(true)
      setStep(2)
    } else {
      setImportResult(res.ok ? 'Üres lista jött vissza — próbáld a másik fület' : `✕ ${json.error ?? 'Hiba történt'}`)
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

  const stepLabel = ['Listád', 'Profilod', 'Értesítések', 'Indulás'][step - 1]

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 pt-24 pb-16 flex flex-col gap-5">
      <div>
        <p className="label-mono mb-1">Első lépések · {step}/4 — {stepLabel}</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            <span key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-white/70' : 'bg-white/10'}`} />
          ))}
        </div>
      </div>

      {step === 1 && (
        <section className="glass rounded-3xl p-6 flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight mb-1">Hozd át az anime-életed</h1>
            <p className="text-sm text-text-2">
              30 másodperc, és az AI megmondja, ki vagy animenézőként — ajánlásokkal.
            </p>
          </div>
          <div className="flex gap-2">
            {([['import', 'Van listám (MAL/AniList)'], ['seed', 'Nincs listám']] as const).map(([k, label]) => (
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
                  placeholder="AniList felhasználónév"
                  className="field px-4 py-2 text-sm w-56"
                />
                <button onClick={importAnilist} disabled={importing !== null || !anilistUser.trim()} className="btn-solid px-4 py-2 text-sm">
                  {importing === 'anilist' ? 'Import…' : 'Importálás'}
                </button>
              </div>
              <label className={`btn-ghost border border-white/10 px-4 py-2 text-sm cursor-pointer self-start ${importing ? 'opacity-40 pointer-events-none' : ''}`}>
                {importing === 'mal' ? 'Import…' : 'Vagy MAL-export (.xml) feltöltése'}
                <input
                  type="file" accept=".xml,text/xml" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importMal(f); e.target.value = '' }}
                />
              </label>
              {importResult && <p className="label-mono text-[color:var(--status-dropped)]">{importResult}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-2">
                Jelöld meg, amiket láttad és szeretted — legalább {SEED_MIN}-öt. Ebből indul az ízlés-modell.
              </p>
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
                {importing === 'seed' ? 'Mentés…' : `Tovább (${picked.size}/${SEED_MIN})`}
              </button>
            </div>
          )}

          <button onClick={() => setSkipConfirm(true)} className="text-xs text-text-3 hover:text-text-1 self-start">
            Kihagyom
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="glass rounded-3xl p-6">
          <p className="label-mono mb-1">Az AI elolvasta a listád</p>
          <h1 className="text-xl font-semibold tracking-tight mb-4">Ki vagy te animenézőként?</h1>
          {profileState === 'busy' && <p className="text-sm text-text-2 animate-pulse py-4">Olvassuk az ízlésed…</p>}
          {profileState === 'error' && (
            <p className="text-sm text-text-3 py-4">Most nem sikerült a portré — a Stats oldalon bármikor újrapróbálhatod.</p>
          )}
          {profile && (
            <>
              <p className="text-sm text-text-1 leading-relaxed mb-4">{profile.portrait}</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {profile.badges.map((b) => (
                  <span key={b} className="glass rounded-full px-3.5 py-1.5 text-xs font-mono text-text-1">{b}</span>
                ))}
              </div>
            </>
          )}
          <button onClick={() => setStep(3)} className="btn-solid px-5 py-2 text-sm mt-4">Tovább →</button>
        </section>
      )}

      {step === 3 && (
        <section className="glass rounded-3xl p-6">
          <p className="label-mono mb-1">Értesítések</p>
          <h1 className="text-xl font-semibold tracking-tight mb-2">Szólunk, ha jön az új rész</h1>
          <p className="text-sm text-text-2 mb-4">
            Push a követett animéid új részeiről, évfordulókról és az új szezonról. Bármikor kikapcsolható.
          </p>
          <PushToggle />
          <div className="mt-5">
            <button onClick={() => setStep(4)} className="btn-solid px-5 py-2 text-sm">Tovább →</button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="glass rounded-3xl p-6">
          <p className="label-mono mb-1">Kész ✓</p>
          <h1 className="text-xl font-semibold tracking-tight mb-2">Indulhat</h1>
          <p className="text-sm text-text-2 mb-5">
            A főoldalon egy rövid túra megmutatja a lényeget — a többi oldal az első látogatáskor mutatkozik be.
          </p>
          <button onClick={finishWizard} className="btn-solid px-6 py-2.5 text-sm">Irány az app →</button>
        </section>
      )}

      {step === 1 && (
        <p className="text-xs text-text-3">
          A szezon-naptár és a katalógus lista nélkül is működik — de az ajánló és a gráf a listádból él.
        </p>
      )}

      {skipConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSkipConfirm(false)}>
          <div className="glass-strong rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <p className="label-mono mb-1">Biztos kihagyod?</p>
            <p className="text-sm text-text-2 mb-5">
              Lista nélkül az ajánló és a gráf üres marad. A szezon-naptár enélkül is működik,
              és a Beállításokból bármikor importálhatsz később.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setSkipConfirm(false)} className="btn-solid px-4 py-2 text-sm">Visszamegyek</button>
              <button
                onClick={() => { setSkipConfirm(false); setStep(3) }}
                className="btn-ghost px-4 py-2 text-sm text-text-3"
              >
                Kihagyom így is
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
