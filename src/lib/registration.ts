export type RegistrationMode = 'open' | 'invite' | 'closed'

// Ismeretlen érték esetén a biztonságos irány a zárva — egy elgépelt env
// ne nyissa ki a kaput. Hiányzó env = open, mert ez a szándékolt alapállapot.
export function registrationMode(): RegistrationMode {
  const raw = process.env.REGISTRATION_MODE
  if (raw == null || raw === '') return 'open'
  return raw === 'open' || raw === 'invite' || raw === 'closed' ? raw : 'closed'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[a-z0-9_-]{3,24}$/
export const MIN_PASSWORD_LENGTH = 8

export type RegistrationInput = { email: string; username: string; password: string }
export type RegistrationResult =
  | { ok: true; email: string; username: string }
  | { ok: false; field: 'email' | 'username' | 'password' }

export function validateRegistration(input: RegistrationInput): RegistrationResult {
  const email = input.email.trim().toLowerCase()
  const username = input.username.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { ok: false, field: 'email' }
  if (!USERNAME_RE.test(username)) return { ok: false, field: 'username' }
  if (input.password.length < MIN_PASSWORD_LENGTH) return { ok: false, field: 'password' }
  return { ok: true, email, username }
}
