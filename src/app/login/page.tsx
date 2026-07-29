'use client'
import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LocaleSwitcher from '@/components/LocaleSwitcher'

type Mode = 'login' | 'register' | 'forgot' | 'reset'

export default function LoginPage() {
  const t = useTranslations('auth')
  const locale = useLocale()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  // a meghívó-mező csak akkor jelenik meg, ha a szerver tényleg kéri (invite mód)
  const [inviteNeeded, setInviteNeeded] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [nextPath, setNextPath] = useState('/')
  const router = useRouter()

  // window.location-ből olvassuk, nem useSearchParams-szal: az Suspense-határt
  // követelne ezen a statikusan renderelt oldalon.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('reset')
    if (token) { setResetToken(token); setMode('reset') }
    const next = new URLSearchParams(window.location.search).get('next')
    // Csak belső, abszolút útvonalra irányítunk vissza; a //example.com
    // formátum nyitott redirect lenne.
    if (next?.startsWith('/') && !next.startsWith('//')) setNextPath(next)
  }, [])

  function switchTo(next: Mode) {
    setMode(next); setError(''); setNotice('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setNotice(''); setBusy(true)
    try {
      if (mode === 'forgot') {
        await fetch('/api/auth/forgot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        // szándékosan ugyanaz a válasz létező és nem létező címre
        setNotice(t('forgotSent'))
        return
      }

      if (mode === 'reset') {
        const res = await fetch('/api/auth/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password }),
        })
        if (res.ok) { router.push('/'); return }
        setError((await res.json().catch(() => null))?.error ?? t('genericError'))
        return
      }

      const res = await fetch(mode === 'login' ? '/api/auth' : '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login'
            ? { username, password }
            // A felület nyelvét visszük tovább a fiókba. Korábban beégetett
            // 'hu' volt: minden új felhasználó magyar beállítással jött létre,
            // akkor is, ha végig angolul regisztrált.
            : { username, email, password, invite, locale },
        ),
      })
      if (res.ok) { router.push(mode === 'register' ? '/onboarding' : nextPath); return }
      const json = await res.json().catch(() => null)
      if (res.status === 403) setInviteNeeded(true)
      setError(json?.error ?? t('genericError'))
    } finally {
      setBusy(false)
    }
  }

  const submitLabel = {
    login: t('submitLogin'),
    register: t('submitRegister'),
    forgot: t('submitForgot'),
    reset: t('submitReset'),
  }[mode]

  return (
    <main className="min-h-screen flex items-center justify-center px-4 relative">
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <Link href="/" className="label-mono text-text-2 hover:text-text-1">Anime Graph</Link>
        <LocaleSwitcher compact />
      </div>
      <form onSubmit={submit} className="glass rounded-3xl flex flex-col gap-4 w-80 px-8 py-10">
        <div className="text-center mb-1">
          <p className="label-mono mb-2">アニメグラフ</p>
          <h1 className="text-xl font-semibold tracking-tight">Anime Graph</h1>
        </div>

        {(mode === 'login' || mode === 'register') && (
          <div className="flex rounded-full bg-white/5 p-1 text-sm">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchTo(m)}
                className={`flex-1 rounded-full py-1.5 transition-colors ${
                  mode === m ? 'bg-white/12 text-text-1' : 'text-text-3 hover:text-text-2'
                }`}
              >
                {m === 'login' ? t('tabLogin') : t('tabRegister')}
              </button>
            ))}
          </div>
        )}

        {mode === 'forgot' && (
          <p className="text-[13px] text-text-2 text-center -mt-1">{t('forgotHint')}</p>
        )}
        {mode === 'reset' && (
          <p className="text-[13px] text-text-2 text-center -mt-1">{t('resetHint')}</p>
        )}

        {(mode === 'login' || mode === 'register') && (
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('username')}
            autoComplete="username"
            className="field px-4 py-2.5 text-sm"
            autoFocus
          />
        )}

        {(mode === 'register' || mode === 'forgot') && (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('email')}
            autoComplete="email"
            className="field px-4 py-2.5 text-sm"
          />
        )}

        {mode !== 'forgot' && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'login' ? t('password') : t('passwordNew')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="field px-4 py-2.5 text-sm"
          />
        )}

        {mode === 'register' && inviteNeeded && (
          <input
            value={invite}
            onChange={(e) => setInvite(e.target.value)}
            placeholder={t('inviteCode')}
            className="field px-4 py-2.5 text-sm"
          />
        )}

        {error && <p className="text-[13px] text-[color:var(--status-dropped)] -mt-1">{error}</p>}
        {notice && <p className="text-[13px] text-text-2 -mt-1">{notice}</p>}

        <button type="submit" disabled={busy} className="btn-solid py-2.5 text-sm">
          {busy ? '…' : submitLabel}
        </button>

        {/* A regisztráció a hozzájárulás pillanata: itt kell látnia a
            feltételeket, nem egy eldugott láblécben. */}
        {mode === 'register' && (
          <p className="text-[11px] leading-relaxed text-text-3">
            {t('termsPrefix')}{' '}
            <Link href="/aszf" className="text-text-2 underline decoration-white/20 underline-offset-2 hover:text-text-1">
              {t('termsLink')}
            </Link>{' '}
            {t('termsMiddle')}{' '}
            <Link href="/adatvedelem" className="text-text-2 underline decoration-white/20 underline-offset-2 hover:text-text-1">
              {t('privacyLink')}
            </Link>
            {t('termsSuffix')}
          </p>
        )}

        {mode === 'login' && (
          <button
            type="button"
            onClick={() => switchTo('forgot')}
            className="text-xs text-text-3 hover:text-text-2 transition-colors"
          >
            {t('forgotLink')}
          </button>
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <button
            type="button"
            onClick={() => switchTo('login')}
            className="text-xs text-text-3 hover:text-text-2 transition-colors"
          >
            {t('backToLogin')}
          </button>
        )}
      </form>
    </main>
  )
}
