import { cn } from '../../lib/format'

function initials(name = '') {
  const parts = name.trim().split(/\s+/)
  if (!parts[0]) return '?'
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export function Avatar({ name, src, size = 36, className }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name || ''}
        width={size}
        height={size}
        className={cn('rounded-full object-cover', className)}
      />
    )
  }
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-primary/15 font-medium text-primary',
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  )
}
