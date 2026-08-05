// A "kezdőképernyőhöz hozzáadás" sáv döntési logikája.
// Külön modul, mert a vitest environment 'node' és csak *.test.ts fut: a
// komponensben ülő logika tesztelhetetlen lenne.

/** 30 nap: az elutasítás nem örök, de nem is tolakodunk vissza egy hét múlva. */
export const DISMISS_COOLDOWN_MS = 30 * 86_400_000

export const INSTALL_DISMISS_KEY = 'ag:install-dismissed'

/**
 * iOS-en a beforeinstallprompt nem létezik, és kezdőképernyőre tenni KIZÁRÓLAG
 * a Safariból lehet. A Chrome/Firefox/Edge iOS-en csak WebKit-burok, ott a
 * Megosztás-menüben nincs "Hozzáadás a kezdőképernyőhöz" — ezeknek tehát nem
 * mutatunk útmutatót, mert nem tudnák végrehajtani.
 */
export function isIosSafari(ua: string, maxTouchPoints = 0): boolean {
  const iPhoneOrIPad = /iPad|iPhone|iPod/.test(ua)
  // iPadOS 13+ alapból asztali UA-t küld: Mac + érintés = valójában iPad.
  const iPadDesktopUa = /Macintosh/.test(ua) && maxTouchPoints > 1
  if (!iPhoneOrIPad && !iPadDesktopUa) return false
  // A WebKit-burkok saját jelzőt tesznek az UA-ba.
  return !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua)
}

/**
 * Már telepítve fut? Ilyenkor a sáv értelmetlen.
 * A két jelzés külön létezik: a display-mode a szabvány, a navigator.standalone
 * az iOS saját, régebbi megoldása.
 */
export function isStandalone(displayModeStandalone: boolean, iosStandalone: boolean): boolean {
  return displayModeStandalone || iosStandalone
}

/** A localStorage-ba írandó érték: az elutasítás időbélyege. */
export function dismissalValue(now: number): string {
  return String(now)
}

/**
 * Lejárt-e már az elutasítás? Az olvasott érték idegen kézből jön
 * (a user is átírhatja), ezért minden értelmezhetetlen tartalom
 * "nincs elutasítva"-ként viselkedik, nem némítja el örökre a sávot.
 */
export function isDismissed(
  raw: string | null,
  now: number,
  cooldownMs: number = DISMISS_COOLDOWN_MS,
): boolean {
  if (raw == null) return false
  const at = Number(raw)
  if (!Number.isFinite(at) || at <= 0) return false
  // Jövőbeli időbélyeg (átállított óra) sem zárhatja ki örökre a sávot.
  if (at > now) return false
  return now - at < cooldownMs
}

export type InstallMode =
  /** Chrome/Edge Androidon: van natív prompt, egy gombnyomás a telepítés. */
  | 'native'
  /** iOS Safari: nincs API, kézi útmutatót adunk. */
  | 'ios-manual'
  /** Nincs mit felajánlani. */
  | 'hidden'

export type InstallModeInput = {
  standalone: boolean
  dismissed: boolean
  hasNativePrompt: boolean
  iosSafari: boolean
}

/**
 * Egyetlen döntési pont. A sorrend számít: a már telepített és az elutasított
 * eset MINDEN mást megelőz.
 */
export function installMode(input: InstallModeInput): InstallMode {
  if (input.standalone) return 'hidden'
  if (input.dismissed) return 'hidden'
  if (input.hasNativePrompt) return 'native'
  if (input.iosSafari) return 'ios-manual'
  return 'hidden'
}
