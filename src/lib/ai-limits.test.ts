import { describe, it, expect, afterEach } from 'vitest'
import {
  GLOBAL_QUOTA_USER_ID, globalDailyLimit, quotaVerdict, resolveLimit,
} from './ai-limits'

describe('resolveLimit', () => {
  it('ismert endpoint + free', () => { expect(resolveLimit('recommend', 'free')).toBe(5) })
  it('ismert endpoint + paid', () => { expect(resolveLimit('recommend', 'paid')).toBe(50) })
  it('vibe free', () => { expect(resolveLimit('vibe', 'free')).toBe(10) })
  it('ismeretlen endpoint a default limitre esik', () => {
    expect(resolveLimit('digest', 'free')).toBe(20)
    expect(resolveLimit('digest', 'paid')).toBe(200)
  })
})

const saved = process.env.AI_GLOBAL_DAILY_LIMIT
afterEach(() => {
  if (saved == null) delete process.env.AI_GLOBAL_DAILY_LIMIT
  else process.env.AI_GLOBAL_DAILY_LIMIT = saved
})

describe('globalDailyLimit', () => {
  it('hianyzo env = nincs globalis plafon', () => {
    delete process.env.AI_GLOBAL_DAILY_LIMIT
    expect(globalDailyLimit()).toBe(0)
  })

  it('ervenyes szamot beolvassa', () => {
    process.env.AI_GLOBAL_DAILY_LIMIT = '5000'
    expect(globalDailyLimit()).toBe(5000)
  })

  it('szemetet nem ertelmez plafonkent', () => {
    process.env.AI_GLOBAL_DAILY_LIMIT = 'sok'
    expect(globalDailyLimit()).toBe(0)
  })

  it('negativ es nulla = nincs plafon, nem azonnali zar', () => {
    process.env.AI_GLOBAL_DAILY_LIMIT = '-10'
    expect(globalDailyLimit()).toBe(0)
    process.env.AI_GLOBAL_DAILY_LIMIT = '0'
    expect(globalDailyLimit()).toBe(0)
  })

  it('tortszamot lefele kerekit', () => {
    process.env.AI_GLOBAL_DAILY_LIMIT = '99.7'
    expect(globalDailyLimit()).toBe(99)
  })
})

describe('quotaVerdict', () => {
  const base = { userCount: 0, userLimit: 5, globalCount: 0, globalLimit: 100 }

  it('keret alatt atengedi', () => {
    expect(quotaVerdict(base)).toEqual({ allowed: true })
  })

  it('sajat keret elfogyott', () => {
    expect(quotaVerdict({ ...base, userCount: 5 })).toEqual({ allowed: false, reason: 'user' })
  })

  it('globalis keret elfogyott', () => {
    expect(quotaVerdict({ ...base, globalCount: 100 })).toEqual({ allowed: false, reason: 'global' })
  })

  // Ha mindketto elfogyott, a globalis a pontosabb magyarazat: a usernek nem
  // az a baja, hogy o sokat hasznalta, hanem hogy a szolgaltatas futott keretbe.
  it('mindketto elfogyott: a globalis okot jelenti', () => {
    expect(quotaVerdict({ ...base, userCount: 5, globalCount: 100 }))
      .toEqual({ allowed: false, reason: 'global' })
  })

  it('globalLimit 0 = nincs globalis plafon, a sajat keret dont', () => {
    expect(quotaVerdict({ ...base, globalLimit: 0, globalCount: 999999 })).toEqual({ allowed: true })
    expect(quotaVerdict({ ...base, globalLimit: 0, globalCount: 999999, userCount: 5 }))
      .toEqual({ allowed: false, reason: 'user' })
  })

  it('a hatarertek alatt meg atenged (>=, nem >)', () => {
    expect(quotaVerdict({ ...base, userCount: 4 })).toEqual({ allowed: true })
    expect(quotaVerdict({ ...base, globalCount: 99 })).toEqual({ allowed: true })
  })
})

describe('GLOBAL_QUOTA_USER_ID', () => {
  // a users.id serial 1-tol indul, tehat a 0 nem utkozik valos user-sorral
  it('0, hogy ne utkozzon valos userrel', () => {
    expect(GLOBAL_QUOTA_USER_ID).toBe(0)
  })
})
