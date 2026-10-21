import { format, formatDistanceToNow, isToday, isTomorrow, parseISO } from 'date-fns'

export const cn = (...parts) => parts.filter(Boolean).join(' ')

export function formatDate(value, pattern = 'MMM d, yyyy') {
  if (!value) return ''
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, pattern)
}

/** Human, context-aware due-date label. */
export function formatDue(value) {
  if (!value) return null
  const date = typeof value === 'string' ? parseISO(value) : value
  if (isToday(date)) return `Today, ${format(date, 'h:mma')}`
  if (isTomorrow(date)) return `Tomorrow, ${format(date, 'h:mma')}`
  return format(date, 'MMM d')
}

export function fromNow(value) {
  if (!value) return ''
  const date = typeof value === 'string' ? parseISO(value) : value
  return formatDistanceToNow(date, { addSuffix: true })
}

export function minutesToHours(minutes) {
  if (!minutes) return '0h'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

export function formatDurationSeconds(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  if (!safe) return '0s'
  if (safe < 60) return `${safe}s`
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  if (!h) return s ? `${m}m ${s}s` : `${m}m`
  if (!s) return `${h}h ${m}m`
  return `${h}h ${m}m ${s}s`
}

/** Pick a readable text color (#000/#fff) for a given hex background. */
export function contrastColor(hex) {
  if (!hex) return '#fff'
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1a1726' : '#ffffff'
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}
