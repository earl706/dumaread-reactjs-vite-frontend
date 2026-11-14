import { AnimatePresence } from 'framer-motion';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuthStore } from '../../stores/authStore';
import { FadeIn, LoadingScreen } from '../ui';

/** Gate authenticated routes; show a loader while the session rehydrates. */
export function ProtectedRoute({ children }) {
	const status = useAuthStore((s) => s.status);
	const location = useLocation();
	const restoring = status === 'idle' || status === 'loading';

	if (status === 'unauthenticated') {
		return <Navigate to="/login" replace state={{ from: location.pathname }} />;
	}

	return (
		<div className="h-full min-h-0">
			<AnimatePresence mode="wait">
				{restoring ? (
					<LoadingScreen key="auth-loading" label="Restoring your session…" />
				) : (
					<FadeIn key="auth-ready" className="h-full min-h-0">
						{children}
					</FadeIn>
				)}
			</AnimatePresence>
		</div>
	);
}
