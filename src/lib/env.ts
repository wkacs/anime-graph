const MIN_SESSION_SECRET_LENGTH = 32

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * A session aláírása soha nem eshet vissza üres vagy "undefined" kulcsra.
 * Productionben a rövid kulcsot is konfigurációs hibának tekintjük.
 */
export function sessionSecret(): string {
  const value = process.env.SESSION_SECRET?.trim()
  if (!value) {
    throw new Error('SESSION_SECRET nincs beállítva')
  }
  if (isProductionEnv() && value.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET legalább ${MIN_SESSION_SECRET_LENGTH} karakter legyen productionben`)
  }
  return value
}

export function emailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.FROM_EMAIL?.trim())
}

