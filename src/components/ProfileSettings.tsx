'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import Avatar from './Avatar'
import {
  EMPTY_PROFILE_CUSTOM, PROFILE_ACCENTS, sanitizeProfileCustom, type ProfileCustom,
} from '@/lib/profile-custom'
import type { ApiAnime } from '@/lib/types'

const MAX_BIO = 500
const MAX_FAV_GENRES = 5

type FavChar = { charId: number; name: string; image: string | null }

// Profil-szekció a Beállításokon: bio, láthatóság, és a teljes személyre-
// szabás — avatar (saját borító / kedvenc karakter), banner, akcentszín,
// kedvenc műfajok, valamint hogy a publikus oldal mely szekciókat mutassa.
export default function ProfileSettings() {
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [custom, setCustom] = useState<ProfileCustom>(EMPTY_PROFILE_CUSTOM)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTab, setPickerTab] = useState<'chars' | 'covers'>('chars')
  const [list, setList] = useState<ApiAnime[]>([])
  const [chars, setChars] = useState<FavChar[]>([])
  const t = useTranslations('profileSettings')

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return
        setUsername(j.username ?? '')
        setBio(j.bio ?? '')
        setVisibility(j.profileVisibility === 'public' ? 'public' : 'private')
        // a szerver sanitizált objektumot tárol, de a kliens-oldali defaultokat
        // (sections) így is a sanitizer teszi teljessé
        setCustom(sanitizeProfileCustom(j.profileCustom))
      })
      .catch(() => {})
    fetch('/api/anime')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setList(j.anime ?? []) })
      .catch(() => {})
    fetch('/api/characters/favorites')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setChars(j.favorites ?? []) })
      .catch(() => {})
  }, [])

  async function save(next: {
    bio?: string
    profileVisibility?: 'public' | 'private'
    profileCustom?: ProfileCustom
  }) {
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

  // a PUT a teljes profileCustom objektumot cseréli, ezért minden módosítás
  // a helyi state-ből indul és egyben megy fel
  function updateCustom(patch: Partial<ProfileCustom>) {
    const next = { ...custom, ...patch }
    setCustom(next)
    save({ profileCustom: next })
  }

  // banner-jelöltek: saját címek, amiknek van bannere (címenként egyszer)
  const bannerOptions = useMemo(() => {
    const seen = new Set<number>()
    return list.filter((a) => {
      if (!a.bannerUrl || seen.has(a.titleId)) return false
      seen.add(a.titleId)
      return true
    })
  }, [list])

  // műfaj-jelöltek a saját listából, gyakoriság szerint
  const genreOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of list) for (const g of a.genres) counts.set(g, (counts.get(g) ?? 0) + 1)
    return [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([g]) => g).slice(0, 18)
  }, [list])

  const coverOptions = useMemo(() => {
    const seen = new Set<number>()
    return list.filter((a) => {
      if (!a.coverUrl || seen.has(a.titleId)) return false
      seen.add(a.titleId)
      return true
    })
  }, [list])

  function toggleGenre(g: string) {
    const has = custom.favGenres.includes(g)
    if (!has && custom.favGenres.length >= MAX_FAV_GENRES) return
    updateCustom({
      favGenres: has ? custom.favGenres.filter((x) => x !== g) : [...custom.favGenres, g],
    })
  }

  if (!username) return null

  const sectionRows = [
    { key: 'stats' as const, label: t('sectionStats') },
    { key: 'top' as const, label: t('sectionTop') },
    { key: 'activity' as const, label: t('sectionActivity') },
  ]

  return (
    <section className="glass rounded-3xl p-6 flex flex-col gap-5">
      <p className="label-mono">{t('heading')}</p>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar username={username} size={64} src={custom.avatarUrl} />
        <div className="min-w-0 mr-auto">
          <p className="text-sm font-medium">{custom.displayName ?? username}</p>
          <Link
            href={`/u/${encodeURIComponent(username)}`}
            className="text-xs text-text-3 hover:text-text-2 underline underline-offset-4 decoration-white/20"
          >
            /u/{username}
          </Link>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="btn-ghost border border-white/10 rounded-full px-3.5 py-1.5 text-xs"
          >
            {t('avatarChange')}
          </button>
          {custom.avatarUrl && (
            <button
              type="button"
              onClick={() => updateCustom({ avatarUrl: null })}
              className="btn-ghost border border-white/10 rounded-full px-3.5 py-1.5 text-xs"
            >
              {t('avatarMonogram')}
            </button>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm mb-1.5">{t('displayNameLabel')}</p>
        <input
          value={custom.displayName ?? ''}
          onChange={(e) => setCustom((c) => ({ ...c, displayName: e.target.value || null }))}
          onBlur={() => save({ profileCustom: custom })}
          maxLength={40}
          placeholder={username}
          className="field w-full px-4 py-2.5 text-sm"
        />
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

      {bannerOptions.length > 0 && (
        <div>
          <p className="text-sm mb-2">{t('banner')}</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => updateCustom({ bannerTitleId: null })}
              aria-pressed={custom.bannerTitleId == null}
              className={`shrink-0 w-36 h-14 rounded-[var(--r-sm)] border text-xs text-text-3 ${
                custom.bannerTitleId == null ? 'border-white/60 text-text-1' : 'border-dashed border-white/15 hover:border-white/30'
              }`}
            >
              {t('bannerNone')}
            </button>
            {bannerOptions.map((a) => (
              <button
                key={a.titleId}
                type="button"
                onClick={() => updateCustom({ bannerTitleId: a.titleId })}
                aria-pressed={custom.bannerTitleId === a.titleId}
                title={a.titleRomaji}
                className={`relative shrink-0 rounded-[var(--r-sm)] overflow-hidden border transition-colors ${
                  custom.bannerTitleId === a.titleId ? 'border-white/70' : 'border-white/10 hover:border-white/30'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.bannerUrl!} alt={a.titleRomaji} loading="lazy" className="w-36 h-14 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm mb-2">{t('accent')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => updateCustom({ accent: null })}
            aria-pressed={custom.accent == null}
            title={t('accentNone')}
            className={`w-7 h-7 rounded-full border ${
              custom.accent == null ? 'border-white/70' : 'border-dashed border-white/25 hover:border-white/50'
            }`}
          />
          {PROFILE_ACCENTS.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => updateCustom({ accent: hex })}
              aria-pressed={custom.accent === hex}
              title={hex}
              className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${
                custom.accent === hex ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#09090b]' : ''
              }`}
              style={{ background: hex }}
            />
          ))}
        </div>
      </div>

      {genreOptions.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <p className="text-sm">{t('favGenres')}</p>
            <p className="text-[11px] font-mono text-text-3">{custom.favGenres.length}/{MAX_FAV_GENRES}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {genreOptions.map((g) => {
              const active = custom.favGenres.includes(g)
              const full = !active && custom.favGenres.length >= MAX_FAV_GENRES
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  aria-pressed={active}
                  disabled={full}
                  className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                    active
                      ? 'bg-white/12 border-white/30 text-text-1'
                      : 'border-white/10 text-text-3 hover:text-text-1 disabled:opacity-35'
                  }`}
                >
                  {g}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm mb-2">{t('sections')}</p>
        <div className="flex flex-col gap-2">
          {sectionRows.map((row) => {
            const on = custom.sections[row.key]
            return (
              <div key={row.key} className="flex items-center justify-between gap-3">
                <p className="text-sm text-text-2">{row.label}</p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  disabled={busy}
                  onClick={() => updateCustom({ sections: { ...custom.sections, [row.key]: !on } })}
                  className={`relative w-10 h-6 rounded-full transition-colors ${on ? 'bg-white/35' : 'bg-white/10'}`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-[left] ${on ? 'left-5' : 'left-1'}`}
                  />
                  <span className="sr-only">{row.label}</span>
                </button>
              </div>
            )
          })}
        </div>
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
              aria-pressed={visibility === v}
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

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('avatarPickerTitle')}
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="surface-3 rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
              <p className="text-sm font-medium">{t('avatarPickerTitle')}</p>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-text-3 hover:text-text-1 text-sm"
                aria-label={t('close')}
              >
                ✕
              </button>
            </div>
            <div className="flex gap-1 px-5 pb-3">
              {(['chars', 'covers'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPickerTab(tab)}
                  aria-pressed={pickerTab === tab}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                    pickerTab === tab ? 'bg-white/12 text-text-1' : 'text-text-3 hover:text-text-1'
                  }`}
                >
                  {tab === 'chars' ? t('avatarChars') : t('avatarCovers')}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto px-5 pb-5">
              {pickerTab === 'chars' && (
                chars.filter((c) => c.image).length === 0 ? (
                  <p className="text-xs text-text-3 py-6 text-center">{t('avatarNoChars')}</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                    {chars.filter((c) => c.image).map((c) => (
                      <button
                        key={c.charId}
                        type="button"
                        title={c.name}
                        onClick={() => { updateCustom({ avatarUrl: c.image }); setPickerOpen(false) }}
                        className="group flex flex-col items-center gap-1.5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={c.image!}
                          alt={c.name}
                          loading="lazy"
                          className={`w-16 h-16 rounded-full object-cover border transition-colors ${
                            custom.avatarUrl === c.image ? 'border-white/80' : 'border-white/10 group-hover:border-white/40'
                          }`}
                        />
                        <span className="text-[10px] text-text-3 line-clamp-1 max-w-full">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )
              )}
              {pickerTab === 'covers' && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                  {coverOptions.map((a) => (
                    <button
                      key={a.titleId}
                      type="button"
                      title={a.titleRomaji}
                      onClick={() => { updateCustom({ avatarUrl: a.coverUrl }); setPickerOpen(false) }}
                      className="group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.coverUrl!}
                        alt={a.titleRomaji}
                        loading="lazy"
                        className={`w-full aspect-square rounded-full object-cover border transition-colors ${
                          custom.avatarUrl === a.coverUrl ? 'border-white/80' : 'border-white/10 group-hover:border-white/40'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
