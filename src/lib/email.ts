import { siteUrl } from './seo'

export type SendEmailOptions = {
  text?: string
  idempotencyKey?: string
  tag?: string
}
export type SendEmailResult = {
  sent: boolean
  id?: string
  reason?: string
  status?: number
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Közös Resend REST-kliens. A direkt REST-hívás szándékos: a kis felülethez
 * nincs szükség SDK-ra, de ugyanazokat a megbízhatósági garanciákat itt adjuk meg.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options: SendEmailOptions = {},
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.FROM_EMAIL?.trim()
  if (!apiKey || !from) {
    console.warn('sendEmail kihagyva: hiányzó RESEND_API_KEY vagy FROM_EMAIL')
    return { sent: false, reason: 'email_kuldo_nincs_beallitva' }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'anime-graph/0.1.0',
  }
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey.slice(0, 256)
  }

  const tag = options.tag?.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 256)
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text: options.text ?? htmlToText(html),
        ...(tag ? { tags: [{ name: 'category', value: tag }] } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.error('Resend kézbesítési hiba:', { status: res.status })
      return { sent: false, reason: `Resend HTTP ${res.status}`, status: res.status }
    }
    const payload = await res.json().catch(() => null) as { id?: unknown } | null
    const id = typeof payload?.id === 'string' ? payload.id : undefined
    return { sent: true, id }
  } catch (error) {
    const name = error instanceof Error ? error.name : 'unknown'
    console.error('Resend hálózati hiba:', { name })
    return { sent: false, reason: 'email_halozati_hiba' }
  }
}

function layout(title: string, body: string, cta: string, url: string): string {
  const safeUrl = escapeHtml(url)
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(title)}</h1>
<p style="color:#444;line-height:1.5">${escapeHtml(body)}</p>
<p><a href="${safeUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${escapeHtml(cta)}</a></p>
<p style="color:#888;font-size:12px">${safeUrl}</p></div>`
}

export function verifyEmailTemplate(token: string, locale: string) {
  const url = `${siteUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`
  return locale === 'hu'
    ? {
        subject: 'Erősítsd meg az e-mail-címed — Anime Graph',
        html: layout(
          'Erősítsd meg az e-mail-címed',
          'Kattints a gombra, és kész. A link 24 óráig érvényes.',
          'Megerősítem',
          url,
        ),
        text: `Erősítsd meg az e-mail-címed. A link 24 óráig érvényes:\n${url}`,
      }
    : {
        subject: 'Confirm your email — Anime Graph',
        html: layout(
          'Confirm your email',
          'Click the button below. The link is valid for 24 hours.',
          'Confirm email',
          url,
        ),
        text: `Confirm your email. This link is valid for 24 hours:\n${url}`,
      }
}

export function resetEmailTemplate(token: string, locale: string) {
  const url = `${siteUrl()}/login?reset=${encodeURIComponent(token)}`
  return locale === 'hu'
    ? {
        subject: 'Jelszó-visszaállítás — Anime Graph',
        html: layout(
          'Jelszó-visszaállítás',
          'A link 1 óráig érvényes. Ha nem te kérted, hagyd figyelmen kívül.',
          'Új jelszó beállítása',
          url,
        ),
        text: `Jelszó-visszaállítás. A link 1 óráig érvényes:\n${url}\n\nHa nem te kérted, hagyd figyelmen kívül.`,
      }
    : {
        subject: 'Password reset — Anime Graph',
        html: layout(
          'Password reset',
          'This link is valid for 1 hour. If you did not request it, ignore this email.',
          'Set a new password',
          url,
        ),
        text: `Password reset. This link is valid for 1 hour:\n${url}\n\nIf you did not request it, ignore this email.`,
      }
}
