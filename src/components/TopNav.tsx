'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import LocaleSwitcher from './LocaleSwitcher'
import { PRIMARY_TABS, MORE_TABS, isTabActive, isNavHidden, isMoreActive } from '@/lib/nav'

export default function TopNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const [pendingCount, setPendingCount] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const moreRef = useRef<HTMLLIElement>(null)
  const hidden = isNavHidden(pathname)

  // velemeny-varo darabszam a badge-hez; oldalvaltasnal frissul
  useEffect(() => {
    if (hidden) return
    fetch('/api/opinions/pending?countOnly=1')
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((j: { count: number }) => setPendingCount(j.count ?? 0))
      .catch(() => { /* badge nelkul is el a nav */ })
  }, [pathname, hidden])

  // a nav lefele scrollnal surubb lesz
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // a Tovabb menu bezarasa kulso kattintasra / Escape-re
  useEffect(() => {
    if (!moreOpen) return
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  // oldalvaltasnal csukodjon
  useEffect(() => { setMoreOpen(false) }, [pathname])

  if (hidden) return null

  const tabClass = (active: boolean) =>
    `relative px-3 py-1.5 rounded-full text-sm transition-colors ${
      active ? 'bg-white/10 text-text-1' : 'text-text-2 hover:text-text-1 hover:bg-white/5'
    }`

  return (
    <nav
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-40 rounded-full pl-4 pr-2 py-1.5 hidden md:flex items-center gap-2 max-w-[95vw] whitespace-nowrap overflow-x-auto no-scrollbar transition-[background,box-shadow] duration-300 ${
        scrolled ? 'surface-3' : 'surface-2'
      }`}
    >
      <Link href="/" className="flex items-center gap-2 mr-1 shrink-0" aria-label="Anime Graph">
        {/* graf-mark: harom pont, ket el — az azonossag a 3D-terkepbol jon */}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path d="M4.5 12.5 9 5.5l4.5 7" stroke="currentColor" strokeWidth="1.1" strokeOpacity="0.45" />
          <circle cx="9" cy="5" r="2.1" fill="currentColor" />
          <circle cx="4" cy="13" r="1.6" fill="currentColor" fillOpacity="0.75" />
          <circle cx="14" cy="13" r="1.6" fill="currentColor" fillOpacity="0.75" />
        </svg>
        <span className="display-l !text-[17px] leading-none text-text-1">Anime Graph</span>
        <span className="label-mono hidden lg:inline">アニメ</span>
      </Link>

      <div className="h-4 w-px bg-white/10 shrink-0" />

      <ul className="flex items-center gap-0.5">
        {PRIMARY_TABS.map((tab) => (
          <li key={tab.href}>
            <Link href={tab.href} className={tabClass(isTabActive(tab.href, pathname))}>
              {t(tab.key)}
              {tab.pendingBadge && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-white/15 px-1.5 min-w-[18px] h-[18px] text-[10px] font-mono text-text-1 align-middle">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>
          </li>
        ))}
        <li ref={moreRef} className="relative">
          <button
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            className={tabClass(isMoreActive(pathname) || moreOpen)}
          >
            {t('more')} <span aria-hidden className="text-[10px] align-middle">▾</span>
          </button>
          {moreOpen && (
            <ul
              role="menu"
              className="surface-menu absolute right-0 top-[calc(100%+0.5rem)] min-w-40 rounded-[var(--r-md)] p-1.5 flex flex-col gap-0.5"
            >
              {MORE_TABS.map((tab) => (
                <li key={tab.href} role="none">
                  <Link
                    role="menuitem"
                    href={tab.href}
                    className={`block rounded-[var(--r-sm)] px-3 py-2 text-sm transition-colors ${
                      isTabActive(tab.href, pathname)
                        ? 'bg-white/10 text-text-1'
                        : 'text-text-2 hover:text-text-1 hover:bg-white/5'
                    }`}
                  >
                    {t(tab.key)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      </ul>

      <div className="h-4 w-px bg-white/10 shrink-0" />

      <Link href="/bongeszo?focus=1" aria-label={t('search')} title={t('search')} className="btn-ghost p-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </Link>
      <LocaleSwitcher compact />
      <Link
        href="/beallitasok"
        aria-label={t('settings')}
        className={`btn-ghost p-2 ${isTabActive('/beallitasok', pathname) ? 'bg-white/10 text-text-1' : ''}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </Link>
    </nav>
  )
}
