'use client'
import { useEffect } from 'react'

// Legfelső hibahatár: ha a gyökér-layout is elhasal, ez renderel. Saját
// <html>/<body> kell neki, és nem támaszkodhat a globals.css-re — minden
// stílus inline. A hibát a /api/monitor-ra riportolja (→ Vercel-log + Sentry).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    fetch('/api/monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message || 'unknown client error',
        stack: error.stack,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    }).catch(() => { /* a riport-hiba nem ronthat tovább a helyzeten */ })
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#09090b', color: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#888891', marginBottom: 12 }}>Anime Graph</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Something went wrong · Valami elromlott</h1>
          <p style={{ fontSize: 14, color: '#a1a1aa', marginBottom: 20 }}>
            The error has been reported. · A hibát jelentettük.
          </p>
          <button
            onClick={reset}
            style={{ borderRadius: 9999, border: 'none', background: '#fafafa', color: '#0c0c0e', padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Retry · Újra
          </button>
        </div>
      </body>
    </html>
  )
}
