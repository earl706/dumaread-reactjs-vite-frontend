import { useId } from 'react'

import { cn } from '../../lib/format'

const baseControl =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg ' +
  'placeholder:text-muted focus:border-primary focus:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--ring)] transition-colors'

/** Labeled text input with accessible association and error messaging. */
export function Input({ label, error, className, id, ...props }) {
  const generated = useId()
  const fieldId = id || generated
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-fg">
          {label}
        </label>
      )}
      <input
        id={fieldId}
        className={cn(baseControl, error && 'border-danger', className)}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

export function Textarea({ label, error, className, id, rows = 4, ...props }) {
  const generated = useId()
  const fieldId = id || generated
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-fg">
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        rows={rows}
        className={cn(baseControl, 'resize-y', error && 'border-danger', className)}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

export function Select({ label, error, className, id, children, ...props }) {
  const generated = useId()
  const fieldId = id || generated
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="block text-sm font-medium text-fg">
          {label}
        </label>
      )}
      <select id={fieldId} className={cn(baseControl, 'pr-8', className)} {...props}>
        {children}
      </select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
