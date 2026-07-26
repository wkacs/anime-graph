'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import LocaleSwitcher from './LocaleSwitcher'

const TABS: { href: string; key: string; soon?: boolean; pendingBadge?: boolean }[] = [
  { href: '/', key: 'news' },
  { href: '/graf', key: 'graph' },
  { href: '/lista', key: 'list' },
  { href: '/velemenyek', key: 'opinions', pendingBadge: true },
  { href: '/bongeszo', key: 'browse' },
  { href: '/toplista', key: 'leaderboard' },
  { href: '/vibe', key: 'vibe' },
  { href: '/stats', key: 'stats' },
  { href: '/vs', key: 'vs' },
]

export default function TopNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const hidden = pathname === '/login' || pathname.startsWith('/p/')

  // velemeny-varo darabszam a badge-hez; oldalvaltasnal frissul
  useEffect(() => {
    if (hidden) return
    fetch('/api/opinions/pending?countOnly=1')
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((j: { count: number }) => setPendingCount(j.count ?? 0))
      .catch(() => { /* badge nelkul is el a nav */ })
  }, [pathname, hidden])

  if (hidden) return null

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-40 glass rounded-full pl-5 pr-2 py-1.5 flex items-center gap-3 max-w-[95vw] overflow-x-auto no-scrollbar whitespace-nowrap">
      <Link href="/" className="flex items-baseline gap-2 mr-1">
        <span className="text-[15px] font-semibold tracking-tight text-text-1">Anime Graph</span>
        <span className="label-mono hidden sm:inline">アニメ</span>
      </Link>
      <div className="h-4 w-px bg-white/10" />
      <ul className="flex items-center gap-0.5">
        {TABS.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              className={`relative px-3 py-1.5 rounded-full text-sm transition-colors ${
                isActive(tab.href)
                  ? 'bg-white/10 text-text-1'
                  : 'text-text-2 hover:text-text-1 hover:bg-white/5'
              }`}
            >
              {t(tab.key)}
              {tab.soon && (
                <span className="ml-1 align-super text-[8px] font-mono uppercase tracking-widest text-text-3">
                  soon
                </span>
              )}
              {tab.pendingBadge && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-white/15 px-1.5 min-w-[18px] h-[18px] text-[10px] font-mono text-text-1 align-middle">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <div className="h-4 w-px bg-white/10" />
      <LocaleSwitcher compact />
      <Link
        href="/beallitasok"
        aria-label={t('settings')}
        className={`btn-ghost p-2 ${pathname.startsWith('/beallitasok') ? 'bg-white/10 text-text-1' : ''}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </Link>
    </nav>
  )
}
