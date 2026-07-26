import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { resolveLocale, LOCALE_COOKIE } from '@/lib/locale'

// next-intl "usage without i18n routing": a locale cookie-ból jön, az URL
// változatlan marad. Így a 133 840 kanonikus katalógus-URL nem duplázódik.
export default getRequestConfig(async () => {
  const locale = resolveLocale({
    cookie: (await cookies()).get(LOCALE_COOKIE)?.value,
    acceptLanguage: (await headers()).get('accept-language'),
  })
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
