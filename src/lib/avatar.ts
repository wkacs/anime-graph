// Nincs képfeltöltés: az avatar a felhasználónévből származik, így nem kell
// tároló, és nem kell moderálni sem (az a C-kör dolga lenne).

export function avatarInitials(username: string): string {
  const parts = username.split(/[-_.\s]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function avatarHue(username: string): number {
  let h = 0
  for (let i = 0; i < username.length; i++) {
    h = (h * 31 + username.charCodeAt(i)) % 360
  }
  return h
}
