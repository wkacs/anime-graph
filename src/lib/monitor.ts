// Könnyű kliens-hibafigyelő SDK nélkül. A kliens a /api/monitor-ra POST-ol,
// az szerver-oldalon console.error-t ír (→ Vercel-logok), és ha van SENTRY_DSN,
// a Sentry store API-ra is továbbít. Nincs @sentry/nextjs függőség: a teljes
// SDK build-wrapper + source-map-upload kört nem éri meg ez a projekt-méret.

export type SentryTarget = { url: string; authHeader: string }

/** DSN (https://<kulcs>@<host>/<projektId>) → store-végpont + auth-fejléc. */
export function parseSentryDsn(dsn: string): SentryTarget | null {
  let u: URL
  try {
    u = new URL(dsn)
  } catch {
    return null
  }
  const key = u.username
  const projectId = u.pathname.replace(/^\//, '')
  if (u.protocol !== 'https:' || !key || !/^\d+$/.test(projectId)) return null
  return {
    url: `${u.protocol}//${u.host}/api/${projectId}/store/`,
    authHeader: `Sentry sentry_version=7, sentry_client=anime-graph/1.0, sentry_key=${key}`,
  }
}

export type ClientErrorReport = { message: string; stack?: string; url?: string }

export function redactSensitive(value: string): string {
  return value
    .replace(/([?&](?:token|reset|code|state)=)[^&#\s]+/gi, '$1[redacted]')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[redacted]')
    .replace(/(bearer\s+)[A-Za-z0-9._~+/=-]{16,}/gi, '$1[redacted]')
    .replace(/\b(?:re_|sk-)[A-Za-z0-9_-]{16,}\b/g, '[redacted-api-key]')
}

export function sanitizeReportUrl(value: string): string | undefined {
  try {
    const base = 'https://report.invalid'
    const url = new URL(value, base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.origin === base ? url.pathname : `${url.origin}${url.pathname}`
  } catch {
    return undefined
  }
}

/** Kliens-riport szigorú vágása: csak ismert mezők, kemény méret-plafonnal. */
export function sanitizeReport(body: unknown): ClientErrorReport | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const message = typeof b.message === 'string'
    ? redactSensitive(b.message).slice(0, 500)
    : ''
  if (!message.trim()) return null
  return {
    message,
    stack: typeof b.stack === 'string'
      ? redactSensitive(b.stack).slice(0, 4000)
      : undefined,
    url: typeof b.url === 'string'
      ? sanitizeReportUrl(b.url)?.slice(0, 300)
      : undefined,
  }
}

/** Riport továbbítása a Sentry-nek, ha van DSN. Hibája sosem dobódik tovább. */
export async function forwardToSentry(report: ClientErrorReport): Promise<boolean> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return false
  const target = parseSentryDsn(dsn)
  if (!target) return false
  try {
    const res = await fetch(target.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': target.authHeader },
      body: JSON.stringify({
        platform: 'javascript',
        level: 'error',
        timestamp: Date.now() / 1000,
        message: { formatted: report.message },
        request: report.url ? { url: report.url } : undefined,
        extra: report.stack ? { stack: report.stack } : undefined,
      }),
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}
