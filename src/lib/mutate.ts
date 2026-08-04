/*
  Egy kozos mutacio-hivo. Minden iras ezen megy at, hogy a hiba SOSE tunjon el
  nemaan: a hivo `ok`-t kap, a hibauzenet pedig a szerver sajat `error`
  mezojebol jon, ha van.

  Nem dob kivetelt: a halozati hiba is `{ ok: false }`-kent jon vissza, mert a
  hivo helyeken eddig sem volt try/catch, es egy dobas ott nema maradna.
*/

export type MutateResult<T = unknown> = {
  ok: boolean
  status: number
  data: T | null
  error: string | null
}

export async function mutate<T = unknown>(
  input: string,
  init?: RequestInit,
): Promise<MutateResult<T>> {
  try {
    const res = await fetch(input, init)
    let data: T | null = null
    let error: string | null = null
    // 204-nel es ures torzsnel a json() dob — az nem hiba
    const text = await res.text()
    if (text) {
      try {
        const parsed = JSON.parse(text) as T & { error?: string }
        data = parsed
        if (typeof parsed?.error === 'string') error = parsed.error
      } catch {
        /* nem JSON: a status dont */
      }
    }
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : error }
  } catch {
    return { ok: false, status: 0, data: null, error: null }
  }
}
