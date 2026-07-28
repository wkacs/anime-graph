'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Avatar from './Avatar'

const MAX_BIO = 500

// Profil-szekció a Beállításokon: bio, láthatóság, és link a publikus oldalra.
// Az avatar a felhasználónévből generálódik, nincs feltöltés.
export default function ProfileSettings() {
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = useTranslations('profileSettings')

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return
        setUsername(j.username ?? '')
        setBio(j.bio ?? '')
        setVisibility(j.profileVisibility === 'private' ? 'private' : 'public')
      })
      .catch(() => {})
  }, [])

  async function save(next: { bio?: string; profileVisibility?: 'public' | 'private' }) {
    setBusy(true); setSaved(false)
    try {
      const r = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (r.ok) setSaved(true)
    } finally {
      setBusy(false)
    }
  }

  if (!username) return null

  return (
    <section className="glass rounded-3xl p-6 flex flex-col gap-4">
      <p className="label-mono">Profil</p>

      <div className="flex items-center gap-4">
        <Avatar username={username} size={56} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{username}</p>
          <Link
            href={`/u/${username}`}
            className="text-xs text-text-3 hover:text-text-2 underline underline-offset-4 decoration-white/20"
          >
            /u/{username}
          </Link>
        </div>
      </div>

      <div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO))}
          onBlur={() => save({ bio })}
          rows={3}
          placeholder={t('bioPlaceholder')}
          className="field w-full px-4 py-2.5 text-sm resize-y"
        />
        <p className="text-[11px] font-mono text-text-3 mt-1">{bio.length}/{MAX_BIO}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm">{t('publicProfile')}</p>
          <p className="text-xs text-text-3">{t('visibilityHint', { username })}</p>
        </div>
        <div className="flex rounded-full bg-white/5 p-1 text-xs">
          {(['public', 'private'] as const).map((v) => (
            <button
              key={v}
              type="button"
              disabled={busy}
              onClick={() => { setVisibility(v); save({ profileVisibility: v }) }}
              className={`rounded-full px-3 py-1 transition-colors ${
                visibility === v ? 'bg-white/12 text-text-1' : 'text-text-3 hover:text-text-2'
              }`}
            >
              {v === 'public' ? t('public') : t('private')}
            </button>
          ))}
        </div>
      </div>

      {saved && <p className="text-[13px] text-text-2">{t('saved')}</p>}
    </section>
  )
}
