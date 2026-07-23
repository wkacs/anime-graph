// Oldalankénti spotlight-túra segédei. A túra oldalanként EGYSZER fut
// (localStorage-kulcs), a News-on a wizard utáni ?tour=1 kényszerítheti.

export type TourStep = { selector: string; title: string; text: string }

export function tourKey(page: string): string {
  return `anime-graph-tour:${page}`
}

export type Rect = { top: number; left: number; width: number; height: number }
export type Size = { width: number; height: number }

const MARGIN = 12

// Tooltip a cél alá; ha nem fér, fölé; vízszintesen a viewportba szorítva.
export function tooltipPos(target: Rect, tip: Size, viewport: Size): { top: number; left: number } {
  let top = target.top + target.height + MARGIN
  if (top + tip.height > viewport.height - MARGIN) {
    top = Math.max(MARGIN, target.top - tip.height - MARGIN)
  }
  let left = target.left + target.width / 2 - tip.width / 2
  left = Math.max(MARGIN, Math.min(left, viewport.width - tip.width - MARGIN))
  return { top, left }
}

// A hiányzó cél-elemű lépéseket kihagyjuk (pl. anonim nézetben nem renderelt szekció).
export function firstVisibleStep(steps: TourStep[], exists: (selector: string) => boolean, from = 0): number | null {
  for (let i = from; i < steps.length; i++) {
    if (exists(steps[i].selector)) return i
  }
  return null
}
