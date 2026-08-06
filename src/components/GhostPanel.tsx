'use client'
import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { springFluid } from '@/lib/motion'
import { fitTier } from '@/lib/fit-score'
import type { GraphNode } from '@/lib/graph-builder'

// Egy lebego ajanlas dontesi panelje. Harom kerdesre valaszol egy helyen, mert
// kulon-kulon egyik sem er semmit: mi ez, MIERT all itt, es most mi legyen vele.
// A „miert" nem dekoracio — enelkul a graf egyszeri latvany marad ahelyett, hogy
// dontesi felulet lenne.
export default function GhostPanel({
  node, onAdd, onDismiss, onClose,
}: {
  node: GraphNode
  onAdd: () => void
  onDismiss: () => void
  onClose: () => void
}) {
  const t = useTranslations('ghost')
  const tier = node.fitScore != null ? fitTier(node.fitScore) : null

  return (
    <motion.aside
      role="dialog"
      aria-label={node.label}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springFluid}
      className="surface-3 fixed bottom-24 left-1/2 z-30 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[var(--r-lg)] p-5 md:bottom-8"
    >
      <div className="flex items-start gap-4">
        {node.img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.img}
            alt=""
            className="hairline h-24 w-16 shrink-0 rounded-[var(--r-sm)] object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="label-mono">{t('eyebrow')}</p>
          <p className="mt-1 truncate text-base font-medium text-text-1">{node.label}</p>
          {tier && (
            <p className="mt-1 text-sm text-text-2">
              {t(`tier.${tier}`)}
              <span className="ml-2 font-mono text-xs text-text-3">{node.fitScore}%</span>
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label={t('close')}
          className="-mr-1 -mt-1 shrink-0 rounded-full px-2 py-1 text-text-3 hover:text-text-1"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 border-t border-white/8 pt-3">
        <p className="label-mono">{t('why')}</p>
        {node.anchorLabel && (
          <p className="mt-1.5 text-sm text-text-1">{t('anchor', { title: node.anchorLabel })}</p>
        )}
        {node.reason && <p className="mt-1 text-sm text-text-2">{node.reason}</p>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={onAdd} className="btn-solid px-4 py-2.5 text-sm">{t('plan')}</button>
        <button onClick={onDismiss} className="btn-ghost surface-1 px-4 py-2.5 text-sm">
          {t('notForMe')}
        </button>
      </div>
    </motion.aside>
  )
}
