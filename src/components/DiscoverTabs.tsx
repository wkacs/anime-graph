'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { springFluid } from '@/lib/motion'
import { DISCOVER_TABS, isTabActive } from '@/lib/nav'

// A felfedezes harom modja eddig harom kulon helyen allt (katalogus-kereses,
// Vibe, ajanlas), es a felhasznalonak kellett tudnia, melyik melyik. Nem az a
// dolga: azt akarja eldonteni, MILYEN modon valasszon, nem azt, hogy melyik
// technologia all mogotte. Ezert egy terulet, tobb mod.
export default function DiscoverTabs() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  return (
    <nav aria-label={t('browse')} className="surface-1 inline-flex rounded-full p-1">
      {DISCOVER_TABS.map((tab) => {
        const active = isTabActive(tab.href, pathname)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`relative rounded-full px-4 py-2 text-sm transition-colors ${
              active ? 'text-text-1' : 'text-text-3 hover:text-text-2'
            }`}
          >
            {active && (
              <motion.span
                layoutId="discover-tab"
                transition={springFluid}
                className="absolute inset-0 rounded-full bg-white/10"
                aria-hidden
              />
            )}
            <span className="relative">{t(tab.key)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
