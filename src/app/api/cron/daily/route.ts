import { NextRequest, NextResponse } from 'next/server'
import { authorizeCron } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Napi gyűjtő-cron: a Vercel Hobby-terv 2 cron-slotot ad, ezért az egyik slot
// ez az orchestrator, ami sorban meghívja a meglévő napi feladatokat
// (saját deploy-on belüli fetch, ugyanazzal a Bearer-secrettel).
// A másik slot a /api/cron/sync-catalog.
const JOBS = ['/api/cron/airing-check?mode=email', '/api/cron/time-capsule'] as const

export async function GET(req: NextRequest) {
  const auth = authorizeCron(process.env.CRON_SECRET, req.headers.get('authorization'))
  if (auth === 'misconfigured') return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 })
  if (auth === 'unauthorized') return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const origin = req.nextUrl.origin
  const results: Record<string, unknown> = {}
  for (const path of JOBS) {
    try {
      const res = await fetch(`${origin}${path}`, {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        cache: 'no-store',
      })
      results[path] = res.ok ? await res.json() : { error: `HTTP ${res.status}` }
    } catch (e) {
      // egy elhasalt job ne vigye el a többit — a hibát a válasz hordozza
      results[path] = { error: String(e instanceof Error ? e.message : e) }
    }
  }
  return NextResponse.json(results)
}
