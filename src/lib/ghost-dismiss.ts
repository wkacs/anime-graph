// „Nem nekem valo" a ghost-node-okon. Uj tabla SZANDEKOSAN nincs: ez a jelzes egy
// per-user beallitas, a `settings` kulcs-ertek tabla pontosan erre valo — igy a
// funkcio nem kover se migraciot, se eles DB-valtoztatast.
//
// A lista nyirott: az elvetes „ne ezt mutasd most", nem orok itelet, es egy
// korlatlanul novo jsonb-tomb minden ajanlas-keresre visszaolvasodna.

export const GHOST_DISMISS_KEY = 'ghostDismissed'
export const MAX_DISMISSED = 200

/** A tarolt ertek barmi lehet (kezi DB-turkalas, regi alak) — sosem bizunk benne. */
export function parseDismissed(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is number => Number.isInteger(x) && x > 0)
}

/** Legutobb elvetett elol; a tulcsordulo reg lattak kiesnek. */
export function addDismissed(current: unknown, anilistId: number): number[] {
  const list = parseDismissed(current).filter((id) => id !== anilistId)
  return [anilistId, ...list].slice(0, MAX_DISMISSED)
}
