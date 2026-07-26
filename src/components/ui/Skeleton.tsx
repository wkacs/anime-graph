// A kontraszt szandekosan magasabb, mint a surface-1: 0.03/0.07-nel a vazlat
// #09090b-n gyakorlatilag lathatatlan volt.
const SHIMMER =
  'bg-[linear-gradient(90deg,rgba(255,255,255,0.055)_25%,rgba(255,255,255,0.13)_37%,rgba(255,255,255,0.055)_63%)] bg-[length:400%_100%] animate-[shimmer_1.6s_linear_infinite]'

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
            <div className={`aspect-[2/3] w-full rounded-[var(--r-md)] ${SHIMMER}`} />
            <div className={`h-3.5 w-4/5 rounded ${SHIMMER}`} />
            <div className={`h-2.5 w-2/5 rounded ${SHIMMER}`} />
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
            <div className={`w-8 h-11 shrink-0 rounded-[var(--r-sm)] ${SHIMMER}`} />
            <div className={`h-3.5 flex-1 rounded ${SHIMMER}`} />
          </div>
        ))}
      </>
    )
  }

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`h-3.5 w-full rounded ${SHIMMER}`} />
      ))}
    </>
  )
}
