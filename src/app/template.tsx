'use client'
import { motion } from 'framer-motion'

// opacity-only page fade: a transform here would turn the page into a
// containing block, which breaks every position:fixed overlay inside
// (vibe picker, finish modal, graph panels)
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
