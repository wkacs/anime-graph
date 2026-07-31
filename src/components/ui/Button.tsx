'use client'
import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { springFluid, tapScale } from '@/lib/motion'

const VARIANTS = {
  solid: 'btn-solid',
  ghost: 'btn-ghost',
  outline: 'btn-ghost border border-white/12 hover:border-white/30',
} as const

const SIZES = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
} as const

type Props = HTMLMotionProps<'button'> & {
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
  const inactive = disabled || loading
  return (
    <motion.button
      disabled={inactive}
      whileHover={inactive ? undefined : { scale: 1.03, transition: springFluid }}
      whileTap={inactive ? undefined : tapScale}
      className={`${VARIANTS[variant]} ${SIZES[size]} whitespace-nowrap transition-colors disabled:opacity-40 ${className}`}
      {...rest}
    >
      {loading ? '…' : children}
    </motion.button>
  )
}
