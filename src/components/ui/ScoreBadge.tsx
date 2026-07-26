import { scoreColor, type ScoreKind } from '@/lib/score-color'

type Props = {
  score: number
  kind?: ScoreKind
  /** pl. '%' a lokalis fit-nel; a taste-pontszam suffix nelkul all */
  suffix?: string
  title?: string
}

// Pontszam-badge a poszter jobb felso sarkaba. A szint a scoreColor donti el.
export default function ScoreBadge({ score, kind = 'fit', suffix = '', title }: Props) {
  return (
    <span
      className="surface-2 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums"
      style={{ color: scoreColor(score, kind) }}
      title={title}
    >
      {score}{suffix}
    </span>
  )
}
