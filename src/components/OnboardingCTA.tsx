// Üres-lista onboarding: az új user első útja az import (30 mp múlva AI-ízlésprofil),
// a második a katalógus-kereső. Minden üres oldal ide terel.
export default function OnboardingCTA({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`glass rounded-3xl text-center ${compact ? 'px-6 py-5' : 'px-8 py-8'}`}>
      <p className="label-mono mb-2">Kezdjük itt</p>
      <h2 className={`font-semibold tracking-tight ${compact ? 'text-base mb-2' : 'text-xl mb-3'}`}>
        Hozd át a listád — 30 másodperc, és megmondjuk, ki vagy animenézőként
      </h2>
      <p className="text-sm text-text-2 mb-5 max-w-md mx-auto">
        MAL- vagy AniList-importtal minden pontod és státuszod átjön, az AI pedig azonnal
        megírja az ízlés-profilod. A régi listád nem vész el.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <a href="/beallitasok" className="btn-solid px-5 py-2.5 text-sm">Lista importálása →</a>
        <a href="/bongeszo" className="btn-ghost border border-white/10 px-5 py-2.5 text-sm">
          Vagy böngéssz a katalógusban
        </a>
      </div>
    </div>
  )
}
