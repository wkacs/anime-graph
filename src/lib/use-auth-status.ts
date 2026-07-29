'use client'

import { useEffect, useState } from 'react'

/** Lightweight session check for navigation on public pages. */
export function useAuthStatus(): boolean | null {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  useEffect(() => {
    fetch('/api/auth')
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((data: { authenticated?: boolean }) => setAuthenticated(Boolean(data.authenticated)))
      .catch(() => setAuthenticated(false))
  }, [])
  return authenticated
}
