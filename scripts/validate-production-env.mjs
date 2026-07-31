const shouldValidate =
  process.env.VERCEL_ENV === 'production'
  || process.env.VALIDATE_PRODUCTION_ENV === '1'

if (shouldValidate) {
  const required = [
    'DATABASE_URL',
    'GLM_API_KEY',
    'SESSION_SECRET',
    'REGISTRATION_MODE',
    'AI_GLOBAL_DAILY_LIMIT',
    'CRON_SECRET',
    'APP_URL',
    'NEXT_PUBLIC_OPERATOR_NAME',
    /* NEXT_PUBLIC_OPERATOR_ADDRESS szándékosan NEM kötelező (user-döntés
       2026-07-31): a jogi oldalak cím nélkül is korrekt szöveget adnak. */
    'NEXT_PUBLIC_OPERATOR_EMAIL',
  ]
  const errors = []
  for (const name of required) {
    const value = process.env[name]?.trim()
    if (!value) errors.push(`${name} nincs beállítva`)
    else if (/TODO|localhost/i.test(value)) errors.push(`${name} nem lehet TODO/localhost érték`)
  }

  /* Email-kézbesítés: WARNING, nem error (user-döntés 2026-07-31, még nincs
     Resend/domain). Enélkül a reg-megerősítő és jelszó-reset levél nem megy
     ki — a domain+Resend beállításakor visszaemelendő a required-listába. */
  for (const name of ['RESEND_API_KEY', 'FROM_EMAIL']) {
    if (!process.env[name]?.trim()) {
      console.warn(`FIGYELEM: ${name} nincs beállítva — email-küldés inaktív.`)
    }
  }

  if ((process.env.SESSION_SECRET?.trim().length ?? 0) < 32) {
    errors.push('SESSION_SECRET legalább 32 karakter legyen')
  }
  if ((process.env.CRON_SECRET?.trim().length ?? 0) < 32) {
    errors.push('CRON_SECRET legalább 32 karakter legyen')
  }

  const aiLimit = Number(process.env.AI_GLOBAL_DAILY_LIMIT)
  if (!Number.isInteger(aiLimit) || aiLimit <= 0) {
    errors.push('AI_GLOBAL_DAILY_LIMIT pozitív egész szám legyen')
  }

  const registrationMode = process.env.REGISTRATION_MODE
  if (!['open', 'invite', 'closed'].includes(registrationMode ?? '')) {
    errors.push('REGISTRATION_MODE csak open, invite vagy closed lehet')
  }
  if (registrationMode === 'invite' && !process.env.INVITE_CODE?.trim()) {
    errors.push('invite módban INVITE_CODE kötelező')
  }

  const oauthProviders = [
    ['MAL_CLIENT_ID', 'MAL_CLIENT_SECRET'],
    ['ANILIST_CLIENT_ID', 'ANILIST_CLIENT_SECRET'],
  ]
  let oauthConfigured = false
  for (const [clientIdName, clientSecretName] of oauthProviders) {
    const hasId = Boolean(process.env[clientIdName]?.trim())
    const hasSecret = Boolean(process.env[clientSecretName]?.trim())
    if (hasId !== hasSecret) {
      errors.push(`${clientIdName} és ${clientSecretName} csak együtt állítható be`)
    }
    oauthConfigured ||= hasId || hasSecret
  }
  if (oauthConfigured) {
    const encodedKey = process.env.OAUTH_TOKEN_ENCRYPTION_KEY?.trim()
    if (!encodedKey) {
      errors.push('OAuth szinkronhoz OAUTH_TOKEN_ENCRYPTION_KEY kötelező')
    } else {
      const encoding = /[-_]/.test(encodedKey) ? 'base64url' : 'base64'
      if (Buffer.from(encodedKey, encoding).length !== 32) {
        errors.push('OAUTH_TOKEN_ENCRYPTION_KEY pontosan 32 bájtos base64 kulcs legyen')
      }
    }
  }

  try {
    const appUrl = new URL(process.env.APP_URL ?? '')
    if (appUrl.protocol !== 'https:') errors.push('APP_URL productionben https:// URL legyen')
    if (appUrl.pathname !== '/' || appUrl.search || appUrl.hash || appUrl.username || appUrl.password) {
      errors.push('APP_URL csak origint tartalmazhat útvonal, query, hash vagy belépési adat nélkül')
    }
  } catch {
    errors.push('APP_URL érvénytelen URL')
  }

  if (errors.length) {
    console.error('Production környezeti ellenőrzés sikertelen:')
    for (const error of [...new Set(errors)]) console.error(`- ${error}`)
    process.exit(1)
  }
  console.log('Production környezeti ellenőrzés rendben.')
}
