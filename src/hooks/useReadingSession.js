import { useEffect, useRef } from 'react';

import { isNetworkError, isOnline } from '../lib/offline/connectivity';
import { buildSyntheticHeartbeatPayload } from '../lib/offline/localProgress';
import { enqueueHeartbeat } from '../lib/offline/outbox';
import { getSavedBookMeta, setProgressBaseline, setUserBaseline } from '../lib/offline/savedBooks';
import { createGoalMetWatcher } from '../lib/readingGoals';
import { booksApi } from '../lib/resources';
import { HEARTBEAT_MS } from '../lib/reading';
import { useAuthStore } from '../stores/authStore';
import { useOfflineStore } from '../stores/offlineStore';
import { toast } from '../stores/toastStore';

/**
 * Auto-track reading time while the reader tab is focused.
 * Online: POST heartbeat. Offline / network failure: enqueue IndexedDB outbox.
 */
export function useReadingSession({ bookId, currentPage, enabled }) {
	const userId = useAuthStore((s) => s.user?.id);
	const heartbeat = booksApi.useHeartbeat();
	const mutateRef = useRef(heartbeat.mutateAsync);
	mutateRef.current = heartbeat.mutateAsync;

	const lastSentRef = useRef(Date.now());
	const pageRef = useRef(currentPage);
	pageRef.current = currentPage;
	const userIdRef = useRef(userId);
	userIdRef.current = userId;

	useEffect(() => {
		if (!enabled || !bookId) return undefined;

		const watcher = createGoalMetWatcher({ toast });
		let active = true;
		lastSentRef.current = Date.now();

		const recordOffline = async (seconds, page) => {
			const uid = userIdRef.current;
			if (!uid || seconds <= 0) return;
			await enqueueHeartbeat({
				userId: uid,
				bookId,
				current_page: page,
				seconds
			});
			await useOfflineStore.getState().refreshPending();
			try {
				const meta = await getSavedBookMeta(uid, bookId);
				const synthetic = await buildSyntheticHeartbeatPayload(uid, bookId, meta);
				watcher.handle(synthetic);
			} catch {
				/* ignore watcher errors */
			}
		};

		const send = async (seconds) => {
			const page = pageRef.current;
			if (!page) return;
			const clamped = Math.min(Math.max(0, seconds), 120);

			if (!isOnline()) {
				await recordOffline(clamped, page);
				return;
			}

			try {
				const mutate = mutateRef.current;
				const data = await mutate({
					id: bookId,
					current_page: page,
					seconds: clamped
				});
				if (!active) return;
				watcher.handle(data);
				const uid = userIdRef.current;
				if (uid && data) {
					const { user_goal_progress, ...book } = data;
					if (book.goal_progress) {
						await setProgressBaseline(uid, bookId, {
							goal_progress: book.goal_progress,
							current_page: book.current_page,
							updatedAt: Date.now()
						});
					}
					if (user_goal_progress) {
						await setUserBaseline(uid, {
							goal_progress: user_goal_progress,
							updatedAt: Date.now()
						});
					}
				}
				if (useOfflineStore.getState().pendingSeconds > 0) {
					useOfflineStore.getState().flush();
				}
			} catch (err) {
				if (isNetworkError(err) || !err?.response) {
					await recordOffline(clamped, page);
					return;
				}
				// Non-network errors: still credit locally so minutes aren't lost on flaky APIs
				if (!err?.response || err.response.status >= 500) {
					await recordOffline(clamped, page);
				}
			}
		};

		const flush = () => {
			if (!active) return;
			const now = Date.now();
			const hidden = typeof document !== 'undefined' && document.hidden;
			let seconds = 0;
			if (!hidden) {
				seconds = Math.max(0, Math.round((now - lastSentRef.current) / 1000));
			}
			lastSentRef.current = now;
			void send(seconds);
		};

		const id = window.setInterval(flush, HEARTBEAT_MS);
		const onVisibility = () => {
			if (document.hidden) flush();
			else lastSentRef.current = Date.now();
		};
		const onUnload = () => flush();
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('beforeunload', onUnload);
		return () => {
			active = false;
			window.clearInterval(id);
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('beforeunload', onUnload);
			const now = Date.now();
			const hidden = typeof document !== 'undefined' && document.hidden;
			const seconds = !hidden ? Math.max(0, Math.round((now - lastSentRef.current) / 1000)) : 0;
			lastSentRef.current = now;
			if (pageRef.current && seconds > 0) void send(seconds);
		};
	}, [bookId, enabled]);
}
