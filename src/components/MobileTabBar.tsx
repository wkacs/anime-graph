'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { springFluid } from '@/lib/motion'
import { useTranslations } from 'next-intl'
import { MOBILE_TABS, MORE_TABS, GUEST_TABS, isTabActive, isNavHidden, isMoreActive } from '@/lib/nav'
import { useAuthStatus } from '@/lib/use-auth-status'

// Also tab-sav <md alatt. Korabban a felso pillt vizszintesen kellett huzni
// mobilon; ez volt a legnagyobb mobil-hianyossag.
export default function MobileTabBar() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const hidden = isNavHidden(pathname)
  const authenticated = useAuthStatus()
  const guest = authenticated !== true

  useEffect(() => { setOpen(false) }, [pathname])

  if (hidden) return null

  const itemClass = (active: boolean) =>
    `block rounded-[var(--r-sm)] px-3 py-2.5 text-sm ${
      active ? 'bg-white/10 text-text-1' : 'text-text-2'
    }`

  return (
    <>
      {!guest && open && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <ul
            className="surface-menu absolute right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] min-w-44 rounded-[var(--r-md)] p-1.5 flex flex-col gap-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {MORE_TABS.map((tab) => (
              <li key={tab.href}>
                <Link href={tab.href} className={itemClass(isTabActive(tab.href, pathname))}>
                  {t(tab.key)}
                </Link>
              </li>
            ))}
            {/* a graf mobilon innen erheto el */}
            <li>
              <Link href="/graph" className={itemClass(isTabActive('/graph', pathname))}>
                {t('graph')}
              </Link>
            </li>
            <li>
              <Link href="/settings" className={itemClass(isTabActive('/settings', pathname))}>
                {t('settings')}
              </Link>
            </li>
          </ul>
        </div>
      )}

      <nav
        className="surface-3 md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch justify-around rounded-t-[var(--r-lg)] px-1 pt-1.5"
        style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
      >
        {(guest ? GUEST_TABS : MOBILE_TABS).map((tab) => {
          const active = isTabActive(tab.href, pathname)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 rounded-[var(--r-sm)] px-1 py-2 text-center text-[11px] transition-colors ${
                active ? 'text-text-1' : 'text-text-3'
              }`}
            >
              <span className={`block truncate ${active ? 'font-medium' : ''}`}>{t(tab.key)}</span>
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
        {!guest && <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex-1 rounded-[var(--r-sm)] px-1 py-2 text-center text-[11px] transition-colors ${
            isMoreActive(pathname) || open ? 'text-text-1' : 'text-text-3'
          }`}
        >
          <span className="block truncate">{t('more')}</span>
          <span
            className={`mx-auto mt-1 block h-0.5 w-5 rounded-full transition-opacity ${
              isMoreActive(pathname) ? 'bg-white/70 opacity-100' : 'opacity-0'
            }`}
          />
        </button>}
        {guest && (
          <Link
            href="/login"
            className="flex-1 rounded-[var(--r-sm)] px-1 py-2 text-center text-[11px] text-text-1"
          >
            <span className="block truncate font-medium">{t('signIn')}</span>
            <span className="mx-auto mt-1 block h-0.5 w-5 rounded-full bg-white/70" />
          </Link>
        )}
      </nav>
    </>
  )
}
