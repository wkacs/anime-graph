'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { popMenu, springFluid } from '@/lib/motion'
import { useTranslations } from 'next-intl'
import {
  MOBILE_TABS, MOBILE_MORE_TABS, GUEST_TABS,
  isTabActive, isNavTabActive, isNavHidden, isMobileMoreActive,
} from '@/lib/nav'
import { useAuthStatus } from '@/lib/use-auth-status'

// Also tab-sav <md alatt. Korabban a felso pillt vizszintesen kellett huzni
// mobilon; ez volt a legnagyobb mobil-hianyossag.
export default function MobileTabBar() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const hidden = isNavHidden(pathname)
  const authenticated = useAuthStatus()
  // amíg nem tudjuk, ki nézi, ne kötelezzük el magunkat a vendég-készlet
  // mellett — a sáv magassága marad, csak a tartalma semleges
  const pending = authenticated === null
  const guest = authenticated !== true

  useEffect(() => { setOpen(false) }, [pathname])

  if (hidden) return null

  const itemClass = (active: boolean) =>
    `block rounded-[var(--r-sm)] px-3 py-2.5 text-sm active:bg-white/15 transition-colors ${
      active ? 'bg-white/10 text-text-1' : 'text-text-2'
    }`

  // A lap tartalma egyetlen forrasbol jon (MOBILE_MORE_TABS), igy az aktiv-
  // jelolo tesztje es a listazas nem tud szetcsuszni.
  return (
    <>
      <AnimatePresence>
        {!guest && open && (
          <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpen(false)}>
            <motion.ul
              {...popMenu}
              // a triggerbol (jobb also 'Tovabb' gomb) nő ki, oda is hozodik
              // vissza — §7: ami egy uton tunik el, azon is jojjon
              style={{ transformOrigin: 'bottom right' }}
              className="surface-menu absolute right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] min-w-44 rounded-[var(--r-md)] p-1.5 flex flex-col gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              {MOBILE_MORE_TABS.map((tab) => (
                <li key={tab.href}>
                  <Link href={tab.href} className={itemClass(isTabActive(tab.href, pathname))}>
                    {t(tab.key)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/settings" className={itemClass(isTabActive('/settings', pathname))}>
                  {t('settings')}
                </Link>
              </li>
            </motion.ul>
          </div>
        )}
      </AnimatePresence>

      <nav
        className="surface-3 md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch justify-around rounded-t-[var(--r-lg)] px-1 pt-1.5"
        style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
      >
        {pending && (
          <div aria-hidden className="flex flex-1 items-center justify-around px-2 py-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="block h-3 w-10 rounded-full bg-white/[0.07]" />
            ))}
          </div>
        )}
        {!pending && (guest ? GUEST_TABS : MOBILE_TABS).map((tab) => {
          const active = isNavTabActive(tab, pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              // min-h-44: a talalati felulet 38px volt, a 44px-es minimum alatt.
              // active:*: a lenyomas AZONNAL nyugtaz — eddig csak a navigacio
              // BEFEJEZTE utan valtott szint (§1), ami lassu haloval nemasag.
              // text-11: rem-alapu, tehat kovetni a bongeszo betumeret-allitast.
              className={`flex-1 min-h-[44px] flex flex-col items-center justify-center rounded-[var(--r-sm)] px-1 py-2 text-center text-11 touch-manipulation transition-[color,background-color,transform] duration-100 active:scale-[0.96] active:bg-white/10 ${
                active ? 'text-text-1' : 'text-text-3'
              }`}
            >
              <span className={`block w-full truncate ${active ? 'font-medium' : ''}`}>{t(tab.key)}</span>
              {/* EGY közös, layoutId-s jelölő: tab-váltásnál folyékonyan átúszik */}
              <span className="relative mx-auto mt-1 block h-0.5 w-5">
                {active && (
                  <motion.span
                    layoutId="tab-active"
                    transition={springFluid}
                    className="absolute inset-0 rounded-full bg-white/70"
                    aria-hidden
                  />
                )}
              </span>
            </Link>
          )
        })}
        {!pending && !guest && <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`flex-1 min-h-[44px] flex flex-col items-center justify-center rounded-[var(--r-sm)] px-1 py-2 text-center text-11 touch-manipulation transition-[color,background-color,transform] duration-100 active:scale-[0.96] active:bg-white/10 ${
            isMobileMoreActive(pathname) || open ? 'text-text-1' : 'text-text-3'
          }`}
        >
          <span className="block w-full truncate">{t('more')}</span>
          <span
            className={`mx-auto mt-1 block h-0.5 w-5 rounded-full transition-opacity ${
              isMobileMoreActive(pathname) ? 'bg-white/70 opacity-100' : 'opacity-0'
            }`}
          />
        </button>}
        {!pending && guest && (
          <Link
            href="/login"
            className="flex-1 min-h-[44px] flex flex-col items-center justify-center rounded-[var(--r-sm)] px-1 py-2 text-center text-11 text-text-1 touch-manipulation transition-[background-color,transform] duration-100 active:scale-[0.96] active:bg-white/10"
          >
            <span className="block w-full truncate font-medium">{t('signIn')}</span>
            <span className="mx-auto mt-1 block h-0.5 w-5 rounded-full bg-white/70" />
          </Link>
        )}
      </nav>
    </>
  )
}
