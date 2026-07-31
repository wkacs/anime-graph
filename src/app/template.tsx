'use client'
import { motion, MotionConfig } from 'framer-motion'
import { fluidEase } from '@/lib/motion'

// opacity-only page fade: a transform here would turn the page into a
// containing block, which breaks every position:fixed overlay inside
// (vibe picker, finish modal, graph panels)
// MotionConfig reducedMotion="user": prefers-reduced-motion alatt a framer
// transform-animációk kikapcsolnak (a CSS-oldali párja a globals.css-ben él).
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: fluidEase }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  )
}
