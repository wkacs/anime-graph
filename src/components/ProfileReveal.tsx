'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { TasteProfile } from '@/lib/profile'

// Onboarding-wow: sikeres import után az AI megírja, ki vagy animenézőként.
// A profil a meglévő /api/profile-on generálódik (kind=profile cache a Stats-oldallal közös).
export default function ProfileReveal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<TasteProfile | null>(null)
  const [error, setError] = useState(false)
  const t = useTranslations('profileReveal')

  useEffect(() => {
    if (!open) return
    setProfile(null)
    setError(false)
    fetch('/api/profile', { method: 'POST' })
      .then((r) => r.json())
      .then((j) => (j.profile ? setProfile(j.profile) : setError(true)))
      .catch(() => setError(true))
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-strong rounded-3xl w-full max-w-lg p-7" onClick={(e) => e.stopPropagation()}>
        <p className="label-mono mb-1">{t('kicker')}</p>
        <h2 className="text-xl font-semibold tracking-tight mb-5">{t('heading')}</h2>

        {!profile && !error && (
          <p className="text-sm text-text-2 animate-pulse py-6">{t('reading')}</p>
        )}
        {error && <p className="text-sm text-text-3 py-6">{t('failed')}</p>}
        {profile && (
          <>
            <p className="text-sm text-text-1 leading-relaxed mb-5">{profile.portrait}</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {profile.badges.map((b) => (
                <span key={b} className="glass rounded-full px-3.5 py-1.5 text-xs font-mono text-text-1">{b}</span>
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">{t('close')}</button>
          <a href="/stats" className="btn-solid px-5 py-2 text-sm">{t('myStats')}</a>
        </div>
      </div>
    </div>
  )
}
