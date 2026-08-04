'use client'

import { useEffect, useState } from 'react'

/*
  Lightweight session check for navigation on public pages.

  Modul-szintu gyorsitotar + egyetlen repulo keres: korabban minden hivo
  (TopNav, MobileTabBar) sajat /api/auth kerest inditott ugyanarra a valaszra,
  es mindketto kulon-kulon esett at a „meg nem tudom" allapoton. Igy egy keres
  szolgal ki mindenkit, es a valasz megerkezese utan felcsatolodo komponensek
  AZONNAL a helyes ertekkel indulnak — nem villantjak fel a vendeg-nezetet.
*/

let cached: boolean | null = null
let inflight: Promise<boolean> | null = null
const subscribers = new Set<(v: boolean) => void>()

function load(): Promise<boolean> {
  if (inflight) return inflight
  inflight = fetch('/api/auth')
    .then((r) => (r.ok ? r.json() : { authenticated: false }))
    .then((data: { authenticated?: boolean }) => Boolean(data?.authenticated))
    .catch(() => false)
    .then((v) => {
      cached = v
      subscribers.forEach((fn) => fn(v))
      return v
    })
  return inflight
}

/** `null` = a valasz meg uton van. A hivo ilyenkor SEMLEGES allapotot mutasson. */
export function useAuthStatus(): boolean | null {
  const [authenticated, setAuthenticated] = useState<boolean | null>(cached)

  useEffect(() => {
    if (cached !== null) {
      setAuthenticated(cached)
      return
    }
    subscribers.add(setAuthenticated)
    load()
    return () => {
      subscribers.delete(setAuthenticated)
    }
  }, [])

  return authenticated
}

/** csak tesztekhez: a modul-szintu allapot uritese */
export function __resetAuthStatusCache() {
  cached = null
  inflight = null
  subscribers.clear()
}
