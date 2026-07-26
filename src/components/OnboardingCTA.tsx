'use client'
import { useTranslations } from 'next-intl'

// Üres-lista onboarding: az új user első útja az import (30 mp múlva AI-ízlésprofil),
// a második a katalógus-kereső. Minden üres oldal ide terel.
// Kliens-komponens: a szülők (news, graf, lista) mind 'use client'.
export default function OnboardingCTA({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('onboardingCta')
  return (
    <div className={`glass rounded-3xl text-center ${compact ? 'px-6 py-5' : 'px-8 py-8'}`}>
      <p className="label-mono mb-2">{t('kicker')}</p>
      <h2 className={`font-semibold tracking-tight ${compact ? 'text-base mb-2' : 'text-xl mb-3'}`}>
        {t('headline')}
      </h2>
      <p className="text-sm text-text-2 mb-5 max-w-md mx-auto">
        {t('body')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <a href="/onboarding" className="btn-solid px-5 py-2.5 text-sm">{t('primary')}</a>
        <a href="/bongeszo" className="btn-ghost border border-white/10 px-5 py-2.5 text-sm">
          {t('secondary')}
        </a>
      </div>
    </div>
  )
}
