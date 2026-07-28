// A statusz-cimkek a szotarban ulnek (`status` namespace), nem itt: a felulet
// nyelve a felhasznaloe. Itt csak a kulcs-keszlet es a szinek maradnak, mert
// azok nyelvfuggetlenek.
export const STATUS_KEYS = ['watching', 'completed', 'planned', 'dropped'] as const
export type StatusKey = (typeof STATUS_KEYS)[number]

export function isStatusKey(s: string): s is StatusKey {
  return (STATUS_KEYS as readonly string[]).includes(s)
}

export const STATUS_CSS_VARS: Record<string, string> = {
  watching: 'var(--status-watching)',
  completed: 'var(--status-completed)',
  planned: 'var(--status-planned)',
  dropped: 'var(--status-dropped)',
}
