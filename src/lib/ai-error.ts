// A kliensnek fix, barátságos üzenet megy — a nyers hibát a hívó console.error-ozza.
export function aiUserErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  // a kvóta-hibát változatlanul átengedjük (ez felhasználó-barát és informatív)
  if (raw.includes('napi AI-keretet') || raw.includes('napi limitjén')) return raw
  return 'Az AI most nem elérhető, próbáld újra pár perc múlva'
}
