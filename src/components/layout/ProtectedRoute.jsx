import { Navigate, useLocation } from 'react-router-dom'

import { useAuthStore } from '../../stores/authStore'
import { LoadingScreen } from '../ui'

/** Gate authenticated routes; show a loader while the session rehydrates. */
export function ProtectedRoute({ children }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'idle' || status === 'loading') {
    return <LoadingScreen label="Restoring your session…" />
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
