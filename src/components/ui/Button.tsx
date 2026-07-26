import type { ButtonHTMLAttributes, ReactNode } from 'react'

const VARIANTS = {
  solid: 'btn-solid',
  ghost: 'btn-ghost',
  outline: 'btn-ghost border border-white/12 hover:border-white/30',
} as const

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
} as const

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  loading?: boolean
  children: ReactNode
}

export default function Button({
  variant = 'outline',
  size = 'sm',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`${VARIANTS[variant]} ${SIZES[size]} whitespace-nowrap transition-colors disabled:opacity-40 ${className}`}
      {...rest}
    >
      {loading ? '…' : children}
    </button>
  )
}
