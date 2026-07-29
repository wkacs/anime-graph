import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '76px', color: '#fafafa', background: 'radial-gradient(circle at 78% 18%, #3b2b62 0, #12111a 34%, #09090b 72%)' }}>
      <div style={{ fontSize: 28, letterSpacing: 5, color: '#c8c2d8' }}>ANIME GRAPH</div>
      <div style={{ marginTop: 26, fontSize: 74, lineHeight: 1.04, fontWeight: 700, maxWidth: 930 }}>A lista, ami dolgozik neked.</div>
      <div style={{ marginTop: 28, fontSize: 31, color: '#d0cbd8' }}>Anime és manga · ízlésalapú felfedezés · személyes követés</div>
      <div style={{ display: 'flex', gap: 18, marginTop: 52 }}>
        {[['Lista', '#7b63ac'], ['Ízlés', '#bc6e8d'], ['Felfedezés', '#569c9b']].map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24 }}>
            <div style={{ width: 15, height: 15, borderRadius: 20, background: color }} />{label}
          </div>
        ))}
      </div>
    </div>,
    { ...size },
  )
}
