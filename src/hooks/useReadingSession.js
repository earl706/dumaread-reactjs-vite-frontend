import { useEffect, useRef } from 'react';

import { booksApi } from '../lib/resources';
import { HEARTBEAT_MS } from '../lib/reading';

/**
 * Auto-track reading time while the reader tab is focused.
 * Counts wall-clock time whenever the document is visible (no idle pause).
 * Pauses only while the tab is hidden. Heartbeats every 15s and on unmount.
 *
 * Does not restart when ``currentPage`` changes (page is read from a ref), so
 * StrictMode / rapid page turns cannot double-flush the same window (dev over-count).
 */
export function useReadingSession({ bookId, currentPage, enabled }) {
	const heartbeat = booksApi.useHeartbeat();
	const mutateRef = useRef(heartbeat.mutate);
	mutateRef.current = heartbeat.mutate;

	const lastSentRef = useRef(Date.now());
	const pageRef = useRef(currentPage);
	pageRef.current = currentPage;

	useEffect(() => {
		if (!enabled || !bookId) return undefined;

		let active = true;
		lastSentRef.current = Date.now();

		const flush = () => {
			if (!active) return;
			const now = Date.now();
			const hidden = typeof document !== 'undefined' && document.hidden;
			let seconds = 0;
			if (!hidden) {
				seconds = Math.max(0, Math.round((now - lastSentRef.current) / 1000));
			}
			lastSentRef.current = now;
			const page = pageRef.current;
			if (!page) return;
			mutateRef.current({
				id: bookId,
				current_page: page,
				seconds: Math.min(seconds, 120)
			});
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
			// Final credit for this effect instance (StrictMode remount starts a new one).
			const now = Date.now();
			const hidden = typeof document !== 'undefined' && document.hidden;
			const seconds = !hidden ? Math.max(0, Math.round((now - lastSentRef.current) / 1000)) : 0;
			lastSentRef.current = now;
			const page = pageRef.current;
			if (page && seconds > 0) {
				mutateRef.current({
					id: bookId,
					current_page: page,
					seconds: Math.min(seconds, 120)
				});
			}
		};
	}, [bookId, enabled]);
}
