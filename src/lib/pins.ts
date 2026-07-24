// Profilra kitűzhető kedvencek: max 3 cím + max 3 karakter, csak saját elemek.
// A settings táblában él (pinnedTitles / pinnedChars kulcs), nincs sémamódosítás.
export const MAX_PINS = 3

export class PinError extends Error {}

export function validatePins(ids: unknown, allowed: Set<number>): number[] {
  if (ids == null) return []
  if (!Array.isArray(ids)) throw new PinError('Érvénytelen kitűzés-lista')
  const out: number[] = []
  for (const raw of ids) {
    if (!Number.isInteger(raw)) throw new PinError('Érvénytelen azonosító')
    if (!allowed.has(raw as number)) throw new PinError('Csak saját elemet tűzhetsz ki')
    if (!out.includes(raw as number)) out.push(raw as number)
  }
  if (out.length > MAX_PINS) throw new PinError(`Legfeljebb ${MAX_PINS} elemet tűzhetsz ki`)
  return out
}
