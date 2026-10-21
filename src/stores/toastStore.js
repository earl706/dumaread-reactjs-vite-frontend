import { create } from 'zustand'

let nextId = 1

/** Minimal toast system used to surface optimistic-update outcomes. */
export const useToastStore = create((set, get) => ({
  toasts: [],
  push({ message, type = 'info', duration = 3500 }) {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    if (duration) setTimeout(() => get().dismiss(id), duration)
    return id
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export const toast = {
  success: (message) => useToastStore.getState().push({ message, type: 'success' }),
  error: (message) => useToastStore.getState().push({ message, type: 'error' }),
  info: (message) => useToastStore.getState().push({ message, type: 'info' }),
}
