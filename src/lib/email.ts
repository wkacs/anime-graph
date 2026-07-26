import { siteUrl } from './seo'

// Resend REST-en át, SDK nélkül — a repó a napi digestet is így küldi.
// Kulcs nélkül no-op: a regisztráció fejlesztés közben is működjön.
export async function sendEmail(
  to: string, subject: string, html: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('sendEmail kihagyva (nincs RESEND_API_KEY):', to, subject)
    return { sent: false, reason: 'RESEND_API_KEY nincs beallitva' }
  }
  const from = process.env.FROM_EMAIL ?? 'no-reply@anime-graph.app'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { sent: false, reason: `Resend ${res.status}` }
    return { sent: true }
  } catch (e) {
    console.error('sendEmail hiba:', e)
    return { sent: false, reason: 'halozati hiba' }
  }
}

function layout(title: string, body: string, cta: string, url: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
<p style="color:#444;line-height:1.5">${body}</p>
<p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${cta}</a></p>
<p style="color:#888;font-size:12px">${url}</p></div>`
}

// A linkek siteUrl()-lel epulnek → az APP_URL (vagy a Vercel prod-domain)
// beallitasa kotelezo, kulonben localhost-ra mutatnanak.
export function verifyEmailTemplate(token: string, locale: string) {
  const url = `${siteUrl()}/api/auth/verify?token=${token}`
  return locale === 'hu'
    ? {
        subject: 'Erősítsd meg az e-mail-címed — Anime Graph',
        html: layout('Erősítsd meg az e-mail-címed',
          'Kattints a gombra, és kész. A link 24 óráig érvényes.', 'Megerősítem', url),
      }
    : {
        subject: 'Confirm your email — Anime Graph',
        html: layout('Confirm your email',
          'Click the button below. The link is valid for 24 hours.', 'Confirm email', url),
      }
}

export function resetEmailTemplate(token: string, locale: string) {
  const url = `${siteUrl()}/login?reset=${token}`
  return locale === 'hu'
    ? {
        subject: 'Jelszó-visszaállítás — Anime Graph',
        html: layout('Jelszó-visszaállítás',
          'A link 1 óráig érvényes. Ha nem te kérted, hagyd figyelmen kívül.',
          'Új jelszó beállítása', url),
      }
    : {
        subject: 'Password reset — Anime Graph',
        html: layout('Password reset',
          'This link is valid for 1 hour. If you did not request it, ignore this email.',
          'Set a new password', url),
      }
}
