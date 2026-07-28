'use client'
import { useTranslations } from 'next-intl'

/**
 * Egyetlen forditott string kliens-oldalon, SZERVER-komponensbol hivhatoan.
 *
 * Mire kell: az ISR-elt katalogus-cimoldalak (`revalidate=86400`) alatt a
 * `getTranslations()` nem hasznalhato, mert a cookie-alapu locale-feloldas
 * dinamikussa tenne a rendert (ez 500-azta a prodot, lasd src/i18n/request.ts).
 * Ez a komponens viszont a kliensen hidratal: a szerver-HTML angolul keszul —
 * ami egyben a kanonikus SEO-nyelv —, majd a nezo nyelve lep a helyebe.
 */
export default function T({
  ns, k, values,
}: {
  ns: string
  k: string
  values?: Record<string, string | number | Date>
}) {
  const t = useTranslations(ns)
  return <>{t(k, values)}</>
}
