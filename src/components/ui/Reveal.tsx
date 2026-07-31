'use client'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { fadeUp, staggerContainer, viewportOnce } from '@/lib/motion'

// Szerver-komponens tartalmat reveal-lel beúsztató wrapperek.
// Kliens-komponensben inkább közvetlenül a @/lib/motion variantok mennek.

/** egyetlen blokk beúszása, amikor a viewportba ér */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
    >
      {children}
    </motion.div>
  )
}

/** konténer, amiben a Reveal-gyerekek lépcsőzve úsznak be */
export function RevealGroup({
  children, className, delay,
}: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer(delay)}
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
    >
      {children}
    </motion.div>
  )
}

/** RevealGroup-on BELÜLI elem: a szülő stagger-ritmusában úszik be */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  )
}
