// A kontraszt szandekosan magasabb, mint a surface-1: 0.03/0.07-nel a vazlat
// #09090b-n gyakorlatilag lathatatlan volt.
//
// A csillanas MOZGO GYEREK, nem background-position az alapdobozon. Utobbi
// minden kepkockan ujrafestette a dobozt — a toplista betoltesekor egyszerre
// 36-ot. A transform compositoron fut, festes nelkul (§11).
const BASE = 'relative overflow-hidden bg-white/[0.055]'
const SWEEP =
  'absolute inset-y-0 left-0 w-[200%] animate-[shimmer_1.6s_linear_infinite] bg-[linear-gradient(90deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)]'

/** egy vazlat-doboz: alapszin + rajta atsuhano csillanas */
function Box({ className }: { className: string }) {
  return (
    <div className={`${BASE} ${className}`}>
      <span aria-hidden className={SWEEP} />
    </div>
  )
}

type Props = {
  variant?: 'poster' | 'text' | 'row'
  /** hany darab — poszternel a racs elemszama */
  count?: number
}

// Vazlat a betoltesre. Layout-ugras nelkul tartja a helyet.
export default function Skeleton({ variant = 'poster', count = 1 }: Props) {
  if (variant === 'poster') {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Box className="aspect-[2/3] w-full rounded-[var(--r-md)]" />
            <Box className="h-3.5 w-4/5 rounded" />
            <Box className="h-2.5 w-2/5 rounded" />
          </div>
        ))}
      </>
    )
  }

  if (variant === 'row') {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Box className="w-8 h-11 shrink-0 rounded-[var(--r-sm)]" />
            <Box className="h-3.5 flex-1 rounded" />
          </div>
        ))}
      </>
    )
  }

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Box key={i} className="h-3.5 w-full rounded" />
      ))}
    </>
  )
}
