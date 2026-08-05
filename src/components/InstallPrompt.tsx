'use client'
import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  INSTALL_DISMISS_KEY,
  dismissalValue,
  installMode,
  isDismissed,
  isIosSafari,
  isStandalone,
  type InstallMode,
} from '@/lib/install-prompt'

// A Chrome sajat esemenye, nincs a TS DOM-konyvtaraban.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * "Kezdokepernyohoz hozzaadas" sav mobilra.
 *
 * A layoutban ul, nem a fooldal fajaban: a beforeinstallprompt kozvetlenul a
 * betoltes utan tuzel, es ha a listener csak a fooldal hidratalasa utan
 * csatlakozna, az esemenyt elszalasztanank — a sav ilyenkor NEM jelenne meg, es
 * ez nema hibakent jelentkezne. A megjeleniteset kulon a pathname szabalyozza.
 *
 * A service workert is itt regisztraljuk: korabban ez csak a PushToggle-ben
 * tortent, tehat csak akkor, ha a felhasznalo bejart a beallitasokba. Enelkul a
 * Chrome telepithetosegi feltetele sem teljesul.
 */
export default function InstallPrompt() {
  const t = useTranslations('installPrompt')
  const pathname = usePathname()
  const [mode, setMode] = useState<InstallMode>('hidden')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [shown, setShown] = useState(false)

  // A sav csak a fooldalon (hirek) jelenik meg, de a listener mindenhol el.
  const onNewsPage = pathname === '/'

  const hide = useCallback(() => {
    setMode('hidden')
    setShown(false)
  }, [])

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, dismissalValue(Date.now()))
    } catch {
      // privat mod / letiltott tarolo: a sav ilyenkor a kovetkezo betolteskor
      // visszater. Ez elfogadhatobb, mint elszallni.
    }
    hide()
  }, [hide])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  useEffect(() => {
    const standalone = isStandalone(
      window.matchMedia('(display-mode: standalone)').matches,
      // iOS sajat, nem szabvanyos jelzese
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    )

    let dismissed = false
    try {
      dismissed = isDismissed(window.localStorage.getItem(INSTALL_DISMISS_KEY), Date.now())
    } catch {
      // olvashatatlan tarolo: ugy vesszuk, nincs elutasitas
    }

    const iosSafari = isIosSafari(window.navigator.userAgent, window.navigator.maxTouchPoints)

    setMode(installMode({ standalone, dismissed, hasNativePrompt: false, iosSafari }))

    const onBeforeInstall = (e: Event) => {
      // Elnyomjuk a Chrome sajat mini-savjat, hogy a sajat felulet dontson.
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode(installMode({ standalone, dismissed, hasNativePrompt: true, iosSafari }))
    }
    const onInstalled = () => hide()

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [hide])

  // Belebegtetes csak akkor, ha tenylegesen mutatunk valamit.
  useEffect(() => {
    if (mode === 'hidden' || !onNewsPage) { setShown(false); return }
    const id = window.setTimeout(() => setShown(true), 50)
    return () => window.clearTimeout(id)
  }, [mode, onNewsPage])

  useEffect(() => {
    if (mode === 'hidden' || !onNewsPage) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, onNewsPage, dismiss])

  if (mode === 'hidden' || !onNewsPage) return null

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    // Elutasitas eseten is eltunik, de csak a cooldown erejeig kerul naploba.
    if (outcome === 'dismissed') dismiss()
    else hide()
  }

  return (
    <section
      role="region"
      aria-label={t('title')}
      className={`surface-menu md:hidden fixed inset-x-3 z-50 rounded-[var(--r-lg)] p-4
        transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none
        ${shown ? 'opacity-100 translate-y-0' : 'pointer-events-none translate-y-3 opacity-0'}`}
      style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[var(--r-sm)] bg-white/8"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.5" strokeLinecap="round" className="text-text-1">
            <circle cx="12" cy="6.5" r="2.5" />
            <circle cx="5.5" cy="17.5" r="2" />
            <circle cx="18.5" cy="17.5" r="2" />
            <path d="M10.2 8.8 7 15.2M13.8 8.8 17 15.2M7.5 17.5h9" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-text-1">{t('title')}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-text-2">
            {mode === 'ios-manual' ? t('iosBody') : t('body')}
          </p>
        </div>

        <button
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="btn-ghost -mr-1 -mt-1 shrink-0 p-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="1.75" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {/* A gomb es a lepeslista a fejlec-soron KIVUL all: a szovegoszlopba zarva
          balrol az ikon, jobbrol az X huzna be, es a jobb szele nem illeszkedne
          a panel szelehez. */}
      {mode === 'native' && (
        <button
          onClick={install}
          className="btn-ghost mt-3 w-full border border-white/10 px-4 py-2.5 text-sm"
        >
          {t('add')}
        </button>
      )}

      {mode === 'ios-manual' && (
        <ol className="mt-3 flex flex-col gap-1.5 text-[13px] text-text-2">
          <li className="flex gap-2">
            <span aria-hidden className="text-text-3">1.</span>
            <span>{t('iosStep1')}</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="text-text-3">2.</span>
            <span>{t('iosStep2')}</span>
          </li>
        </ol>
      )}
    </section>
  )
}
