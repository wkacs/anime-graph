import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Az ISR-oldalak (revalidate=86400 katalógus-shell) alatt futó modulok NEM
// használhatják a globális `db` klienst: annak `fetchOptions: { cache: 'no-store' }`
// beállítása DYNAMIC_SERVER_USAGE-dzsel 500-at dob a statikus renderben.
// Ez a hiba csak `next build` + `next start` alatt jelentkezik, dev alatt nem —
// ezért forrás-szintű őrszem, hogy ne csússzon vissza (lásd 7789eaf, majd a
// staff-szekcióval visszatért regresszió).
const ISR_SAFE_MODULES = ['catalog-page.ts', 'api-cache.ts', 'staff-cache.ts']

// Ugyanaz a csapda mas alakban: a `server-i18n.ts` cookie()/headers()-t olvas,
// ami szinten dinamikussa teszi a rendert. ISR-modul nem importalhatja.
const ISR_FORBIDDEN_IMPORTS = ['@/lib/server-i18n', './server-i18n']

const readLib = (file: string) => readFileSync(join(__dirname, file), 'utf8')

// a '@/db/client'-ből importált NEVEK (az `as` alias előtti, forrás-oldali oldal)
export function importedDbClientBindings(src: string): string[] {
  const names: string[] = []
  const re = /import\s*\{([^}]*)\}\s*from\s*'@\/db\/client'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    for (const spec of m[1].split(',')) {
      const source = spec.trim().split(/\s+as\s+/)[0].trim()
      if (source) names.push(source)
    }
  }
  return names
}

describe('ISR-biztos DB-kliens', () => {
  for (const file of ISR_SAFE_MODULES) {
    it(`${file} nem importálja a no-store 'db' klienst`, () => {
      const bindings = importedDbClientBindings(readLib(file))
      expect(bindings, `${file}: ISR-oldal alatt csak dbStatic használható`).not.toContain('db')
    })
  }

  for (const file of ISR_SAFE_MODULES) {
    it(`${file} nem importálja a dinamikus locale-feloldót`, () => {
      const src = readLib(file)
      for (const mod of ISR_FORBIDDEN_IMPORTS) {
        expect(src, `${file}: a ${mod} cookie()/headers()-t olvas → DYNAMIC_SERVER_USAGE`)
          .not.toContain(mod)
      }
    })
  }

  it('az őrszem tényleg kiszúrja a no-store importot', () => {
    expect(importedDbClientBindings("import { db } from '@/db/client'")).toEqual(['db'])
    expect(importedDbClientBindings("import { dbStatic as db } from '@/db/client'")).toEqual(['dbStatic'])
    expect(importedDbClientBindings("import { db, dbStatic } from '@/db/client'")).toEqual(['db', 'dbStatic'])
  })

  it('a no-store kliens továbbra is létezik a dinamikus route-oknak', () => {
    const src = readFileSync(join(__dirname, '..', 'db', 'client.ts'), 'utf8')
    expect(src).toMatch(/cache:\s*'no-store'/)
    expect(src).toMatch(/export const dbStatic/)
  })
})
