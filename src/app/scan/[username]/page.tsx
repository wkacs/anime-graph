import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import PageShell from '@/components/ui/PageShell'
import EmptyState from '@/components/ui/EmptyState'
import ScanResultView from '@/components/ScanResult'
import { runScan } from '@/lib/scan-service'

export const dynamic = 'force-dynamic'

// Megoszthato scan-eredmeny. Ez a link a novekedesi hurok: amit valaki
// megoszt, az NEM az app, hanem a sajat izlesenek eredmenye.
//
// 🔴 noindex SZANDEKOS. Az oldal barmelyik publikus AniList-nevre eloall, tehat
// indexelve harmadik felekrol szolo, keresheto oldalak ezrei jonnenek letre. A
// megoszthatosaghoz eleg, hogy a linket megnyitva mukodik; kereshetonek NEM kell.
export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> },
): Promise<Metadata> {
  const { username } = await params
  const t = await getTranslations('scan')
  const title = t('shareTitle', { username })
  const description = t('shareDescription', { username })
  // Az openGraph-cimet KULON meg kell adni: a `title` mezot a megosztas-metaadat
  // nem orokli, ezert enelkul a beillesztett link a generikus app-cimet mutatna,
  // nem azt, hogy kirol szol.
  return {
    title,
    description,
    openGraph: { title, description },
    // A `card` ujra kell: a metaadat-osszefuzes kulcs-szinten CSEREL, tehat a
    // layout `summary_large_image`-e elveszne, es a nagy izles-terkep helyett
    // kicsi negyzetes belyegkep menne ki.
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: false, follow: false },
  }
}

export default async function SharedScanPage(
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params
  const t = await getTranslations('scan')
  const outcome = await runScan(username)

  if (!outcome.ok) {
    return (
      <PageShell width="default">
        <EmptyState
          eyebrow={t('eyebrow')}
          title={t(`shareError.${outcome.error}`)}
          text={t('shareErrorText')}
          action={<Link href="/scan" className="btn-solid px-5 py-3">{t('shareOwnCta')}</Link>}
        />
      </PageShell>
    )
  }

  return (
    <PageShell width="default">
      <p className="label-mono">{t('eyebrow')}</p>
      <h1 className="display-l mt-3 text-balance text-silver">
        {t('shareHeading', { username: outcome.username })}
      </h1>
      <div className="mt-10">
        <ScanResultView result={outcome.result} username={outcome.username} />
      </div>
      <div className="mt-10 text-center">
        <Link href="/scan" className="btn-ghost surface-1 px-5 py-3">{t('shareOwnCta')}</Link>
      </div>
    </PageShell>
  )
}
