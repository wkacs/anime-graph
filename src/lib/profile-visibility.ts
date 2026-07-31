export type ProfileVisibility = 'public' | 'private'

export function profileVisibility(value: unknown): ProfileVisibility {
  return value === 'public' ? 'public' : 'private'
}

// A tulajdonos sajat adatait mindig eleri; mindenki mas csak publikus profilhoz
// tartozo lista- vagy izlesadatot kerhet le.
export function canViewProfile(viewerId: number | null, ownerId: number, value: unknown): boolean {
  return viewerId === ownerId || profileVisibility(value) === 'public'
}
