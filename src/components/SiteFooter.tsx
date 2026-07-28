'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { isFooterHidden } from '@/lib/nav'

// A jogi oldalak enélkül elérhetetlenek lennének: a nav tele van, a
// tájékoztatókra viszont minden oldalról vezetnie kell útnak.
// A pb a mobil alsó tab-sáv helyét tartja fenn.
export default function SiteFooter() {
  const pathname = usePathname()
  const t = useTranslations('footer')
  if (isFooterHidden(pathname)) return null

  return (
    <footer className="mt-16 border-t border-white/8 px-4 pb-28 pt-8 md:pb-10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-3">
        <span className="text-text-2">Anime Graph</span>
        <Link href="/adatvedelem" className="transition-colors hover:text-text-1">
          {t('privacy')}
        </Link>
        <Link href="/aszf" className="transition-colors hover:text-text-1">
          {t('terms')}
        </Link>
        <span className="ml-auto">
          {t('catalogueData')}{' '}
          <a
            href="https://anilist.co"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-text-1"
          >
            AniList
          </a>
        </span>
      </div>
    </footer>
  )
}
