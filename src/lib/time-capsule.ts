// Időkapszula (D8): „N éve ma fejezted be — újranéznéd?" — nosztalgia-push a
// meglévő web-push infrán, napi cronból. Naptári évforduló Budapest szerint.

const DAY_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Budapest', month: '2-digit', day: '2-digit',
})
const YEAR_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric' })

export function anniversaryYears(watchedAt: Date, now: Date): number | null {
  if (DAY_FMT.format(watchedAt) !== DAY_FMT.format(now)) return null
  const years = Number(YEAR_FMT.format(now)) - Number(YEAR_FMT.format(watchedAt))
  return years >= 1 ? years : null
}

export function buildCapsulePayload(title: string, years: number, path: string | null): { title: string; body: string; url: string } {
  return {
    title: `${years} éve ma fejezted be: ${title}`,
    body: 'Emlékszel még rá? Talán itt az idő újranézni 🕰️',
    url: path ?? '/',
  }
}
