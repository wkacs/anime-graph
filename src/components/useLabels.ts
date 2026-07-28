'use client'
import { useTranslations } from 'next-intl'
import { isStatusKey } from '@/lib/status'

const SEASON_KEYS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'] as const
type SeasonKey = (typeof SEASON_KEYS)[number]

function isSeasonKey(s: string): s is SeasonKey {
  return (SEASON_KEYS as readonly string[]).includes(s)
}

/**
 * A statusz es a szezon nyers kulcskent jon a DB-bol/AniListrol, a felirat
 * viszont forditando. Enelkul minden hivas-helyen ott allna ugyanaz a
 * kulcs-ellenorzes, csak azert, hogy a szotar tipusa ne romoljon `string`-re.
 * Ismeretlen kulcsnal a nyers erteket adjuk vissza — inkabb latszodjon, mint
 * hogy uresen maradjon a hely.
 */
export function useStatusLabel(): (status: string) => string {
  const t = useTranslations('status')
  return (s) => (isStatusKey(s) ? t(s) : s)
}

export function useSeasonLabel(): (season: string) => string {
  const t = useTranslations('season')
  return (s) => (isSeasonKey(s) ? t(s) : s)
}
