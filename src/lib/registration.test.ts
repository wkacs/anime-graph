import { describe, it, expect, afterEach } from 'vitest'
import { registrationMode, validateRegistration } from './registration'

describe('registrationMode', () => {
  const saved = process.env.REGISTRATION_MODE
  afterEach(() => {
    if (saved == null) delete process.env.REGISTRATION_MODE
    else process.env.REGISTRATION_MODE = saved
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
