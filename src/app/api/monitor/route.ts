import { NextRequest, NextResponse } from 'next/server'
import { sanitizeReport, forwardToSentry } from '@/lib/monitor'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Kliens-hibariportok gyűjtője (global-error küldi). Publikus végpont, ezért
// szigorú: méret-vágott mezők (sanitizeReport) + IP-alapú rate-limit.
// A console.error a Vercel-logokban landol; SENTRY_DSN esetén Sentry-be is megy.
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers)
  if (!(await rateLimit('monitor', ip, 10, 3600))) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }
  const report = sanitizeReport(await req.json().catch(() => null))
  if (!report) return NextResponse.json({ ok: false }, { status: 400 })

  console.error('[client-error]', report.message, report.url ?? '', report.stack ?? '')
  await forwardToSentry(report)
  return NextResponse.json({ ok: true })
}
