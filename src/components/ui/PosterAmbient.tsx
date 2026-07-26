type Props = {
  src: string | null
  intensity?: 'hero' | 'card' | 'row'
  className?: string
}

// A borito blur-kopiaja a tartalom alatt. Ez adja a cover-driven irany szinet
// adat nelkul: nincs kinyert hex, nincs DB-oszlop, nincs canvas-extrakcio.
export default function PosterAmbient({ src, intensity = 'hero', className = '' }: Props) {
  if (!src) return null
  return (
    <div className={`poster-ambient ${className}`} data-intensity={intensity} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" />
    </div>
  )
}
