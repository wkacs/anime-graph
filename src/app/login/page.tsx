'use client'
import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import { validateRegistration } from '@/lib/registration'

type Mode = 'login' | 'register' | 'forgot' | 'reset'
type Field = 'email' | 'username' | 'password'

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
  // Mezőnkénti hiba: eddig a három regisztrációs input NEM vitt semmilyen
  // kliens-oldali szabályt, a szerver pedig kifejezetten `{ error, field }`-et
  // ad vissza, hogy rá lehessen mutatni a hibásra — a kliens ezt eldobta, és
  // egy generikus piros sort írt az egész űrlap alá. A jelszó-minimumot csak
  // egy sikertelen körfordulás után tudta meg a felhasználó, azt sem melyik
  // mezőben (§16: inline validálj, ne beküldéskor).
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [serverField, setServerField] = useState<Field | null>(null)
  const usernameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  /** csak regisztrációnál él; a bejelentkezés a szerver dolga marad */
  const invalidField: Field | null =
    mode !== 'register'
      ? null
      : (() => {
          const r = validateRegistration({ email, username, password })
          return r.ok ? null : r.field
        })()

  const fieldMessage: Record<Field, string> = {
    email: t('ruleEmail'),
    username: t('ruleUsername'),
    password: t('rulePassword'),
  }

  /** akkor mutatjuk, ha a mező már járt fókuszban, vagy a szerver jelölte meg */
  function errorFor(f: Field): string | null {
    if (serverField === f) return fieldMessage[f]
    if (invalidField !== f) return null
    return touched[f] ? fieldMessage[f] : null
  }

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
      // a szerver megmondja, MELYIK mező rossz — rámutatunk és odaugrunk
      const f = json?.field as Field | undefined
      if (f === 'email' || f === 'username' || f === 'password') {
        setServerField(f)
        setTouched((s) => ({ ...s, [f]: true }))
        const el = f === 'email' ? emailRef.current : f === 'username' ? usernameRef.current : passwordRef.current
        el?.focus()
      }
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
          <h1 className="display-m">Anime Graph</h1>
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
          <div className="flex flex-col gap-1">
            <input
              ref={usernameRef}
              value={username}
              onChange={(e) => { setUsername(e.target.value); setServerField(null) }}
              onBlur={() => setTouched((s) => ({ ...s, username: true }))}
              placeholder={t('username')}
              autoComplete="username"
              aria-invalid={errorFor('username') != null}
              className="field px-4 py-2.5 text-sm"
              autoFocus
            />
            {/* a szabály ÁLLANDÓAN látszik regisztrációnál, nem utólagos
                számonkérésként bukkan elő */}
            {mode === 'register' && (
              <p className={`text-11 ${errorFor('username') ? 'text-[color:var(--status-dropped)]' : 'text-text-3'}`}>
                {t('ruleUsername')}
              </p>
            )}
          </div>
        )}

        {(mode === 'register' || mode === 'forgot') && (
          <div className="flex flex-col gap-1">
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setServerField(null) }}
              onBlur={() => setTouched((s) => ({ ...s, email: true }))}
              placeholder={t('email')}
              autoComplete="email"
              aria-invalid={errorFor('email') != null}
              className="field px-4 py-2.5 text-sm"
            />
            {mode === 'register' && errorFor('email') && (
              <p className="text-11 text-[color:var(--status-dropped)]">{t('ruleEmail')}</p>
            )}
          </div>
        )}

        {mode !== 'forgot' && (
          <div className="flex flex-col gap-1">
            <input
              ref={passwordRef}
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setServerField(null) }}
              onBlur={() => setTouched((s) => ({ ...s, password: true }))}
              placeholder={mode === 'login' ? t('password') : t('passwordNew')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              aria-invalid={errorFor('password') != null}
              className="field px-4 py-2.5 text-sm"
            />
            {mode === 'register' && (
              <p className={`text-11 ${errorFor('password') ? 'text-[color:var(--status-dropped)]' : 'text-text-3'}`}>
                {t('rulePassword')}
              </p>
            )}
          </div>
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

        {/* regisztrációnál a beküldés addig tiltva, amíg a szabályok nem állnak */}
        <button type="submit" disabled={busy || invalidField != null} className="btn-solid py-2.5 text-sm">
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
