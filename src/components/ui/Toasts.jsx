import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Info, XCircle } from 'lucide-react'

import { useToastStore } from '../../stores/toastStore'

const ICONS = { success: CheckCircle2, error: XCircle, info: Info }
const TONES = {
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger',
  info: 'border-line text-fg',
}

/** Fixed-position toast viewport. Announced politely to assistive tech. */
export function Toasts() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              onClick={() => dismiss(t.id)}
              className={`pointer-events-auto flex cursor-pointer items-center gap-2 rounded-lg border bg-surface px-4 py-3 text-sm shadow-lg ${TONES[t.type]}`}
            >
              <Icon size={18} />
              <span className="text-fg">{t.message}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
