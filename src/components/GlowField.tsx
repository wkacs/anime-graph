// Ambient fény-réteg a tartalom MÖGÖTT: semleges (fehér/acél) orbok lassú
// driftje — az üvegfelületek ezt a fényt szűrik át (liquid glass spec).
// Szerver-komponens: nincs state, nincs effect, csak DOM. A mozgás CSS-ben él
// (globals.css .glow-orb), prefers-reduced-motion alatt áll.
export default function GlowField() {
  return (
    <div className="glow-field" aria-hidden>
      <i className="glow-orb glow-orb-1" />
      <i className="glow-orb glow-orb-2" />
      <i className="glow-orb glow-orb-3" />
      <i className="glow-orb glow-orb-4" />
    </div>
  )
}
