'use client'
import { useState } from 'react'
import type { ApiAnime } from '@/lib/types'

const proxied = (url: string) => `/_next/image?url=${encodeURIComponent(url)}&w=256&q=80`

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = probe
    }
  }
  if (line) lines.push(line)
  return lines
}

type Profile = { portrait: string; badges: string[] }

async function drawTasteCard(profile: Profile, list: ApiAnime[]): Promise<string> {
  const W = 1080
  const cw = 190, ch = 268, gap = 26

  // mérő-menet: a tartalom tényleges aljához igazítjuk a magasságot,
  // különben a fix pozíciójú borítók a statokra rajzolódnak
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = '600 44px Instrument Sans, sans-serif'
  const measuredLines = wrapText(measure, profile.portrait, W - 144).slice(0, 8)
  let my = 210 + measuredLines.length * 62 + 40
  measure.font = '500 30px Instrument Sans, sans-serif'
  let mbx = 72
  for (const b of profile.badges) {
    const pw = measure.measureText(b).width + 56
    if (mbx + pw > W - 72) { mbx = 72; my += 76 }
    mbx += pw + 18
  }
  my += 110
  const genreCount = Math.min(5, new Set(list.flatMap((a) => a.genres)).size)
  const statsBottom = my + 44 + genreCount * 58
  const cy = statsBottom + 40
  const H = Math.max(1350, cy + ch + 130)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#09090b'
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.25, -100, 0, W * 0.25, -100, 900)
  glow.addColorStop(0, 'rgba(255,255,255,0.07)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = 'rgba(250,250,250,0.55)'
  ctx.font = '600 30px Geist Mono, monospace'
  ctx.fillText('ANIME ÍZLÉS-DNS', 72, 110)

  // portré (tördelve)
  ctx.fillStyle = '#fafafa'
  ctx.font = '600 44px Instrument Sans, sans-serif'
  const lines = wrapText(ctx, profile.portrait, W - 144).slice(0, 8)
  lines.forEach((l, i) => ctx.fillText(l, 72, 210 + i * 62))
  let y = 210 + lines.length * 62 + 40

  // badge-pillek
  ctx.font = '500 30px Instrument Sans, sans-serif'
  let bx = 72
  for (const b of profile.badges) {
    const tw = ctx.measureText(b).width
    const pw = tw + 56
    if (bx + pw > W - 72) { bx = 72; y += 76 }
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    roundRect(ctx, bx, y - 44, pw, 62, 31)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'
    ctx.stroke()
    ctx.fillStyle = 'rgba(250,250,250,0.92)'
    ctx.fillText(b, bx + 28, y)
    bx += pw + 18
  }
  y += 110

  // top műfajok sáv-diagram
  const counts = new Map<string, number>()
  for (const a of list) for (const g of a.genres) counts.set(g, (counts.get(g) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxC = top[0]?.[1] ?? 1
  ctx.fillStyle = 'rgba(250,250,250,0.55)'
  ctx.font = '600 26px Geist Mono, monospace'
  ctx.fillText('TOP MŰFAJOK', 72, y)
  y += 44
  ctx.font = '500 28px Instrument Sans, sans-serif'
  for (const [g, c] of top) {
    ctx.fillStyle = 'rgba(250,250,250,0.85)'
    ctx.fillText(g, 72, y + 30)
    const bw = Math.max(24, (c / maxC) * (W - 470))
    ctx.fillStyle = 'rgba(255,255,255,0.16)'
    roundRect(ctx, 360, y + 4, bw, 32, 16)
    ctx.fill()
    ctx.fillStyle = 'rgba(250,250,250,0.6)'
    ctx.font = '500 24px Geist Mono, monospace'
    ctx.fillText(String(c), 360 + bw + 16, y + 29)
    ctx.font = '500 28px Instrument Sans, sans-serif'
    y += 58
  }

  // top-3 borító a statok UTÁN (folyó pozíció, nem fix — nem lóghat a sávokra)
  const covers = [...list].filter((a) => a.coverUrl)
    .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0)).slice(0, 3)
  await Promise.all(covers.map(async (a, i) => {
    try {
      const img = await loadImage(proxied(a.coverUrl!))
      const x = 72 + i * (cw + gap)
      ctx.save()
      roundRect(ctx, x, cy, cw, ch, 18)
      ctx.clip()
      ctx.drawImage(img, x, cy, cw, ch)
      ctx.restore()
    } catch { /* borító nélkül is jó a kártya */ }
  }))

  ctx.fillStyle = 'rgba(250,250,250,0.45)'
  ctx.font = '600 26px Geist Mono, monospace'
  ctx.fillText(`${list.length} anime · anime-graph`, 72, H - 62)

  return canvas.toDataURL('image/png')
}

// Megosztható ízlés-DNS-kártya (PNG): portré + badge-ek + top műfajok + top-3 borító.
export default function TasteCard({ profile, list }: { profile: Profile | null; list: ApiAnime[] }) {
  const [busy, setBusy] = useState(false)

  if (!profile || !list.length) return null

  async function download() {
    setBusy(true)
    try {
      const url = await drawTasteCard(profile!, list)
      const a = document.createElement('a')
      a.href = url
      a.download = 'izles-dns.png'
      a.click()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button onClick={download} disabled={busy} className="btn-ghost border border-white/10 px-3.5 py-1.5 text-xs">
      {busy ? 'Rajzolás…' : '🧬 DNS-kártya letöltése'}
    </button>
  )
}
