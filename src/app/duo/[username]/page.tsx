import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import PageShell from '@/components/ui/PageShell'
import DuoCompare from '@/components/DuoCompare'
import { isValidAnilistUsername } from '@/lib/taste-scan'

export const dynamic = 'force-dynamic'

// „Mennyire passzol az izlesunk?" — a meghivo-link celoldala. A meghivott
// EGYETLEN dolgot ad meg (a sajat AniList-nevet), es azonnal kap eredmenyt;
// a teljes kozos graf es az ajanlasok maradnak a regisztracio mogott.
//
// 🔴 noindex, ugyanabbol az okbol, mint a megosztott scan: az oldal barmelyik
// nevre eloall, es harmadik felekrol szolo, keresheto oldalakat nem gyartunk.
export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> },
): Promise<Metadata> {
  const { username } = await params
  const t = await getTranslations('duo')
  const title = t('shareTitle', { username })
  const description = t('shareDescription', { username })
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: false, follow: false },
  }
}

export default async function DuoInvitePage(
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params
  const t = await getTranslations('duo')

  if (!isValidAnilistUsername(username)) {
    return (
      <PageShell width="default">
        <p className="label-mono">{t('eyebrow')}</p>
        <h1 className="display-l mt-3 text-silver">{t('badLink')}</h1>
        <p className="mt-4 text-text-2">{t('badLinkText')}</p>
        <Link href="/scan" className="btn-solid mt-8 inline-block px-5 py-3">{t('ownCta')}</Link>
      </PageShell>
    )
  }

  return (
    <PageShell width="default">
      <p className="label-mono">{t('eyebrow')}</p>
      <h1 className="display-l mt-3 text-balance text-silver">{t('heading', { username })}</h1>
      <p className="mt-4 max-w-xl leading-relaxed text-text-2">{t('lead', { username })}</p>
      <DuoCompare inviter={username} />
    </PageShell>
  )
}
