'use client'
import { motion } from 'framer-motion'

// gentle page-transition: framer clears the transform at rest, so the
// fixed-positioned panels inside pages behave normally after the entry
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
