import { avatarInitials, avatarHue } from '@/lib/avatar'

// src: a felhasználó által választott AniList CDN-kép (profil-személyreszabás).
// Nélküle marad a névből generált monogram — a kettő ugyanazt a geometriát kapja.
export default function Avatar({ username, size = 48, src }: { username: string; size?: number; src?: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        className="rounded-full object-cover shrink-0 border border-white/10"
        style={{ width: size, height: size }}
      />
    )
  }
  const hue = avatarHue(username)
  return (
    <div
      className="rounded-full grid place-items-center font-semibold shrink-0 border border-white/10 text-text-1"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(140deg, hsl(${hue} 55% 32%), hsl(${(hue + 40) % 360} 55% 18%))`,
      }}
      aria-hidden
    >
      {avatarInitials(username)}
    </div>
  )
}
