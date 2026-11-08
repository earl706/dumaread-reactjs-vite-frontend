import { post, refreshAccessToken, tokenStore } from '../api';
import { queryClient } from '../queryClient';
import {
	deleteOutboxRow,
	listPendingOutbox,
	markOutboxPending,
	markOutboxSending,
	resetSendingOutbox,
	sumPendingSeconds
} from './outbox';
import { isNetworkError, isOnline } from './connectivity';
import { setProgressBaseline, setUserBaseline } from './savedBooks';

let flushing = false;
let flushPromise = null;

async function ensureAuth() {
	if (!tokenStore.access && tokenStore.refresh) {
		await refreshAccessToken();
	}
	if (!tokenStore.access) {
		const err = new Error('unauthenticated');
		err.code = 'unauthenticated';
		throw err;
	}
}

/**
 * Flush pending heartbeats for the current user (single-flight).
 * @param {string|number} userId
 * @param {{ onProgress?: (pendingSeconds: number) => void, onBaseline?: (data: object) => void }} [opts]
 */
export async function flushOutbox(userId, opts = {}) {
	if (!userId) return { flushed: 0, remaining: 0 };
	if (!isOnline()) {
		const remaining = await sumPendingSeconds(userId);
		return { flushed: 0, remaining };
	}
	if (flushing && flushPromise) return flushPromise;

	flushing = true;
	flushPromise = (async () => {
		let flushed = 0;
		try {
			await resetSendingOutbox(userId);
			await ensureAuth();
			const rows = await listPendingOutbox(userId);
			for (const row of rows) {
				if (!isOnline()) break;
				await markOutboxSending(row.id);
				try {
					const data = await post(`/books/${row.bookId}/heartbeat/`, {
						current_page: row.current_page,
						seconds: row.seconds
					});
					await deleteOutboxRow(row.id);
					flushed += 1;

					const { user_goal_progress, ...book } = data || {};
					if (book?.goal_progress) {
						await setProgressBaseline(userId, row.bookId, {
							goal_progress: book.goal_progress,
							current_page: book.current_page,
							updatedAt: Date.now()
						});
					}
					if (user_goal_progress) {
						await setUserBaseline(userId, {
							goal_progress: user_goal_progress,
							goal_daily_minutes: null,
							goal_weekly_minutes: null,
							goal_monthly_minutes: null,
							updatedAt: Date.now()
						});
					}
					opts.onBaseline?.(data);
				} catch (err) {
					const status = err?.response?.status;
					if (status === 404) {
						await deleteOutboxRow(row.id);
						continue;
					}
					await markOutboxPending(row.id);
					if (status === 401 || err?.code === 'unauthenticated') break;
					if (isNetworkError(err) || (status && status >= 500)) break;
					// Other 4xx: drop to avoid infinite loop on bad payload
					if (status && status >= 400 && status < 500) {
						await deleteOutboxRow(row.id);
						continue;
					}
					break;
				}
				const remainingMid = await sumPendingSeconds(userId);
				opts.onProgress?.(remainingMid);
			}

			const remaining = await sumPendingSeconds(userId);
			if (remaining === 0 && flushed > 0) {
				queryClient.invalidateQueries({ queryKey: ['books'] });
			}
			opts.onProgress?.(remaining);
			return { flushed, remaining };
		} finally {
			flushing = false;
			flushPromise = null;
		}
	})();

	return flushPromise;
}

export function isFlushing() {
	return flushing;
}
