// weekday index in Budapest time: 0 = hétfő … 6 = vasárnap
export function weekdayIndexBudapest(unixSeconds: number): number {
  const name = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Europe/Budapest',
  }).format(new Date(unixSeconds * 1000))
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name)
}

/** A hét napjainak kulcsai hetfotol, a `weekday` namespace szotarahoz. */
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number]

/**
 * A mertekegyseget a hivo adja: a lib nem tud a nyelvrol, a szamitas viszont
 * mindenhol ugyanaz. Igy a visszaszamlalo forditható anelkul, hogy a
 * kerekitesi szabalyok ket helyen ismetlodnenek.
 */
export type CountdownUnits = { soon: string; day: string; hour: string; minute: string }

export function formatCountdown(seconds: number, u: CountdownUnits): string {
  if (seconds <= 0) return u.soon
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}${u.day} ${h}${u.hour}`
  if (h > 0) return `${h}${u.hour} ${m}${u.minute}`
  return `${m}${u.minute}`
}
