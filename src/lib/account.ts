export const DELETE_ACCOUNT_CONFIRMATION = 'DELETE'

export function canDeleteAccount(password: unknown, confirmation: unknown): boolean {
  return typeof password === 'string' && password.length > 0
    && confirmation === DELETE_ACCOUNT_CONFIRMATION
}

export function accountExportFilename(username: string, date = new Date()): string {
  const safeUsername = username.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'account'
  return `anime-graph-${safeUsername}-${date.toISOString().slice(0, 10)}.json`
}
