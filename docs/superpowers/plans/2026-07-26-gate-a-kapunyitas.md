# Gate A — Kapunyitás Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nyisd meg a regisztrációt idegenek előtt: email-megerősítéssel, jelszó-visszaállítással, angol alapnyelvvel (magyar váltható) és publikus profillal.

**Architecture:** A meglévő HMAC-alapú, adatbázis-mentes session megmarad, de a payload kiegészül egy `tokenVersion` mezővel, amit a `requireUserId` process-memóriás cache-ből egyeztet — így a jelszó-reset kilépteti a többi eszközt anélkül, hogy kérésenként adatbázist olvasnánk. Az email-tokenek külön `auth_tokens` táblában élnek, kizárólag sha256-hash formában. Az i18n next-intl „without routing" módban fut: a locale cookie-ból jön, az URL és a meglévő 133 840 kanonikus SEO-URL érintetlen marad.

**Tech Stack:** Next.js 15.5.20 (App Router), React 19, Neon Postgres + Drizzle, vitest, next-intl, Resend (REST, SDK nélkül).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-26-gate-a-kapunyitas-design.md` (commit `4267135`). Ütközés esetén a spec dönt.
- **Tesztek adatbázis és hálózat nélkül futnak.** Minden új logika tiszta függvényként tesztelhető; a route-okat nem teszteljük integrációsan.
- **Teszt-parancsok:** teljes futás `npm test`; egy fájl `npx vitest run <path>`; típusellenőrzés `npx tsc --noEmit`; lint `npx eslint src --max-warnings=0`.
- **ISR-szabály:** ISR-oldal alatt futó modul **soha** nem importálhatja a no-store `db` klienst, csak `dbStatic`-ot. Az őrszem-teszt `src/lib/isr-db-client.test.ts` ezt ellenőrzi; ha új modul kerül ISR-útvonalra, vedd fel az `ISR_SAFE_MODULES` listára.
- **Migrációs scriptek** `process.env.DATABASE_URL`-t olvasnak, **nem** a `.env.local`-t. Futtatás: `DATABASE_URL="..." node scripts/<name>.mjs`. Minden script idempotens (`IF NOT EXISTS`).
- **Jelszó-minimum 8 karakter** (a jelenlegi 6 helyett).
- **Session-élettartam 30 nap** (a jelenlegi 365 helyett), csúszó megújítással a felezőpont után.
- **Token-élettartam:** verify 24 óra, reset 1 óra.
- **Rate-limitek:** register IP 5/óra és email 3/óra; verify-resend 3/óra/user; forgot email 3/óra; login 10/10 perc/IP (már létezik).
- **Nyers tokent soha nem tárolunk**, csak sha256 hash-t.
- **A `/api/auth/forgot` mindig 200-at ad**, létező és nem létező címre egyaránt.
- **Nyelvi kulcsok az angol forrásból képződnek**, nem a magyarból.
- **Commit-nyelv:** magyar, ékezet nélkül, a repó meglévő stílusában (`feat(auth): ...`, `fix(i18n): ...`).

---

## Fájl-térkép

**Új fájlok:**

| Fájl | Felelősség |
|---|---|
| `scripts/migrate-gate-a.mjs` | DDL: `users` bővítés, `auth_tokens`, `taste_memory.lang` |
| `src/lib/auth-token.ts` | Token generálás, sha256-hash, lejárat-ellenőrzés (tiszta fn) |
| `src/lib/auth-token.test.ts` | Fenti tesztjei |
| `src/lib/email.ts` | Resend REST küldés + verify/reset levélsablonok |
| `src/lib/email.test.ts` | Sablon- és no-op tesztek |
| `src/lib/registration.ts` | `REGISTRATION_MODE` feloldás + regisztráció-validáció (tiszta fn) |
| `src/lib/registration.test.ts` | Fenti tesztjei |
| `src/lib/token-version.ts` | `token_version` cache-elt egyeztetés (60 s TTL) |
| `src/lib/token-version.test.ts` | Cache-viselkedés tesztjei |
| `src/app/api/auth/verify/route.ts` | Email-megerősítés |
| `src/app/api/auth/verify/resend/route.ts` | Megerősítő újraküldés |
| `src/app/api/auth/forgot/route.ts` | Reset-link kérés |
| `src/app/api/auth/reset/route.ts` | Jelszó-csere |
| `src/lib/locale.ts` | Locale feloldás (cookie / user / `Accept-Language`) |
| `src/lib/locale.test.ts` | Fenti tesztjei |
| `src/i18n/request.ts` | next-intl `getRequestConfig` |
| `messages/en.json`, `messages/hu.json` | Szótárak |
| `src/components/LocaleSwitcher.tsx` | Nyelvváltó |
| `src/lib/avatar.ts` | Monogram + szín generálás névből (tiszta fn) |
| `src/lib/avatar.test.ts` | Fenti tesztjei |
| `src/components/Avatar.tsx` | Monogram-avatar megjelenítés |
| `src/app/u/[username]/page.tsx` | Publikus profil |

**Módosuló fájlok:**

| Fájl | Változás |
|---|---|
| `src/db/schema.ts` | `users` új oszlopok, `authTokens` tábla, `tasteMemory.lang` |
| `src/lib/auth.ts` | Session payload `uid.ver.exp.hmac` |
| `src/lib/session.ts` | `requireUserId` egyezteti a `token_version`-t |
| `src/app/api/auth/route.ts` | Login: új session-formátum, 30 nap |
| `src/app/api/auth/register/route.ts` | Email kötelező, `REGISTRATION_MODE`, jelszó ≥ 8 |
| `src/app/api/settings/route.ts` | `locale`, `bio`, `profileVisibility` |
| `src/app/layout.tsx` | `NextIntlClientProvider` |
| `src/middleware.ts` | `/u/` és az új auth-végpontok publikus prefixei |
| `next.config.ts` | next-intl plugin |
| `src/lib/glm.ts` és a 9 AI-modul | `locale` paraméter |
| 41 `.tsx` + 38 API-route | Szöveg-átvezetés (2. szakasz) |

---

# 1. SZAKASZ — AUTH

## Task 1: Adatbázis-séma és migrációs script

**Files:**
- Create: `scripts/migrate-gate-a.mjs`
- Modify: `src/db/schema.ts`

**Interfaces:**
- Consumes: semmit (első task)
- Produces: `authTokens` Drizzle-tábla (`id`, `userId`, `kind`, `tokenHash`, `expiresAt`, `usedAt`, `createdAt`); `users` új mezői `email`, `emailVerifiedAt`, `tokenVersion`, `locale`, `bio`; `tasteMemory.lang`

- [ ] **Step 1: Írd meg a migrációs scriptet**

Create `scripts/migrate-gate-a.mjs`:

```javascript
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en'`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email)) WHERE email IS NOT NULL`

  await sql`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind text NOT NULL,
      token_hash text NOT NULL,
      expires_at timestamp NOT NULL,
      used_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS auth_tokens_hash_unique ON auth_tokens (token_hash)`
  await sql`CREATE INDEX IF NOT EXISTS auth_tokens_user_kind ON auth_tokens (user_id, kind)`

  await sql`ALTER TABLE taste_memory ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'hu'`
  console.log('migrate-gate-a: OK')
}
main().catch((e) => { console.error(e); process.exit(1) })
```

Az email-unique index részleges (`WHERE email IS NOT NULL`), különben a meglévő, email nélküli `id=1` sor ütközne egy későbbi NULL-lal. A `lower(email)` azért kell, hogy `Kacs@x.hu` és `kacs@x.hu` ne lehessen két fiók.

- [ ] **Step 2: Vezesd át a sémát a Drizzle-be**

Modify `src/db/schema.ts` — a `users` tábla definíciójában a `tier` sor után:

```typescript
  email: text('email'),
  emailVerifiedAt: timestamp('email_verified_at'),
  tokenVersion: integer('token_version').notNull().default(0),
  locale: text('locale').notNull().default('en'),
  bio: text('bio'),
```

A `tasteMemory` táblához add hozzá:

```typescript
  lang: text('lang').notNull().default('hu'),
```

És vedd fel az új táblát (a `users` definíció után):

```typescript
export const authTokens = pgTable('auth_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // verify | reset
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('auth_tokens_hash_unique').on(t.tokenHash),
  index('auth_tokens_user_kind').on(t.userId, t.kind),
])
```

- [ ] **Step 3: Ellenőrizd, hogy fordul**

Run: `npx tsc --noEmit`
Expected: exit 0. Ha `uniqueIndex` vagy `index` nincs importálva a fájl tetején, add hozzá a meglévő drizzle-importhoz.

- [ ] **Step 4: Futtasd a migrációt a dev adatbázison**

Run: `DATABASE_URL="<dev neon string a .env.local-ból>" node scripts/migrate-gate-a.mjs`
Expected: `migrate-gate-a: OK`

Futtasd **kétszer** — másodszorra is `OK`-t kell adnia, ez bizonyítja az idempotenciát.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-gate-a.mjs src/db/schema.ts
git commit -m "feat(auth): gate-A sema — users bovites, auth_tokens, taste_memory.lang"
```

---

## Task 2: Token-generálás és -hash

**Files:**
- Create: `src/lib/auth-token.ts`, `src/lib/auth-token.test.ts`

**Interfaces:**
- Consumes: semmit
- Produces: `newToken(): string`, `hashToken(raw: string): string`, `tokenExpiry(kind: TokenKind, now?: Date): Date`, `isTokenUsable(row: {expiresAt: Date; usedAt: Date | null}, now?: Date): boolean`, `type TokenKind = 'verify' | 'reset'`

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `src/lib/auth-token.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { newToken, hashToken, tokenExpiry, isTokenUsable } from './auth-token'

describe('newToken', () => {
  it('URL-biztos es eleg hosszu', () => {
    const t = newToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]{32,}$/)
  })
  it('ket hivas kulonbozo tokent ad', () => {
    expect(newToken()).not.toBe(newToken())
  })
})

describe('hashToken', () => {
  it('determinisztikus sha256 hex', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).toHaveLength(64)
  })
  it('mas input mas hash', () => {
    expect(hashToken('abc')).not.toBe(hashToken('abd'))
  })
})

describe('tokenExpiry', () => {
  const now = new Date('2026-07-26T12:00:00Z')
  it('verify = 24 ora', () => {
    expect(tokenExpiry('verify', now).toISOString()).toBe('2026-07-27T12:00:00.000Z')
  })
  it('reset = 1 ora', () => {
    expect(tokenExpiry('reset', now).toISOString()).toBe('2026-07-26T13:00:00.000Z')
  })
})

describe('isTokenUsable', () => {
  const now = new Date('2026-07-26T12:00:00Z')
  it('ervenyes es hasznalatlan → true', () => {
    expect(isTokenUsable({ expiresAt: new Date('2026-07-26T13:00:00Z'), usedAt: null }, now)).toBe(true)
  })
  it('lejart → false', () => {
    expect(isTokenUsable({ expiresAt: new Date('2026-07-26T11:00:00Z'), usedAt: null }, now)).toBe(false)
  })
  it('mar hasznalt → false', () => {
    expect(isTokenUsable({ expiresAt: new Date('2026-07-26T13:00:00Z'), usedAt: new Date('2026-07-26T11:00:00Z') }, now)).toBe(false)
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/auth-token.test.ts`
Expected: FAIL — „Failed to resolve import './auth-token'"

- [ ] **Step 3: Írd meg a minimális implementációt**

Create `src/lib/auth-token.ts`:

```typescript
import { createHash, randomBytes } from 'node:crypto'

export type TokenKind = 'verify' | 'reset'

const TTL_SEC: Record<TokenKind, number> = {
  verify: 24 * 3600,
  reset: 3600,
}

/** URL-biztos veletlen token — ez megy a linkbe, ezt SOHA nem taroljuk */
export function newToken(): string {
  return randomBytes(32).toString('base64url')
}

/** csak a hash kerul adatbazisba: szivargas eseten sem hasznalhato fiok-atvetelre */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function tokenExpiry(kind: TokenKind, now = new Date()): Date {
  return new Date(now.getTime() + TTL_SEC[kind] * 1000)
}

export function isTokenUsable(
  row: { expiresAt: Date; usedAt: Date | null },
  now = new Date(),
): boolean {
  return row.usedAt == null && row.expiresAt.getTime() > now.getTime()
}
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/auth-token.test.ts`
Expected: PASS, 9 teszt

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-token.ts src/lib/auth-token.test.ts
git commit -m "feat(auth): token-generalas es sha256-hash (auth-token)"
```

---

## Task 3: Email-küldés

**Files:**
- Create: `src/lib/email.ts`, `src/lib/email.test.ts`

**Interfaces:**
- Consumes: `siteUrl()` from `@/lib/seo`
- Produces: `sendEmail(to: string, subject: string, html: string): Promise<{sent: boolean; reason?: string}>`, `verifyEmailTemplate(token: string, locale: string): {subject: string; html: string}`, `resetEmailTemplate(token: string, locale: string): {subject: string; html: string}`

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `src/lib/email.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { verifyEmailTemplate, resetEmailTemplate, sendEmail } from './email'

describe('sablonok', () => {
  beforeEach(() => { process.env.APP_URL = 'https://example.test' })
  afterEach(() => { delete process.env.APP_URL })

  it('verify-link a token-nel es az APP_URL-lel epul', () => {
    const { html } = verifyEmailTemplate('TOK123', 'en')
    expect(html).toContain('https://example.test/api/auth/verify?token=TOK123')
  })
  it('reset-link a reset-oldalra mutat', () => {
    const { html } = resetEmailTemplate('TOK456', 'en')
    expect(html).toContain('https://example.test/login?reset=TOK456')
  })
  it('a targy koveti a locale-t', () => {
    expect(verifyEmailTemplate('t', 'hu').subject).not.toBe(verifyEmailTemplate('t', 'en').subject)
  })
})

describe('sendEmail', () => {
  const saved = { key: process.env.RESEND_API_KEY, from: process.env.FROM_EMAIL }
  afterEach(() => {
    if (saved.key == null) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = saved.key
    if (saved.from == null) delete process.env.FROM_EMAIL; else process.env.FROM_EMAIL = saved.from
  })

  it('kulcs nelkul no-op, nem dob', async () => {
    delete process.env.RESEND_API_KEY
    const r = await sendEmail('a@b.c', 's', '<p>x</p>')
    expect(r.sent).toBe(false)
    expect(r.reason).toBe('RESEND_API_KEY nincs beallitva')
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/email.test.ts`
Expected: FAIL — nincs `./email` modul

- [ ] **Step 3: Írd meg az implementációt**

Create `src/lib/email.ts`:

```typescript
import { siteUrl } from './seo'

// Resend REST-en at, SDK nelkul — a repo mar igy kuld napi digestet.
// Kulcs nelkul no-op: a regisztracio mukodjon fejlesztes kozben is.
export async function sendEmail(
  to: string, subject: string, html: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('sendEmail kihagyva (nincs RESEND_API_KEY):', to, subject)
    return { sent: false, reason: 'RESEND_API_KEY nincs beallitva' }
  }
  const from = process.env.FROM_EMAIL ?? 'no-reply@anime-graph.app'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { sent: false, reason: `Resend ${res.status}` }
    return { sent: true }
  } catch (e) {
    console.error('sendEmail hiba:', e)
    return { sent: false, reason: 'halozati hiba' }
  }
}

function layout(title: string, body: string, cta: string, url: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
<p style="color:#444;line-height:1.5">${body}</p>
<p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${cta}</a></p>
<p style="color:#888;font-size:12px">${url}</p></div>`
}

export function verifyEmailTemplate(token: string, locale: string) {
  const url = `${siteUrl()}/api/auth/verify?token=${token}`
  return locale === 'hu'
    ? { subject: 'Erositsd meg az email-cimed — Anime Graph',
        html: layout('Erositsd meg az email-cimed', 'Kattints a gombra, es kesz. A link 24 oraig ervenyes.', 'Megerositem', url) }
    : { subject: 'Confirm your email — Anime Graph',
        html: layout('Confirm your email', 'Click the button below. The link is valid for 24 hours.', 'Confirm email', url) }
}

export function resetEmailTemplate(token: string, locale: string) {
  const url = `${siteUrl()}/login?reset=${token}`
  return locale === 'hu'
    ? { subject: 'Jelszo-visszaallitas — Anime Graph',
        html: layout('Jelszo-visszaallitas', 'A link 1 oraig ervenyes. Ha nem te kerted, hagyd figyelmen kivul.', 'Uj jelszo beallitasa', url) }
    : { subject: 'Password reset — Anime Graph',
        html: layout('Password reset', 'This link is valid for 1 hour. If you did not request it, ignore this email.', 'Set a new password', url) }
}
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/email.test.ts`
Expected: PASS, 4 teszt

- [ ] **Step 5: Commit**

```bash
git add src/lib/email.ts src/lib/email.test.ts
git commit -m "feat(auth): email-kuldes Resend REST-en + verify/reset sablonok"
```

---

## Task 4: Regisztráció-mód és validáció

**Files:**
- Create: `src/lib/registration.ts`, `src/lib/registration.test.ts`

**Interfaces:**
- Consumes: semmit
- Produces: `registrationMode(): 'open' | 'invite' | 'closed'`, `validateRegistration(input: {email: string; username: string; password: string}): {ok: true; email: string; username: string} | {ok: false; field: 'email'|'username'|'password'}`

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `src/lib/registration.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { registrationMode, validateRegistration } from './registration'

describe('registrationMode', () => {
  const saved = process.env.REGISTRATION_MODE
  afterEach(() => {
    if (saved == null) delete process.env.REGISTRATION_MODE; else process.env.REGISTRATION_MODE = saved
  })

  it('alapertelmezes: open', () => {
    delete process.env.REGISTRATION_MODE
    expect(registrationMode()).toBe('open')
  })
  it('ismert ertekek atmennek', () => {
    process.env.REGISTRATION_MODE = 'invite'
    expect(registrationMode()).toBe('invite')
    process.env.REGISTRATION_MODE = 'closed'
    expect(registrationMode()).toBe('closed')
  })
  it('ismeretlen ertek → closed (biztonsagos irany)', () => {
    process.env.REGISTRATION_MODE = 'banana'
    expect(registrationMode()).toBe('closed')
  })
})

describe('validateRegistration', () => {
  const ok = { email: 'Kacs@Example.COM', username: 'Kacs', password: 'nyolckar' }

  it('sikeres: email es username kisbetusitve', () => {
    expect(validateRegistration(ok)).toEqual({ ok: true, email: 'kacs@example.com', username: 'kacs' })
  })
  it('rossz email', () => {
    expect(validateRegistration({ ...ok, email: 'nememail' })).toEqual({ ok: false, field: 'email' })
  })
  it('rovid jelszo (7 karakter)', () => {
    expect(validateRegistration({ ...ok, password: '1234567' })).toEqual({ ok: false, field: 'password' })
  })
  it('8 karakteres jelszo mar jo', () => {
    expect(validateRegistration({ ...ok, password: '12345678' }).ok).toBe(true)
  })
  it('rossz username-minta', () => {
    expect(validateRegistration({ ...ok, username: 'ab' })).toEqual({ ok: false, field: 'username' })
    expect(validateRegistration({ ...ok, username: 'has space' })).toEqual({ ok: false, field: 'username' })
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/registration.test.ts`
Expected: FAIL — nincs `./registration` modul

- [ ] **Step 3: Írd meg az implementációt**

Create `src/lib/registration.ts`:

```typescript
export type RegistrationMode = 'open' | 'invite' | 'closed'

// Ismeretlen ertek eseten a biztonsagos irany a zarva — elgepelt env ne nyissa ki a kaput.
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
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/registration.test.ts`
Expected: PASS, 8 teszt

- [ ] **Step 5: Commit**

```bash
git add src/lib/registration.ts src/lib/registration.test.ts
git commit -m "feat(auth): REGISTRATION_MODE + regisztracio-validacio"
```

---

## Task 5: Session `tokenVersion`

**Files:**
- Create: `src/lib/token-version.ts`, `src/lib/token-version.test.ts`
- Modify: `src/lib/auth.ts`, `src/lib/session.ts`, `src/app/api/auth/route.ts`

**Interfaces:**
- Consumes: semmit
- Produces: `createSession(secret, userId, tokenVersion, days?)`, `verifySession(secret, token): Promise<{userId: number; tokenVersion: number; expiresAt: number} | null>`, `SESSION_DAYS`, `SESSION_RENEW_AFTER_MS`, `currentTokenVersion(userId: number): Promise<number>`, `clearTokenVersionCache(userId?: number): void`

**Fontos:** a session-formátum 3 részről 4 részre vált (`uid.exp.hmac` → `uid.ver.exp.hmac`). A régi tokenek érvénytelenné válnak, tehát **mindenki egyszer kilép**. A mai felhasználószám mellett ez elfogadható, és tudatos.

- [ ] **Step 1: Írd meg a bukó tesztet a session-formátumra**

Create `src/lib/auth.test.ts` (ha már létezik, egészítsd ki):

```typescript
import { describe, it, expect } from 'vitest'
import { createSession, verifySession } from './auth'

const SECRET = 'teszt-titok'

describe('session token', () => {
  it('korbe-jar: userId es tokenVersion visszajon', async () => {
    const t = await createSession(SECRET, 7, 3)
    expect(await verifySession(SECRET, t)).toMatchObject({ userId: 7, tokenVersion: 3 })
  })
  it('a lejarat idopontja is visszajon (a csuszo megujitashoz kell)', async () => {
    const before = Date.now()
    const claims = await verifySession(SECRET, await createSession(SECRET, 7, 0, 30))
    expect(claims!.expiresAt).toBeGreaterThan(before + 29 * 86400_000)
  })
  it('mas titokkal nem ervenyes', async () => {
    const t = await createSession(SECRET, 7, 3)
    expect(await verifySession('mas', t)).toBeNull()
  })
  it('regi 3-reszes formatum nem ervenyes', async () => {
    expect(await verifySession(SECRET, '7.9999999999999.abcdef')).toBeNull()
  })
  it('lejart token nem ervenyes', async () => {
    const t = await createSession(SECRET, 7, 0, -1)
    expect(await verifySession(SECRET, t)).toBeNull()
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: FAIL — a `verifySession` ma `number | null`-t ad, nem objektumot

- [ ] **Step 3: Írd át az `auth.ts`-t**

Modify `src/lib/auth.ts` — cseréld a `createSession` és `verifySession` függvényeket:

```typescript
// session token: "<userId>.<tokenVersion>.<expiryMs>.<hmac>" — edge-safe (Web Crypto only)
export async function createSession(
  secret: string, userId: number, tokenVersion: number, days = 30,
): Promise<string> {
  const exp = Date.now() + days * 86400_000
  const payload = `${userId}.${tokenVersion}.${exp}`
  return `${payload}.${await hmacHex(secret, payload)}`
}

export type SessionClaims = { userId: number; tokenVersion: number; expiresAt: number }

export async function verifySession(
  secret: string, token: string | undefined,
): Promise<SessionClaims | null> {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [uid, ver, exp, sig] = parts
  if ((await hmacHex(secret, `${uid}.${ver}.${exp}`)) !== sig) return null
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null
  const userId = Number(uid)
  const tokenVersion = Number(ver)
  if (!Number.isInteger(userId) || userId <= 0) return null
  if (!Number.isInteger(tokenVersion) || tokenVersion < 0) return null
  return { userId, tokenVersion, expiresAt: Number(exp) }
}

export const SESSION_DAYS = 30
/** a felezopont utan ujitunk: az aktiv user sosem esik ki, az inaktiv token lejar */
export const SESSION_RENEW_AFTER_MS = (SESSION_DAYS / 2) * 86400_000
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: PASS, 4 teszt

- [ ] **Step 5: Írd meg a `token-version` cache tesztjét**

Create `src/lib/token-version.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { __cacheForTest, clearTokenVersionCache, isCacheFresh } from './token-version'

describe('token-version cache', () => {
  beforeEach(() => clearTokenVersionCache())

  it('friss bejegyzest ujrahasznal', () => {
    const now = Date.now()
    expect(isCacheFresh({ version: 2, at: now - 30_000 }, now)).toBe(true)
  })
  it('60 masodpercnel regebbi bejegyzes elavult', () => {
    const now = Date.now()
    expect(isCacheFresh({ version: 2, at: now - 61_000 }, now)).toBe(false)
  })
  it('clearTokenVersionCache uriti a cache-t', () => {
    __cacheForTest.set(1, { version: 5, at: Date.now() })
    clearTokenVersionCache()
    expect(__cacheForTest.size).toBe(0)
  })
  it('egy userre celzott uritees csak azt viszi', () => {
    __cacheForTest.set(1, { version: 5, at: Date.now() })
    __cacheForTest.set(2, { version: 5, at: Date.now() })
    clearTokenVersionCache(1)
    expect(__cacheForTest.has(1)).toBe(false)
    expect(__cacheForTest.has(2)).toBe(true)
  })
})
```

- [ ] **Step 6: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/token-version.test.ts`
Expected: FAIL — nincs `./token-version` modul

- [ ] **Step 7: Írd meg a `token-version.ts`-t**

Create `src/lib/token-version.ts`:

```typescript
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { users } from '@/db/schema'

// Process-memorias cache: a token_version ellenorzese ne jelentsen adatbazis-kort
// minden keresen. Ara: egy ervenytelenitett session legfeljebb TTL_MS-ig meg el.
const TTL_MS = 60_000

type Entry = { version: number; at: number }
export const __cacheForTest = new Map<number, Entry>()

export function isCacheFresh(entry: Entry, now = Date.now()): boolean {
  return now - entry.at < TTL_MS
}

export function clearTokenVersionCache(userId?: number): void {
  if (userId == null) __cacheForTest.clear()
  else __cacheForTest.delete(userId)
}

export async function currentTokenVersion(userId: number): Promise<number> {
  const hit = __cacheForTest.get(userId)
  if (hit && isCacheFresh(hit)) return hit.version
  const [row] = await db.select({ v: users.tokenVersion }).from(users).where(eq(users.id, userId))
  const version = row?.v ?? 0
  __cacheForTest.set(userId, { version, at: Date.now() })
  return version
}
```

- [ ] **Step 8: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/token-version.test.ts`
Expected: PASS, 4 teszt

- [ ] **Step 9: Kösd be a `requireUserId`-be**

Modify `src/lib/session.ts` teljes tartalma:

```typescript
import { cookies } from 'next/headers'
import { verifySession } from './auth'
import { currentTokenVersion } from './token-version'

// route-oldali helper: a bejelentkezett user id-ja vagy null.
// A token_version egyeztetes miatt a jelszo-reset kilepteti a tobbi eszkozt.
export async function requireUserId(): Promise<number | null> {
  const token = (await cookies()).get('session')?.value
  const claims = await verifySession(process.env.SESSION_SECRET!, token)
  if (!claims) return null
  if ((await currentTokenVersion(claims.userId)) !== claims.tokenVersion) return null
  return claims.userId
}
```

- [ ] **Step 10: Igazítsd a middleware-t és a login-route-ot**

Modify `src/middleware.ts` — a `verifySession` most objektumot ad, és itt történik a **csúszó megújítás** is. A megújítás azért a middleware-ben van, mert csak itt tudunk egy központi helyen sütit írni minden válaszra; adatbázis nem kell hozzá, a meglévő claimeket írjuk alá új lejárattal.

```typescript
import { createSession, verifySession, SESSION_DAYS, SESSION_RENEW_AFTER_MS } from '@/lib/auth'

// ... a PUBLIC_PREFIXES-ellenorzes utan:
  const claims = await verifySession(
    process.env.SESSION_SECRET!,
    req.cookies.get('session')?.value,
  )
  if (claims) {
    const res = NextResponse.next()
    if (claims.expiresAt - Date.now() < SESSION_RENEW_AFTER_MS) {
      const fresh = await createSession(
        process.env.SESSION_SECRET!, claims.userId, claims.tokenVersion, SESSION_DAYS,
      )
      res.cookies.set('session', fresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * SESSION_DAYS,
        path: '/',
      })
    }
    return res
  }
```

A middleware szándékosan **nem** ellenőrzi a `token_version`-t: edge-en nincs adatbázis-olvasás. A védelem a route-oldali `requireUserId`-ben van. A megújítás csak a lejáratot tolja, a `tokenVersion`-t nem írja felül, tehát egy reset utáni régi token nem tud „örökre" megújulni: a `requireUserId` elutasítja.

Modify `src/app/api/auth/route.ts`:
- a `sessionResponse` `maxAge`-e `60 * 60 * 24 * 365` → `60 * 60 * 24 * 30`
- a token létrehozása: `await createSession(process.env.SESSION_SECRET!, user.id, user.tokenVersion)`

- [ ] **Step 11: Teljes ellenőrzés**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0`
Expected: minden zöld. Ha egy route `verifySession` visszatérésére számként hivatkozik, javítsd `claims.userId`-re.

- [ ] **Step 12: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts src/lib/session.ts src/lib/token-version.ts src/lib/token-version.test.ts src/middleware.ts src/app/api/auth/route.ts
git commit -m "feat(auth): tokenVersion a sessionben — jelszo-reset kilepteti a tobbi eszkozt"
```

---

## Task 6: Regisztráció-route átírása

**Files:**
- Modify: `src/app/api/auth/register/route.ts`

**Interfaces:**
- Consumes: `registrationMode()`, `validateRegistration()` (Task 4); `newToken()`, `hashToken()`, `tokenExpiry()` (Task 2); `sendEmail()`, `verifyEmailTemplate()` (Task 3); `createSession()` (Task 5)
- Produces: `POST /api/auth/register` — `{ok: true, username}` 200, hibák 400/403/409/429/503

- [ ] **Step 1: Írd át a route-ot**

Modify `src/app/api/auth/register/route.ts` teljes tartalma:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, authTokens } from '@/db/schema'
import { createSession } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { registrationMode, validateRegistration } from '@/lib/registration'
import { newToken, hashToken, tokenExpiry } from '@/lib/auth-token'
import { sendEmail, verifyEmailTemplate } from '@/lib/email'
import { eq, sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const mode = registrationMode()
  if (mode === 'closed') {
    return NextResponse.json({ error: 'A regisztracio jelenleg zarva' }, { status: 503 })
  }
  const body = await req.json().catch(() => ({}))
  const invite = String(body.invite ?? '')
  const locale = body.locale === 'hu' ? 'hu' : 'en'

  const ip = clientIp(req.headers)
  if (!(await rateLimit('register', ip, 5, 3600))) {
    return NextResponse.json({ error: 'Tul sok probalkozas — probald kesobb' }, { status: 429 })
  }

  if (mode === 'invite') {
    if (!process.env.INVITE_CODE) {
      return NextResponse.json({ error: 'A regisztracio zarva (nincs meghivo-kod beallitva)' }, { status: 503 })
    }
    if (invite !== process.env.INVITE_CODE) {
      return NextResponse.json({ error: 'Ervenytelen meghivo-kod' }, { status: 403 })
    }
  }

  const valid = validateRegistration({
    email: String(body.email ?? ''),
    username: String(body.username ?? ''),
    password: String(body.password ?? ''),
  })
  if (!valid.ok) {
    const msg = {
      email: 'Ervenytelen email-cim',
      username: 'Felhasznalonev: 3-24 karakter, kisbetu/szam/kotojel',
      password: 'A jelszo legalabb 8 karakter legyen',
    }[valid.field]
    return NextResponse.json({ error: msg, field: valid.field }, { status: 400 })
  }

  // email-alapu fek a cimenkenti fiokgyartas ellen
  if (!(await rateLimit('register-email', valid.email, 3, 3600))) {
    return NextResponse.json({ error: 'Tul sok probalkozas — probald kesobb' }, { status: 429 })
  }

  const [byName] = await db.select({ id: users.id }).from(users).where(eq(users.username, valid.username))
  if (byName) {
    return NextResponse.json({ error: 'Ez a felhasznalonev foglalt', field: 'username' }, { status: 409 })
  }
  const [byEmail] = await db.select({ id: users.id }).from(users)
    .where(sql`lower(${users.email}) = ${valid.email}`)
  if (byEmail) {
    return NextResponse.json({ error: 'Ezzel az emaillel mar van fiok', field: 'email' }, { status: 409 })
  }

  const [user] = await db.insert(users)
    .values({
      username: valid.username,
      email: valid.email,
      passwordHash: hashPassword(String(body.password)),
      locale,
    })
    .returning()

  // megerosito token: nyersen csak a linkbe kerul, adatbazisba a hash megy
  const raw = newToken()
  await db.insert(authTokens).values({
    userId: user.id,
    kind: 'verify',
    tokenHash: hashToken(raw),
    expiresAt: tokenExpiry('verify'),
  })
  const mail = verifyEmailTemplate(raw, locale)
  await sendEmail(valid.email, mail.subject, mail.html)

  const token = await createSession(process.env.SESSION_SECRET!, user.id, user.tokenVersion)
  const res = NextResponse.json({ ok: true, username: user.username })
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
```

- [ ] **Step 2: Ellenőrzés**

Run: `npx tsc --noEmit && npx eslint src --max-warnings=0`
Expected: exit 0 mindkettőnél

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/register/route.ts
git commit -m "feat(auth): nyilt regisztracio email-lel es megerosito levellel"
```

---

## Task 7: Verify, resend, forgot, reset végpontok

**Files:**
- Create: `src/app/api/auth/verify/route.ts`, `src/app/api/auth/verify/resend/route.ts`, `src/app/api/auth/forgot/route.ts`, `src/app/api/auth/reset/route.ts`
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: Task 2, 3, 5 exportjai; `requireUserId()`
- Produces: négy végpont; a `reset` növeli a `users.token_version`-t

- [ ] **Step 1: Verify-végpont**

Create `src/app/api/auth/verify/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, authTokens } from '@/db/schema'
import { hashToken, isTokenUsable } from '@/lib/auth-token'
import { and, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('token') ?? ''
  const [row] = await db.select().from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(raw)), eq(authTokens.kind, 'verify')))
  if (!row || !isTokenUsable(row)) {
    return NextResponse.redirect(new URL('/beallitasok?verify=invalid', req.url))
  }
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId))
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id))
  return NextResponse.redirect(new URL('/?verify=ok', req.url))
}
```

- [ ] **Step 2: Resend-végpont**

Create `src/app/api/auth/verify/resend/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, authTokens } from '@/db/schema'
import { requireUserId } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { newToken, hashToken, tokenExpiry } from '@/lib/auth-token'
import { sendEmail, verifyEmailTemplate } from '@/lib/email'
import { eq } from 'drizzle-orm'

export async function POST() {
  const userId = await requireUserId()
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await rateLimit('verify-resend', String(userId), 3, 3600))) {
    return NextResponse.json({ error: 'Tul sok probalkozas — probald kesobb' }, { status: 429 })
  }
  const [user] = await db.select().from(users).where(eq(users.id, userId))
  if (!user?.email) return NextResponse.json({ error: 'Nincs email a fiokon' }, { status: 400 })
  if (user.emailVerifiedAt) return NextResponse.json({ ok: true, already: true })

  const raw = newToken()
  await db.insert(authTokens).values({
    userId, kind: 'verify', tokenHash: hashToken(raw), expiresAt: tokenExpiry('verify'),
  })
  const mail = verifyEmailTemplate(raw, user.locale)
  await sendEmail(user.email, mail.subject, mail.html)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Forgot-végpont**

Create `src/app/api/auth/forgot/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, authTokens } from '@/db/schema'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { newToken, hashToken, tokenExpiry } from '@/lib/auth-token'
import { sendEmail, resetEmailTemplate } from '@/lib/email'
import { sql } from 'drizzle-orm'

// MINDIG 200-at ad, letezo es nem letezo cimre egyarant:
// kulonben a vegpont elarulna, ki regisztralt nalunk.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()

  await rateLimit('forgot-ip', clientIp(req.headers), 10, 3600)
  const allowed = await rateLimit('forgot-email', email, 3, 3600)

  if (allowed && email) {
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`)
    if (user) {
      const raw = newToken()
      await db.insert(authTokens).values({
        userId: user.id, kind: 'reset', tokenHash: hashToken(raw), expiresAt: tokenExpiry('reset'),
      })
      const mail = resetEmailTemplate(raw, user.locale)
      await sendEmail(email, mail.subject, mail.html)
    }
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Reset-végpont**

Create `src/app/api/auth/reset/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users, authTokens } from '@/db/schema'
import { hashToken, isTokenUsable } from '@/lib/auth-token'
import { hashPassword } from '@/lib/password'
import { createSession } from '@/lib/auth'
import { clearTokenVersionCache } from '@/lib/token-version'
import { MIN_PASSWORD_LENGTH } from '@/lib/registration'
import { and, eq, sql } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const raw = String(body.token ?? '')
  const password = String(body.password ?? '')
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: 'A jelszo legalabb 8 karakter legyen' }, { status: 400 })
  }
  const [row] = await db.select().from(authTokens)
    .where(and(eq(authTokens.tokenHash, hashToken(raw)), eq(authTokens.kind, 'reset')))
  if (!row || !isTokenUsable(row)) {
    return NextResponse.json({ error: 'Ervenytelen vagy lejart link' }, { status: 400 })
  }

  // token_version++ → minden korabbi session ervenytelen
  const [user] = await db.update(users)
    .set({ passwordHash: hashPassword(password), tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, row.userId))
    .returning()
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, row.id))
  clearTokenVersionCache(user.id)

  const token = await createSession(process.env.SESSION_SECRET!, user.id, user.tokenVersion)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
```

- [ ] **Step 5: Nyisd meg a végpontokat a middleware-ben**

Modify `src/middleware.ts` — a `PUBLIC_PREFIXES` tömbben az `'/api/auth'` bejegyzés már lefedi az összes `/api/auth/*` útvonalat (prefix-egyezés), tehát **nincs teendő**. Ellenőrizd `Grep`-pel, hogy tényleg ott van; ha csak `'/api/auth'` pontos egyezésként szerepelne, cseréld `'/api/auth'`-ra prefixként.

- [ ] **Step 6: Ellenőrzés**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0`
Expected: minden zöld

- [ ] **Step 7: Commit**

```bash
git add src/app/api/auth/verify src/app/api/auth/forgot src/app/api/auth/reset src/middleware.ts
git commit -m "feat(auth): verify, resend, forgot es reset vegpontok"
```

---

## Task 8: Login-oldal és email-bekérő sáv

**Files:**
- Create: `src/components/EmailPrompt.tsx`
- Modify: `src/app/login/page.tsx`, `src/app/api/settings/route.ts`, `src/app/beallitasok/page.tsx`

**Interfaces:**
- Consumes: `/api/auth/forgot`, `/api/auth/reset`; `validateRegistration()` (Task 4); `newToken()`, `hashToken()`, `tokenExpiry()` (Task 2); `sendEmail()`, `verifyEmailTemplate()` (Task 3)
- Produces: felhasználói folyamat; a `?reset=<token>` query a reset-űrlapot nyitja; a `GET /api/settings` visszaad `email`-t, a `PUT` elfogad `{email}`-t

- [ ] **Step 1: Olvasd el a jelenlegi oldalt**

Run: `cat src/app/login/page.tsx`

Jegyezd fel a meglévő fül-váltó szerkezetet (belépés/regisztráció) és a használt osztályneveket (`glass`, `btn-ghost`, `label-mono`), hogy az új rész illeszkedjen.

- [ ] **Step 2: Egészítsd ki az oldalt**

A regisztráció-űrlaphoz vegyél fel egy `email` mezőt (kötelező, `type="email"`), és a POST-ba küldd `email`-ként.

Adj hozzá egy harmadik állapotot:
- „Elfelejtettem a jelszavam" link a belépés-fül alatt → email-mező + gomb → `POST /api/auth/forgot` → **mindig** ugyanaz a visszajelzés: „Ha van ilyen fiók, elküldtük a linket."
- Ha az URL-ben van `?reset=<token>`, akkor a reset-űrlap jelenjen meg (új jelszó + megerősítés) → `POST /api/auth/reset` `{token, password}` → siker esetén `router.push('/')`.

- [ ] **Step 3: Email-bekérő sáv a régi fióknak**

A meglévő `id=1` felhasználónak nincs email-címe, tehát nincs jelszó-visszaállítása sem. Kell egy sáv, ami ezt bekéri.

Create `src/components/EmailPrompt.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'

// A regi, email nelkuli fiokoknak: enelkul nincs jelszo-visszaallitasuk.
export default function EmailPrompt() {
  const [needed, setNeeded] = useState(false)
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setNeeded(j != null && !j.email))
      .catch(() => {})
  }, [])

  if (!needed || done) return null
  return (
    <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3 text-sm">
      <span className="text-text-2">Nincs email a fiókodon, így nincs jelszó-visszaállításod.</span>
      <input
        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="email@pelda.hu"
        className="glass rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[200px]"
      />
      <button
        className="btn-ghost border border-white/10 px-3.5 py-1.5 text-xs"
        onClick={async () => {
          const r = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          })
          if (r.ok) setDone(true)
        }}
      >Mentés</button>
    </div>
  )
}
```

Modify `src/app/api/settings/route.ts` — a `GET` válaszába vedd fel az `email: user?.email ?? null` mezőt, a `PUT`-ba pedig:

```typescript
  if (typeof body.email === 'string') {
    const valid = validateRegistration({ email: body.email, username: 'placeholder', password: '12345678' })
    if (!valid.ok) return NextResponse.json({ error: 'Ervenytelen email-cim' }, { status: 400 })
    const [dup] = await db.select({ id: users.id }).from(users)
      .where(sql`lower(${users.email}) = ${valid.email}`)
    if (dup && dup.id !== userId) {
      return NextResponse.json({ error: 'Ezzel az emaillel mar van fiok' }, { status: 409 })
    }
    await db.update(users).set({ email: valid.email, emailVerifiedAt: null }).where(eq(users.id, userId))
    const raw = newToken()
    await db.insert(authTokens).values({
      userId, kind: 'verify', tokenHash: hashToken(raw), expiresAt: tokenExpiry('verify'),
    })
    const mail = verifyEmailTemplate(raw, body.locale === 'hu' ? 'hu' : 'en')
    await sendEmail(valid.email, mail.subject, mail.html)
  }
```

Modify `src/app/beallitasok/page.tsx` — az oldal tetejére `<EmailPrompt />`.

- [ ] **Step 4: Ellenőrzés**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0`
Expected: minden zöld

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/components/EmailPrompt.tsx src/app/api/settings/route.ts src/app/beallitasok/page.tsx
git commit -m "feat(auth): login-oldal reset-urlap + email-bekero sav a regi fioknak"
```

---

## Task 9: 1. szakasz zárása — prod-build smoke

**Files:** nincs új fájl

- [ ] **Step 1: Állítsd le a dev-szervert**

A `next build` és a `next dev` közös `.next`-et használ, együtt futva a build eltörik.

Run: `Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`

- [ ] **Step 2: Teljes ellenőrzés**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0 && npm run build`
Expected: minden zöld

- [ ] **Step 3: Prod-smoke**

Run: `npm run start` (háttérben), majd:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
curl -s -X POST http://localhost:3000/api/auth/forgot -H "Content-Type: application/json" -d '{"email":"nincs-ilyen@example.test"}'
```

Expected: `/login` → 200; a `forgot` → `{"ok":true}` (nem létező címre is, ez a lényeg)

- [ ] **Step 4: Commit, ha bármit javítani kellett**

```bash
git add -A
git commit -m "fix(auth): prod-build smoke javitasok"
```

---

# 2. SZAKASZ — I18N

> Ez a szakasz **félbehagyható**: a még át nem vezetett fájlok magyarul maradnak, az app végig működik és a tesztek zöldek.

## Task 10: next-intl beállítás és locale-feloldás

**Files:**
- Create: `src/lib/locale.ts`, `src/lib/locale.test.ts`, `src/i18n/request.ts`, `messages/en.json`, `messages/hu.json`
- Modify: `next.config.ts`, `src/app/layout.tsx`, `package.json`

**Interfaces:**
- Consumes: semmit
- Produces: `type Locale = 'en' | 'hu'`, `LOCALES`, `DEFAULT_LOCALE`, `resolveLocale(input: {cookie?: string|null; userLocale?: string|null; acceptLanguage?: string|null}): Locale`

- [ ] **Step 1: Telepítsd a next-intl-t**

Run: `npm install next-intl`

- [ ] **Step 2: Írd meg a bukó tesztet**

Create `src/lib/locale.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveLocale, DEFAULT_LOCALE } from './locale'

describe('resolveLocale', () => {
  it('alapertelmezes angol', () => {
    expect(resolveLocale({})).toBe('en')
    expect(DEFAULT_LOCALE).toBe('en')
  })
  it('a user beallitasa eros a cookie-nal', () => {
    expect(resolveLocale({ cookie: 'en', userLocale: 'hu' })).toBe('hu')
  })
  it('user nelkul a cookie dont', () => {
    expect(resolveLocale({ cookie: 'hu' })).toBe('hu')
  })
  it('cookie nelkul az Accept-Language dont', () => {
    expect(resolveLocale({ acceptLanguage: 'hu-HU,hu;q=0.9,en;q=0.8' })).toBe('hu')
  })
  it('ismeretlen nyelv → angol', () => {
    expect(resolveLocale({ cookie: 'de' })).toBe('en')
    expect(resolveLocale({ acceptLanguage: 'de-DE,de;q=0.9' })).toBe('en')
  })
})
```

- [ ] **Step 3: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/locale.test.ts`
Expected: FAIL — nincs `./locale` modul

- [ ] **Step 4: Írd meg a `locale.ts`-t**

Create `src/lib/locale.ts`:

```typescript
export const LOCALES = ['en', 'hu'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

function asLocale(v: string | null | undefined): Locale | null {
  return v && (LOCALES as readonly string[]).includes(v) ? (v as Locale) : null
}

// Sorrend: bejelentkezett user beallitasa > cookie > Accept-Language > angol.
// A user-beallitas azert eros, mert az eszkozok kozott is kovetni kell.
export function resolveLocale(input: {
  cookie?: string | null
  userLocale?: string | null
  acceptLanguage?: string | null
}): Locale {
  const fromUser = asLocale(input.userLocale)
  if (fromUser) return fromUser
  const fromCookie = asLocale(input.cookie)
  if (fromCookie) return fromCookie
  for (const part of (input.acceptLanguage ?? '').split(',')) {
    const tag = part.split(';')[0].trim().split('-')[0]
    const hit = asLocale(tag)
    if (hit) return hit
  }
  return DEFAULT_LOCALE
}
```

- [ ] **Step 5: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/locale.test.ts`
Expected: PASS, 5 teszt

- [ ] **Step 6: next-intl konfiguráció**

Create `src/i18n/request.ts`:

```typescript
import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { resolveLocale, LOCALE_COOKIE } from '@/lib/locale'

// "Usage without i18n routing": a locale cookie-bol jon, az URL valtozatlan marad.
export default getRequestConfig(async () => {
  const locale = resolveLocale({
    cookie: (await cookies()).get(LOCALE_COOKIE)?.value,
    acceptLanguage: (await headers()).get('accept-language'),
  })
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default }
})
```

Create `messages/en.json` és `messages/hu.json` kezdő tartalommal:

```json
{ "nav": { "news": "News", "graph": "Graph", "list": "My list" } }
```

```json
{ "nav": { "news": "Hírek", "graph": "Gráf", "list": "Listám" } }
```

Modify `next.config.ts` — csomagold be a meglévő configot:

```typescript
import createNextIntlPlugin from 'next-intl/plugin'
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')
// ... a meglevo nextConfig valtozatlan ...
export default withNextIntl(nextConfig)
```

Modify `src/app/layout.tsx` — a `<body>` tartalmát burkold be:

```tsx
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

// a RootLayout-ban:
const locale = await getLocale()
const messages = await getMessages()
// <html lang={locale}> ... <body><NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider></body>
```

- [ ] **Step 7: Ellenőrzés**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: minden zöld

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json next.config.ts src/i18n src/lib/locale.ts src/lib/locale.test.ts src/app/layout.tsx messages
git commit -m "feat(i18n): next-intl routing nelkul, cookie-alapu locale"
```

---

## Task 11: Nyelvváltó és `users.locale` mentés

**Files:**
- Create: `src/components/LocaleSwitcher.tsx`
- Modify: `src/components/TopNav.tsx`, `src/app/api/settings/route.ts`, `src/app/beallitasok/page.tsx`

**Interfaces:**
- Consumes: `LOCALE_COOKIE`, `LOCALES` (Task 10)
- Produces: `<LocaleSwitcher />`; a `PUT /api/settings` elfogad `{locale: 'en'|'hu'}`-t

- [ ] **Step 1: Nyelvváltó komponens**

Create `src/components/LocaleSwitcher.tsx`:

```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { LOCALES, LOCALE_COOKIE } from '@/lib/locale'

export default function LocaleSwitcher() {
  const router = useRouter()
  const current = useLocale()

  async function pick(next: string) {
    // 1 ev, hogy a valasztas tullelje a sessiont; belepve a DB is orzi
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {}) // anonim latogatonal 401 — a cookie akkor is all
    router.refresh()
  }

  return (
    <div className="flex gap-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => pick(l)}
          className={`px-2 py-1 text-xs font-mono rounded ${l === current ? 'text-text-1' : 'text-text-3 hover:text-text-2'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Kösd be a TopNav-ba és a Beállításokba**

Modify `src/components/TopNav.tsx` — a jobb szélre `<LocaleSwitcher />`.
Modify `src/app/beallitasok/page.tsx` — egy „Nyelv / Language" szekcióba ugyanaz.

- [ ] **Step 3: Fogadd a `locale`-t a settings-route-ban**

Modify `src/app/api/settings/route.ts` — a `PUT` törzsébe:

```typescript
  if (body.locale === 'en' || body.locale === 'hu') {
    await db.update(users).set({ locale: body.locale }).where(eq(users.id, userId))
  }
```

(Importáld a `users`-t és az `eq`-t, ha még nincs.)

- [ ] **Step 4: Ellenőrzés**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0`
Expected: minden zöld

- [ ] **Step 5: Commit**

```bash
git add src/components/LocaleSwitcher.tsx src/components/TopNav.tsx src/app/beallitasok/page.tsx src/app/api/settings/route.ts
git commit -m "feat(i18n): nyelvvalto a TopNavban es a Beallitasokon, users.locale mentes"
```

---

## Task 12: Szöveg-átvezetés fájlonként

**Files:** 41 `.tsx` + 38 API-route (lista alább)

**Interfaces:**
- Consumes: `useTranslations` (kliens), `getTranslations` (szerver)
- Produces: bővülő `messages/en.json` és `messages/hu.json`

**A recept — minden fájlra ugyanez:**

1. Nyisd meg a fájlt, keresd meg a magyar stringeket: `rg "[áéíóöőúüű]" <fájl>`
2. Válassz namespace-t a fájl neve alapján (`TopNav.tsx` → `nav`, `WrappedStory.tsx` → `wrapped`, `api/auth/route.ts` → `errors.auth`)
3. Minden stringhez képezz kulcsot **az angol jelentésből**, `camelCase`-ben (`"Túl sok próbálkozás"` → `tooManyAttempts`)
4. Írd be a magyar szöveget a `messages/hu.json`-be, az angol fordítást a `messages/en.json`-be, ugyanarra a kulcsra
5. Kliens-komponensben: `const t = useTranslations('nav')`, majd `{t('news')}`. Szerver-komponensben: `const t = await getTranslations('nav')`
6. Interpolációhoz `{"greeting": "Hi {name}"}` és `t('greeting', {name})`
7. `npx tsc --noEmit` és `npm test`
8. **Commit — egy fájl, egy commit:** `git commit -m "i18n(<fájlnév>): szoveg-atvezetes"`

**Kidolgozott példa — `src/components/CompatChip.tsx`:**

Előtte:

```tsx
<span className="label-mono">Egyezés</span>
<p className="text-xs text-text-3">a közös címek alapján</p>
```

`messages/hu.json`:

```json
{ "compat": { "match": "Egyezés", "basedOnShared": "a közös címek alapján" } }
```

`messages/en.json`:

```json
{ "compat": { "match": "Match", "basedOnShared": "based on shared titles" } }
```

Utána:

```tsx
'use client'
import { useTranslations } from 'next-intl'
// ...
const t = useTranslations('compat')
// ...
<span className="label-mono">{t('match')}</span>
<p className="text-xs text-text-3">{t('basedOnShared')}</p>
```

**A 41 `.tsx` fájl** (sorrend: kicsitől a nagyig, hogy a minta korán beálljon):

`MediaCard` · `StreamLinks` · `ThemesPlayer` · `layout` · `PinnedShowcase` · `p/[token]/page` · `CompatChip` · `PushToggle` · `Graph3D` · `WrappedCard` · `anime/preview/[anilistId]/page` · `TopNav` · `PreviewAddButtons` · `HierarchyPanel` · `RecommendMorph` · `SeasonFilterBar` · `TourSpotlight` · `login/page` · `OnboardingCTA` · `FitBadge` · `ProfileReveal` · `TasteCard` · `TonightPicker` · `AddAnimeSearch` · `SyncAccounts` · `CatalogTitlePage` · `toplista/page` · `vibe/page` · `CharacterGrid` · `velemenyek/page` · `lista/page` · `wrapped/page` · `stats/page` · `graf/page` · `WrappedStory` · `OwnerOverlay` · `beallitasok/page` · `vs/page` · `bongeszo/page` · `page` · `onboarding/page`

**A 38 API-route:** a `errors.<terület>` namespace alá. A pontos lista bármikor előállítható:

```bash
rg -l "[áéíóöőúüű]" src/app/api --glob "*.ts"
```

- [ ] **Step 1: Vezesd át a fenti listát fájlonként, a recept szerint, fájlonkénti commitokkal**

- [ ] **Step 2: Záró ellenőrzés a lista végén**

Run: `rg -c "[áéíóöőúüű]" src --glob "*.tsx" --glob "*.ts" | rg -v "\.test\.|messages/"`
Expected: nincs találat (a teszt-fájlok és a `hu.json` kivételével)

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: minden zöld

---

## Task 13: AI-promptok locale-paramétere

**Files:**
- Modify: `src/lib/recommend.ts`, `src/lib/vibe.ts`, `src/lib/profile.ts`, `src/lib/evolution.ts`, `src/lib/seasonal.ts`, `src/lib/duo.ts`, `src/lib/extract.ts`, `src/lib/nl-search.ts` és a hozzájuk tartozó route-ok

**Interfaces:**
- Consumes: `Locale` (Task 10)
- Produces: minden érintett prompt-építő függvény új, **kötelező** `locale: Locale` paramétert kap

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `src/lib/prompt-locale.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { languageInstruction } from './prompt-locale'

describe('languageInstruction', () => {
  it('magyar utasitast ad hu-ra', () => {
    expect(languageInstruction('hu')).toContain('magyarul')
  })
  it('angol utasitast ad en-re', () => {
    expect(languageInstruction('en')).toContain('English')
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/prompt-locale.test.ts`
Expected: FAIL — nincs `./prompt-locale` modul

- [ ] **Step 3: Írd meg a közös segédet**

Create `src/lib/prompt-locale.ts`:

```typescript
import type { Locale } from './locale'

// Egy helyen dol el, milyen nyelven valaszoljon a modell — a 9 prompt ezt hasznalja.
export function languageInstruction(locale: Locale): string {
  return locale === 'hu'
    ? 'Valaszolj magyarul, termeszetes, tomor stilusban.'
    : 'Answer in English, in a natural and concise style.'
}
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/prompt-locale.test.ts`
Expected: PASS, 2 teszt

- [ ] **Step 5: Vezesd át a 9 helyet**

A pontos lista (`rg -n "magyar" src/lib src/app/api` adja vissza):

`src/lib/recommend.ts` · `src/lib/vibe.ts` · `src/lib/profile.ts` · `src/lib/evolution.ts` · `src/lib/seasonal.ts` · `src/lib/duo.ts` · `src/lib/extract.ts` · `src/lib/nl-search.ts` · `src/app/api/digest/route.ts:60`

Mindegyikben: a prompt-építő függvény kapjon `locale: Locale` paramétert, és a hardcode-olt magyar mondat helyére kerüljön `languageInstruction(locale)`. A hívó route-ok a bejelentkezett felhasználó `users.locale` mezőjéből adják át.

**Kidolgozott példa — `src/lib/recommend.ts`:**

Előtte:

```typescript
export function buildRecommendPrompt(facts: string[], candidates: Candidate[]): string {
  return `... Indokold meg magyarul, egy-két mondatban, miért illik hozzá.`
}
```

Utána:

```typescript
import type { Locale } from './locale'
import { languageInstruction } from './prompt-locale'

export function buildRecommendPrompt(
  facts: string[], candidates: Candidate[], locale: Locale,
): string {
  return `... ${languageInstruction(locale)}`
}
```

A hívó route-ban:

```typescript
const [user] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId))
const prompt = buildRecommendPrompt(facts, candidates, (user?.locale ?? 'en') as Locale)
```

Az `extract.ts` külön eset: az általa kinyert ízlés-tények beírásakor a `taste_memory.lang` oszlopba is kerüljön a locale:

```typescript
await db.insert(tasteMemory).values(facts.map((f) => ({ ...f, userId, lang: locale })))
```

- [ ] **Step 6: Ellenőrzés**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0`
Expected: minden zöld. A `tsc` megmutatja, ha egy hívó lemaradt a paraméterről.

- [ ] **Step 7: Commit**

```bash
git add src/lib/prompt-locale.ts src/lib/prompt-locale.test.ts src/lib
git commit -m "feat(i18n): AI-promptok locale-parametere, taste_memory.lang irasa"
```

---

## Task 14: Locale az AI-cache kulcsokban

**Files:**
- Modify: `src/lib/seasonal.ts`, `src/app/api/recommend/route.ts`, `src/app/api/vibe/route.ts`, `src/app/api/profile/route.ts`, `src/app/api/taste/eras/route.ts`, `src/app/api/digest/route.ts`, `src/app/api/recommend/duo/route.ts`

**Interfaces:**
- Consumes: `Locale`
- Produces: a `recommendations.kind` és az `api_cache` kulcsok locale-lal bővülnek

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `src/lib/ai-cache-key.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { aiCacheKind } from './ai-cache-key'

describe('aiCacheKind', () => {
  it('a locale bekerul a kulcsba', () => {
    expect(aiCacheKind('recommend', 'hu')).toBe('recommend:hu')
    expect(aiCacheKind('recommend', 'en')).toBe('recommend:en')
  })
  it('ket nyelv kulcsa kulonbozik', () => {
    expect(aiCacheKind('seasonal-ai:2026-SUMMER', 'hu'))
      .not.toBe(aiCacheKind('seasonal-ai:2026-SUMMER', 'en'))
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/ai-cache-key.test.ts`
Expected: FAIL — nincs `./ai-cache-key` modul

- [ ] **Step 3: Írd meg**

Create `src/lib/ai-cache-key.ts`:

```typescript
import type { Locale } from './locale'

// Az AI-valaszok nyelvfuggok: a locale nelkul a nyelvvaltas utan
// a felhasznalo a regi nyelvu, cache-elt valaszt kapna vissza.
export function aiCacheKind(base: string, locale: Locale): string {
  return `${base}:${locale}`
}
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/ai-cache-key.test.ts`
Expected: PASS, 2 teszt

- [ ] **Step 5: Vezesd át a hívókat**

Minden `kind: 'recommend'` / `'vibe'` / `'profile'` / `'taste-eras'` / `'digest'` / `'duo'` írásnál és olvasásnál használd az `aiCacheKind(...)`-ot. Az `api_cache` `seasonal-ai:<év>-<szezon>` kulcsánál ugyanígy.

A régi, locale nélküli sorok egyszerűen sosem találnak el — nem kell törölni őket, lejárnak.

- [ ] **Step 6: Ellenőrzés és commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add src/lib/ai-cache-key.ts src/lib/ai-cache-key.test.ts src/lib src/app/api
git commit -m "fix(i18n): locale az AI-cache kulcsokban — nyelvvaltas utan nincs rossz nyelvu valasz"
```

---

# 3. SZAKASZ — PROFIL

## Task 15: Monogram-avatar

**Files:**
- Create: `src/lib/avatar.ts`, `src/lib/avatar.test.ts`, `src/components/Avatar.tsx`

**Interfaces:**
- Consumes: semmit
- Produces: `avatarInitials(username: string): string`, `avatarHue(username: string): number`, `<Avatar username={string} size?={number} />`

- [ ] **Step 1: Írd meg a bukó tesztet**

Create `src/lib/avatar.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { avatarInitials, avatarHue } from './avatar'

describe('avatarInitials', () => {
  it('egyszavas nevbol az elso ket betu, nagybetuvel', () => {
    expect(avatarInitials('kacs')).toBe('KA')
  })
  it('elvalasztott nevbol ket kezdobetu', () => {
    expect(avatarInitials('anime_graph')).toBe('AG')
    expect(avatarInitials('anime-graph')).toBe('AG')
  })
  it('egykarakteres nev', () => {
    expect(avatarInitials('k')).toBe('K')
  })
  it('ures nev nem dob', () => {
    expect(avatarInitials('')).toBe('?')
  })
})

describe('avatarHue', () => {
  it('determinisztikus', () => {
    expect(avatarHue('kacs')).toBe(avatarHue('kacs'))
  })
  it('0 es 359 kozott van', () => {
    for (const n of ['a', 'kacs', 'anime-graph', 'zzz']) {
      expect(avatarHue(n)).toBeGreaterThanOrEqual(0)
      expect(avatarHue(n)).toBeLessThan(360)
    }
  })
})
```

- [ ] **Step 2: Futtasd, hogy bukjon**

Run: `npx vitest run src/lib/avatar.test.ts`
Expected: FAIL — nincs `./avatar` modul

- [ ] **Step 3: Írd meg**

Create `src/lib/avatar.ts`:

```typescript
// Nincs kepfeltoltes: az avatar a felhasznalonevbol szarmazik, igy nem kell
// tarolo es nem kell moderalni sem.
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
```

- [ ] **Step 4: Futtasd, hogy átmenjen**

Run: `npx vitest run src/lib/avatar.test.ts`
Expected: PASS, 6 teszt

- [ ] **Step 5: Komponens**

Create `src/components/Avatar.tsx`:

```tsx
import { avatarInitials, avatarHue } from '@/lib/avatar'

export default function Avatar({ username, size = 48 }: { username: string; size?: number }) {
  const hue = avatarHue(username)
  return (
    <div
      className="rounded-full grid place-items-center font-semibold shrink-0 border border-white/10"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: `linear-gradient(140deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 55% 18%))`,
      }}
      aria-hidden
    >
      {avatarInitials(username)}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/avatar.ts src/lib/avatar.test.ts src/components/Avatar.tsx
git commit -m "feat(profil): monogram-avatar nevbol generalt szinnel"
```

---

## Task 16: Bio és profil-láthatóság a Beállításokon

**Files:**
- Modify: `src/app/api/settings/route.ts`, `src/app/beallitasok/page.tsx`

**Interfaces:**
- Consumes: `requireUserId()`
- Produces: `PUT /api/settings` elfogad `{bio: string}`-ot és `{profileVisibility: 'public'|'private'}`-t; a `GET` visszaadja mindkettőt

- [ ] **Step 1: Bővítsd a settings-route-ot**

Modify `src/app/api/settings/route.ts`:

A `GET` válaszába:

```typescript
    bio: user?.bio ?? '',
    profileVisibility: map.profileVisibility ?? 'public',
```

(A `user` sort a `users` táblából olvasd ki `requireUserId()` alapján.)

A `PUT` törzsébe:

```typescript
  if (typeof body.bio === 'string') {
    await db.update(users).set({ bio: body.bio.slice(0, 500) }).where(eq(users.id, userId))
  }
  if (body.profileVisibility === 'public' || body.profileVisibility === 'private') {
    await upsert(userId, 'profileVisibility', body.profileVisibility)
  }
```

- [ ] **Step 2: Bővítsd a Beállítások oldalt**

Modify `src/app/beallitasok/page.tsx` — új „Profil" szekció: bio-textarea (500 karakter, számláló), láthatóság-kapcsoló, és a profil linkje (`/u/<username>`).

- [ ] **Step 3: Ellenőrzés és commit**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0`

```bash
git add src/app/api/settings/route.ts src/app/beallitasok/page.tsx
git commit -m "feat(profil): bio es lathatosag-kapcsolo a Beallitasokon"
```

---

## Task 17: `/u/[username]` publikus profil

**Files:**
- Create: `src/app/u/[username]/page.tsx`
- Modify: `src/middleware.ts`

**Interfaces:**
- Consumes: `<Avatar />` (Task 15); `PinnedShowcase` és `toPublicPinned(titles, chars)` (meglévők); `dbStatic`
- Produces: publikus profil-oldal

**A `CompatChip` szándékosan kimarad:** a props-a `token: string`, és a `/api/compat?token=` végpontot hívja, tehát a megosztó-linkes `/p` nézethez van kötve. Felhasználónév-alapú kompatibilitáshoz az API-t is bővíteni kellene — az a C-kör (follow) dolga, nem ezé.

- [ ] **Step 1: Nyisd meg az útvonalat**

Modify `src/middleware.ts` — a `PUBLIC_PREFIXES` tömbbe: `'/u/'`

- [ ] **Step 2: Írd meg az oldalt**

Create `src/app/u/[username]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { eq, inArray } from 'drizzle-orm'
import { dbStatic } from '@/db/client'
import { users, settings, title as titleTable, favoriteCharacters } from '@/db/schema'
import { toPublicPinned } from '@/lib/public-view'
import PinnedShowcase from '@/components/PinnedShowcase'
import Avatar from '@/components/Avatar'

export const dynamic = 'force-dynamic'

// A pinnedTitles kulcs title.id-kat tarol, a pinnedChars favorite_characters.char_id-kat
// (lasd src/app/api/pins/route.ts) — ugyanazt a ket listat olvassuk ki itt is.
async function load(username: string) {
  const [user] = await dbStatic.select().from(users).where(eq(users.username, username.toLowerCase()))
  if (!user) return null
  const rows = await dbStatic.select().from(settings).where(eq(settings.userId, user.id))
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const ids = (key: string) =>
    Array.isArray(map[key]) ? (map[key] as number[]).filter((n) => Number.isInteger(n)) : []

  const titleIds = ids('pinnedTitles')
  const charIds = ids('pinnedChars')
  const titles = titleIds.length
    ? await dbStatic.select({
        titleRomaji: titleTable.titleRomaji, coverUrl: titleTable.coverUrl,
        slug: titleTable.slug, mediaType: titleTable.mediaType,
      }).from(titleTable).where(inArray(titleTable.id, titleIds))
    : []
  const chars = charIds.length
    ? await dbStatic.select({ name: favoriteCharacters.name, image: favoriteCharacters.image })
        .from(favoriteCharacters).where(inArray(favoriteCharacters.charId, charIds))
    : []

  return {
    user,
    visibility: (map.profileVisibility as string) ?? 'public',
    pinned: toPublicPinned(titles, chars),
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> },
): Promise<Metadata> {
  const { username } = await params
  const data = await load(username)
  if (!data || data.visibility !== 'public') return { robots: { index: false, follow: false } }
  return {
    title: `${data.user.username} — Anime Graph`,
    description: data.user.bio ?? `${data.user.username} profilja`,
    // A profil-oldalak szandekosan nincsenek indexelve ebben a korben.
    robots: { index: false, follow: false },
  }
}

export default async function Page({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const data = await load(username)
  // Privat profil 404-et ad, nem 403-at: a 403 elarulna, hogy a felhasznalonev letezik.
  if (!data || data.visibility !== 'public') notFound()

  return (
    <main className="min-h-screen pb-16">
      <div className="max-w-3xl mx-auto px-4 pt-28 flex flex-col gap-6">
        <header className="flex items-center gap-5">
          <Avatar username={data.user.username} size={72} />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{data.user.username}</h1>
            {data.user.bio && <p className="text-sm text-text-2 mt-1">{data.user.bio}</p>}
          </div>
        </header>
        <PinnedShowcase pinned={data.pinned} />
      </div>
    </main>
  )
}
```

A `PinnedShowcase` `linkable` propja alapból `true`, ami itt helyes: a kitűzött címek a publikus katalógus-oldalakra mutatnak, azok anonim látogatónak is elérhetők.

- [ ] **Step 3: Ellenőrzés**

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0`
Expected: minden zöld

- [ ] **Step 4: Commit**

```bash
git add src/app/u src/middleware.ts
git commit -m "feat(profil): /u/[username] publikus profil, privatnal 404"
```

---

## Task 18: Záró ellenőrzés és dokumentáció

**Files:**
- Modify: `docs/FUNKCIOK.md`, `docs/DEPLOY.md`, `.env.example`

- [ ] **Step 1: Teljes zöld futás**

Állítsd le a dev-szervert, majd:

Run: `npm test && npx tsc --noEmit && npx eslint src --max-warnings=0 && npm run build`
Expected: minden zöld

- [ ] **Step 2: Prod-smoke `next start` alatt**

Run: `npm run start` háttérben, majd:

```bash
curl -s -o /dev/null -w "login=%{http_code}\n" http://localhost:3000/login
curl -s -o /dev/null -w "title=%{http_code}\n" http://localhost:3000/anime/one-piece-21
curl -s -o /dev/null -w "profil=%{http_code}\n" http://localhost:3000/u/kacs
curl -s http://localhost:3000/api/auth/forgot -X POST -H "Content-Type: application/json" -d '{"email":"x@y.z"}'
```

Expected: `login=200`, `title=200`, `profil=200` vagy `404`, a `forgot` `{"ok":true}`

- [ ] **Step 3: Env-dokumentáció**

Modify `.env.example` — új sorok: `REGISTRATION_MODE=open`, `FROM_EMAIL=`.
Modify `docs/DEPLOY.md` — az env-táblázatba `REGISTRATION_MODE`, `FROM_EMAIL`; a deploy-lépések közé `node scripts/migrate-gate-a.mjs`.
Modify `docs/FUNKCIOK.md` — új szakasz a nyílt regisztrációról, nyelvváltásról és a profilról; a nyitott pontok táblából vedd ki a lezárt tételeket.

- [ ] **Step 4: Commit**

```bash
git add docs .env.example
git commit -m "docs: gate-A — nyilt reg, i18n es profil dokumentalasa"
```

---

## Végrehajtás utáni teendők (user)

1. Prod Neon **backup**, majd `DATABASE_URL="<prod>" node scripts/migrate-gate-a.mjs`
2. Vercel env: `REGISTRATION_MODE=open`, `RESEND_API_KEY`, `FROM_EMAIL`, és a hiányzó **`APP_URL`**
3. Deploy, majd élő smoke: idegen böngészőből regisztráció, megerősítő levél megérkezik, verify-link működik, jelszó-reset kilépteti a másik eszközt
4. A saját fiókodhoz (`id=1`) add meg az email-címet a Beállításokon, különben nincs jelszó-visszaállításod
