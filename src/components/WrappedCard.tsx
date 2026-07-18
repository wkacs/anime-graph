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

async function drawWrapped(list: ApiAnime[]): Promise<string> {
  const W = 1080, H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // background + ambient glow
  ctx.fillStyle = '#09090b'
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.75, -100, 0, W * 0.75, -100, 900)
  glow.addColorStop(0, 'rgba(255,255,255,0.07)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const year = new Date().getFullYear()
  ctx.fillStyle = 'rgba(250,250,250,0.55)'
  ctx.font = '600 30px Geist Mono, monospace'
  ctx.fillText(`ANIME WRAPPED · ${year}`, 72, 110)

  // headline numbers
  const completed = list.filter((a) => a.status === 'completed').length
  const minutes = list.reduce((s, a) => {
    const dur = a.durationMin ?? 24
    const eps = a.status === 'completed' ? (a.episodes ?? a.progress) : a.progress
    return s + dur * (eps ?? 0)
  }, 0)
  ctx.fillStyle = '#fafafa'
  ctx.font = '700 120px Instrument Sans, sans-serif'
  ctx.fillText(`${Math.round(minutes / 60)} óra`, 68, 250)
  ctx.font = '400 34px Instrument Sans, sans-serif'
  ctx.fillStyle = 'rgba(250,250,250,0.65)'
  ctx.fillText(`${list.length} anime a térképen · ${completed} befejezve`, 72, 310)

  // top 5 covers
  const top = [...list]
    .filter((a) => a.coverUrl)
    .sort((a, b) => (b.myScore ?? 0) - (a.myScore ?? 0) || b.elo - a.elo)
    .slice(0, 5)
  ctx.fillStyle = 'rgba(250,250,250,0.55)'
  ctx.font = '600 26px Geist Mono, monospace'
  ctx.fillText('TOP 5', 72, 420)

  const cw = 168, ch = 238, gap = 24
  await Promise.all(top.map(async (a, i) => {
    try {
      const img = await loadImage(proxied(a.coverUrl!))
      const x = 72 + i * (cw + gap)
      const y = 450
      ctx.save()
      roundRect(ctx, x, y, cw, ch, 18)
      ctx.clip()
      ctx.drawImage(img, x, y, cw, ch)
      ctx.restore()
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 3
      roundRect(ctx, x + 1.5, y + 1.5, cw - 3, ch - 3, 18)
      ctx.stroke()
      if (a.myScore != null) {
        ctx.fillStyle = 'rgba(250,250,250,0.8)'
        ctx.font = '600 24px Geist Mono, monospace'
        ctx.fillText(`${a.myScore}/10`, x + 4, y + ch + 36)
      }
    } catch { /* kimaradó borító nem állítja meg a kártyát */ }
  }))

  // top genres bars
  const genreCounts = new Map<string, number>()
  for (const a of list) for (const g of a.genres) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
  const topGenres = [...genreCounts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5)
  const maxG = topGenres[0]?.[1] ?? 1

  ctx.fillStyle = 'rgba(250,250,250,0.55)'
  ctx.font = '600 26px Geist Mono, monospace'
  ctx.fillText('MŰFAJAIM', 72, 830)
  topGenres.forEach(([name, count], i) => {
    const y = 870 + i * 74
    ctx.fillStyle = '#fafafa'
    ctx.font = '500 32px Instrument Sans, sans-serif'
    ctx.fillText(name, 72, y + 32)
    ctx.fillStyle = 'rgba(255,255,255,0.10)'
    roundRect(ctx, 380, y + 6, 560, 30, 15)
    ctx.fill()
    ctx.fillStyle = '#fafafa'
    roundRect(ctx, 380, y + 6, Math.max(30, 560 * (count / maxG)), 30, 15)
    ctx.fill()
    ctx.fillStyle = 'rgba(250,250,250,0.6)'
    ctx.font = '500 26px Geist Mono, monospace'
    ctx.fillText(String(count), 965, y + 30)
  })

  ctx.fillStyle = 'rgba(250,250,250,0.4)'
  ctx.font = '500 26px Geist Mono, monospace'
  ctx.fillText('アニメグラフ · anime graph', 72, H - 64)

  return canvas.toDataURL('image/png')
}

export default function WrappedCard({ list }: { list: ApiAnime[] }) {
  const [busy, setBusy] = useState(false)

  async function generate() {
    setBusy(true)
    try {
      const url = await drawWrapped(list)
      const a = document.createElement('a')
      a.href = url
      a.download = `anime-wrapped-${new Date().getFullYear()}.png`
      a.click()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={generate}
      disabled={busy || list.length === 0}
      className="btn-ghost border border-white/10 px-4 py-2 text-sm"
    >
      {busy ? 'Készül…' : '⬇ Wrapped-kártya'}
    </button>
  )
}
