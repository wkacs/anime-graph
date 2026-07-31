import { createHash, randomUUID } from 'node:crypto'
import { and, eq, lte, sql } from 'drizzle-orm'
import webpush from 'web-push'
import { db } from '@/db/client'
import { apiCache } from '@/db/schema'

const LEASE_MS = 15 * 60_000

type DeliveryValue = {
  state?: 'pending' | 'sent'
  attempt?: string
}

export type PushSubscriptionRow = {
  endpoint: string
  p256dh: string
  auth: string
}

export type PushDeliveryResult =
  | { state: 'sent' | 'deduplicated' | 'pending' | 'dead' }
  | { state: 'failed'; statusCode?: number }

export function pushDeliveryKey(eventKey: string, endpoint: string): string {
  const digest = createHash('sha256').update(`${eventKey}\0${endpoint}`).digest('hex')
  return `push-delivery:${digest}`
}

export function deliveryDisposition(
  value: unknown,
  updatedAt: Date,
  now = new Date(),
): 'sent' | 'pending' | 'retry' {
  const state = (value as DeliveryValue | null)?.state
  if (state === 'sent') return 'sent'
  return now.getTime() - updatedAt.getTime() < LEASE_MS ? 'pending' : 'retry'
}

async function claimDelivery(eventKey: string, endpoint: string, ttlDays: number) {
  const key = pushDeliveryKey(eventKey, endpoint)
  const now = new Date()
  const attempt = randomUUID()
  const expiresAt = new Date(now.getTime() + ttlDays * 86_400_000)
  const [inserted] = await db.insert(apiCache).values({
    key,
    value: { state: 'pending', attempt },
    expiresAt,
    updatedAt: now,
  }).onConflictDoNothing().returning({ key: apiCache.key })
  if (inserted) return { key, attempt, state: 'claimed' as const }

  const [existing] = await db.select().from(apiCache).where(eq(apiCache.key, key))
  if (!existing) return { key, attempt, state: 'pending' as const }
  const disposition = deliveryDisposition(existing.value, existing.updatedAt, now)
  if (disposition !== 'retry') return { key, attempt, state: disposition }

  const [reclaimed] = await db.update(apiCache).set({
    value: { state: 'pending', attempt },
    expiresAt,
    updatedAt: now,
  }).where(and(
    eq(apiCache.key, key),
    lte(apiCache.updatedAt, new Date(now.getTime() - LEASE_MS)),
  )).returning({ key: apiCache.key })
  return { key, attempt, state: reclaimed ? 'claimed' as const : 'pending' as const }
}

async function markSent(key: string): Promise<void> {
  await db.update(apiCache).set({
    value: { state: 'sent' },
    updatedAt: new Date(),
  }).where(eq(apiCache.key, key))
}

async function releaseClaim(key: string, attempt: string): Promise<void> {
  await db.delete(apiCache).where(and(
    eq(apiCache.key, key),
    sql`${apiCache.value}->>'attempt' = ${attempt}`,
  ))
}

export async function sendPushOnce(options: {
  eventKey: string
  subscription: PushSubscriptionRow
  payload: string
  ttlDays: number
}): Promise<PushDeliveryResult> {
  const claim = await claimDelivery(
    options.eventKey,
    options.subscription.endpoint,
    options.ttlDays,
  )
  if (claim.state === 'sent') return { state: 'deduplicated' }
  if (claim.state === 'pending') return { state: 'pending' }

  try {
    await webpush.sendNotification({
      endpoint: options.subscription.endpoint,
      keys: {
        p256dh: options.subscription.p256dh,
        auth: options.subscription.auth,
      },
    }, options.payload, { TTL: 3600, timeout: 10_000 })
    await markSent(claim.key)
    return { state: 'sent' }
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    if (statusCode === 404 || statusCode === 410) {
      await markSent(claim.key)
      return { state: 'dead' }
    }
    await releaseClaim(claim.key, claim.attempt)
    return { state: 'failed', statusCode }
  }
}
