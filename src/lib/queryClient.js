import { QueryClient } from '@tanstack/react-query'

// Sensible defaults for a data-heavy dashboard: keep data fresh for a minute,
// retry transient failures once, and don't refetch aggressively on focus.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
