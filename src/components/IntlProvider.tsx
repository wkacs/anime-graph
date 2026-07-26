'use client'
import { useEffect, useState } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import { LOCALE_COOKIE, DEFAULT_LOCALE, type Locale } from '@/lib/locale'
import en from '../../messages/en.json'
import hu from '../../messages/hu.json'

const DICTS: Record<Locale, typeof en> = { en, hu: hu as typeof en }

function cookieLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const m = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
  return m?.[1] === 'hu' ? 'hu' : DEFAULT_LOCALE
}

// A nyelvváltás kliens-oldalon történik, hogy a szerver-render statikus maradhasson
// (lásd a magyarázatot a src/i18n/request.ts tetején). A szerver mindig angolul
// rendel, majd hidratáláskor a cookie szerinti szótár lép be.
export default function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    const next = cookieLocale()
    setLocale(next)
    document.documentElement.lang = next
  }, [])

  // Fix időzóna: enélkül a next-intl a futtató környezetére esik vissza
  // (ENVIRONMENT_FALLBACK), ami szerver és kliens között eltérhet → hidratálás-hiba.
  // A repó dátum-logikája amúgy is budapesti (weekdayIndexBudapest, time-capsule).
  return (
    <NextIntlClientProvider locale={locale} messages={DICTS[locale]} timeZone="Europe/Budapest">
      {children}
    </NextIntlClientProvider>
  )
}
