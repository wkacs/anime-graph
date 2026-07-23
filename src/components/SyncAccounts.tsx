'use client'
import { useCallback, useEffect, useState } from 'react'

type Status = {
  accounts: { provider: string; externalUsername: string | null }[]
  configured: { mal: boolean; anilist: boolean }
}

const PROVIDERS = [
  { key: 'mal', label: 'MyAnimeList' },
  { key: 'anilist', label: 'AniList' },
] as const

// Kétirányú szinkron (D3): fiók-bekötés OAuth-tal. Bekötés után minden itteni
// státusz/progressz/pont-változás automatikusan visszaíródik a külső listára.
export default function SyncAccounts() {
  const [status, setStatus] = useState<Status | null>(null)
  const [flash, setFlash] = useState('')

  const load = useCallback(() => {
    fetch('/api/sync/status').then((r) => r.json()).then(setStatus).catch(() => setStatus(null))
  }, [])

  useEffect(() => {
    load()
    const q = new URLSearchParams(window.location.search).get('sync')
    if (q === 'ok') setFlash('✓ Fiók bekötve — mostantól a változásaid automatikusan szinkronizálódnak.')
    else if (q) setFlash('✕ A bekötés nem sikerült — próbáld újra.')
  }, [load])

  async function disconnect(provider: string) {
    await fetch(`/api/sync/${provider}`, { method: 'DELETE' })
    load()
  }

  if (!status) return null

  return (
    <section className="glass rounded-3xl p-6">
      <p className="label-mono mb-1">Kétirányú szinkron</p>
      <p className="text-sm text-text-2 mb-4">
        Nem kell váltanod: kösd be a fiókod, és amit itt állítasz (státusz, rész, pont),
        automatikusan frissül a MAL/AniList-listádon is.
      </p>
      <div className="flex flex-col gap-2">
        {PROVIDERS.map((p) => {
          const acc = status.accounts.find((a) => a.provider === p.key)
          const configured = status.configured[p.key]
          return (
            <div key={p.key} className="flex items-center gap-3 rounded-2xl bg-white/4 border border-white/5 px-4 py-2.5">
              <span className="text-sm font-medium flex-1">{p.label}</span>
              {acc ? (
                <>
                  <span className="label-mono text-[color:var(--status-watching)]">
                    ✓ {acc.externalUsername ?? 'bekötve'}
                  </span>
                  <button onClick={() => disconnect(p.key)} className="text-xs text-text-3 hover:text-[color:var(--status-dropped)]">
                    Lekapcsol
                  </button>
                </>
              ) : configured ? (
                <a href={`/api/sync/${p.key}/start`} className="btn-ghost border border-white/10 px-3.5 py-1.5 text-xs">
                  Bekötés
                </a>
              ) : (
                <span className="label-mono text-text-3" title={`${p.key.toUpperCase()}_CLIENT_ID env hiányzik`}>
                  nincs konfigurálva
                </span>
              )}
            </div>
          )
        })}
      </div>
      {flash && <p className="label-mono mt-4">{flash}</p>}
    </section>
  )
}
