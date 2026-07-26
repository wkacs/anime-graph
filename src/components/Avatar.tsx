import { avatarInitials, avatarHue } from '@/lib/avatar'

export default function Avatar({ username, size = 48 }: { username: string; size?: number }) {
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
