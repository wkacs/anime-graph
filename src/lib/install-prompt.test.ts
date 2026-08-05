import { describe, it, expect } from 'vitest'
import {
  isIosSafari,
  isStandalone,
  isDismissed,
  dismissalValue,
  installMode,
  DISMISS_COOLDOWN_MS,
} from './install-prompt'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0 Mobile/15E148 Safari/604.1'
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Mobile Safari/537.36'
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'

describe('isIosSafari', () => {
  it('iPhone Safari igen', () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true)
  })
  it('iOS Chrome nem: WebKit-burok, nem tud kezdokepernyore tenni', () => {
    expect(isIosSafari(IPHONE_CHROME)).toBe(false)
  })
  it('Android Chrome nem', () => {
    expect(isIosSafari(ANDROID_CHROME)).toBe(false)
  })
  it('asztali Mac Safari nem', () => {
    expect(isIosSafari(MAC_SAFARI)).toBe(false)
    expect(isIosSafari(MAC_SAFARI, 0)).toBe(false)
  })
  it('iPadOS 13+ asztali UA-t kuld, de erintessel iPad', () => {
    expect(isIosSafari(MAC_SAFARI, 5)).toBe(true)
  })
  it('ures UA nem dob', () => {
    expect(isIosSafari('')).toBe(false)
  })
})

describe('isStandalone', () => {
  it('barmelyik jelzes eleg', () => {
    expect(isStandalone(true, false)).toBe(true)
    expect(isStandalone(false, true)).toBe(true)
  })
  it('egyik sem: bongeszoben fut', () => {
    expect(isStandalone(false, false)).toBe(false)
  })
})

describe('isDismissed', () => {
  const NOW = 1_700_000_000_000

  it('nincs bejegyzes: nincs elutasitva', () => {
    expect(isDismissed(null, NOW)).toBe(false)
  })
  it('friss elutasitas meg tart', () => {
    expect(isDismissed(dismissalValue(NOW - 1000), NOW)).toBe(true)
  })
  it('cooldown lejarta utan ujra mutathato', () => {
    expect(isDismissed(dismissalValue(NOW - DISMISS_COOLDOWN_MS - 1), NOW)).toBe(false)
  })
  it('pontosan a hataron mar lejart', () => {
    expect(isDismissed(dismissalValue(NOW - DISMISS_COOLDOWN_MS), NOW)).toBe(false)
  })
  it('ertelmezhetetlen ertek nem nemitja el orokre', () => {
    expect(isDismissed('abc', NOW)).toBe(false)
    expect(isDismissed('', NOW)).toBe(false)
    expect(isDismissed('0', NOW)).toBe(false)
    expect(isDismissed('-5', NOW)).toBe(false)
    expect(isDismissed('Infinity', NOW)).toBe(false)
  })
  it('jovobeli idobelyeg (atallitott ora) sem zar ki orokre', () => {
    expect(isDismissed(dismissalValue(NOW + 86_400_000), NOW)).toBe(false)
  })
})

describe('installMode', () => {
  const base = { standalone: false, dismissed: false, hasNativePrompt: false, iosSafari: false }

  it('mar telepitve: semmi', () => {
    expect(installMode({ ...base, standalone: true, hasNativePrompt: true })).toBe('hidden')
  })
  it('elutasitva: semmi, meg ha van is natix prompt', () => {
    expect(installMode({ ...base, dismissed: true, hasNativePrompt: true })).toBe('hidden')
  })
  it('natix prompt eseten az nyer', () => {
    expect(installMode({ ...base, hasNativePrompt: true })).toBe('native')
  })
  it('iOS Safari: kezi utmutato', () => {
    expect(installMode({ ...base, iosSafari: true })).toBe('ios-manual')
  })
  it('natix prompt megelozi az iOS-agat', () => {
    expect(installMode({ ...base, hasNativePrompt: true, iosSafari: true })).toBe('native')
  })
  it('semmi nem all fenn: rejtve', () => {
    expect(installMode(base)).toBe('hidden')
  })
})
