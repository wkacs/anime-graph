import { ImageResponse } from 'next/og'
import { runScan } from '@/lib/scan-service'
import { DOMINANT_ISLAND_SHARE } from '@/lib/taste-scan'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Anime Graph taste map'

// A megosztott link ELSO benyomasa. Nem az appot mutatja, hanem az adott ember
// izlesenek eredmenyet — ez az egesz megoszto hurok lenyege. Sikertelen scannel
// is kell kep: kulonben a link csupasz linkkent jelenne meg a chatben.
const ISLAND_HUES = [265, 190, 25, 330, 145]

export default async function ScanOgImage(
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params
  const outcome = await runScan(username)

  const headline = !outcome.ok
    ? 'Map your anime taste'
    : outcome.result.islands[0] && outcome.result.islands[0].share >= DOMINANT_ISLAND_SHARE
      ? `One connected mass: ${outcome.result.islands[0].name}`
      : `${outcome.result.islands.length} separate taste islands`

  const islands = outcome.ok ? outcome.result.islands : []
  const nodes = outcome.ok ? outcome.result.constellation.slice(0, 28) : []

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%', width: '100%', display: 'flex', alignItems: 'center', gap: 56,
          padding: '70px 76px', color: '#fafafa',
          background: 'radial-gradient(circle at 78% 18%, #3b2b62 0, #12111a 34%, #09090b 72%)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ fontSize: 25, letterSpacing: 5, color: '#c8c2d8' }}>ANIME GRAPH · TASTE SCAN</div>
          <div style={{ marginTop: 22, fontSize: 40, color: '#d0cbd8' }}>{username}</div>
          <div style={{ marginTop: 10, fontSize: 62, lineHeight: 1.06, fontWeight: 700, maxWidth: 620 }}>
            {headline}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 34 }}>
            {islands.slice(0, 4).map((isl, i) => (
              <div
                key={isl.name}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, fontSize: 23,
                  padding: '8px 16px', borderRadius: 999, background: 'rgba(255,255,255,.07)',
                }}
              >
                <div
                  style={{
                    width: 13, height: 13, borderRadius: 20,
                    background: `hsl(${ISLAND_HUES[i % ISLAND_HUES.length]} 70% 68%)`,
                  }}
                />
                {isl.name}
              </div>
            ))}
          </div>
        </div>

        {/* ugyanaz a csillagkep, mint az oldalon — a lib mar kiszamolta */}
        <div style={{ display: 'flex', position: 'relative', width: 380, height: 380 }}>
          {nodes.map((n) => {
            const idx = islands.findIndex((x) => x.name === n.island)
            const hue = idx >= 0 ? ISLAND_HUES[idx % ISLAND_HUES.length] : 0
            const d = 12 + n.r * 16
            return (
              <div
                key={n.anilistId}
                style={{
                  position: 'absolute',
                  left: 190 + n.x * 172 - d / 2,
                  top: 190 + n.y * 172 - d / 2,
                  width: d, height: d, borderRadius: 999,
                  background: idx >= 0 ? `hsl(${hue} 70% 68%)` : 'rgba(255,255,255,.5)',
                }}
              />
            )
          })}
        </div>
      </div>
    ),
    { ...size },
  )
}
