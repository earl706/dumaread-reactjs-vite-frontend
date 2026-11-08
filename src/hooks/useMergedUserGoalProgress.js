import { useEffect, useState } from 'react';

import { applyPendingToProgress } from '../lib/offline/localProgress';
import { getUserBaseline } from '../lib/offline/savedBooks';
import { useAuthStore } from '../stores/authStore';
import { useOfflineStore } from '../stores/offlineStore';

/**
 * Prefer live stats when online with nothing pending; otherwise overlay
 * outbox seconds onto the last baseline / stats snapshot.
 */
export function useMergedUserGoalProgress(statsProgress) {
	const userId = useAuthStore((s) => s.user?.id);
	const online = useOfflineStore((s) => s.online);
	const pendingSeconds = useOfflineStore((s) => s.pendingSeconds);
	const [merged, setMerged] = useState(statsProgress || null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			if (!userId) {
				if (!cancelled) setMerged(statsProgress || null);
				return;
			}
			if (online && pendingSeconds <= 0 && statsProgress) {
				if (!cancelled) setMerged(statsProgress);
				try {
					await getUserBaseline(userId); // warm
				} catch {
					/* ignore */
				}
				return;
			}
			try {
				const baseline = await getUserBaseline(userId);
				const base = baseline?.goal_progress || statsProgress || null;
				const next = applyPendingToProgress(base, pendingSeconds);
				if (!cancelled) setMerged(next);
			} catch {
				if (!cancelled) setMerged(applyPendingToProgress(statsProgress, pendingSeconds));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [userId, online, pendingSeconds, statsProgress]);

	return merged;
}
