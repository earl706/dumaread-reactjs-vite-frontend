import { useEffect, useRef } from 'react';

import { booksApi } from '../lib/resources';
import { HEARTBEAT_MS, IDLE_MS } from '../lib/reading';

/**
 * Auto-track reading time while the reader is focused.
 * Pauses on a hidden tab and after 60s without pointer/keyboard/scroll.
 * Sends heartbeats every 15s and on unmount / page change.
 */
export function useReadingSession({ bookId, currentPage, enabled }) {
	const heartbeat = booksApi.useHeartbeat();
	const mutateRef = useRef(heartbeat.mutate);
	mutateRef.current = heartbeat.mutate;

	const lastActiveRef = useRef(Date.now());
	const lastSentRef = useRef(Date.now());
	const pageRef = useRef(currentPage);
	pageRef.current = currentPage;

	useEffect(() => {
		if (!enabled) return undefined;
		const markActive = () => {
			lastActiveRef.current = Date.now();
		};
		const onVisibility = () => {
			if (!document.hidden) markActive();
		};
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pointerdown', markActive);
		window.addEventListener('keydown', markActive);
		window.addEventListener('scroll', markActive, true);
		markActive();
		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pointerdown', markActive);
			window.removeEventListener('keydown', markActive);
			window.removeEventListener('scroll', markActive, true);
		};
	}, [enabled]);

	useEffect(() => {
		if (!enabled || !bookId || !currentPage) return undefined;

		const flush = () => {
			const now = Date.now();
			const hidden = typeof document !== 'undefined' && document.hidden;
			const idle = now - lastActiveRef.current > IDLE_MS;
			let seconds = 0;
			if (!hidden && !idle) {
				seconds = Math.max(0, Math.round((now - lastSentRef.current) / 1000));
			}
			lastSentRef.current = now;
			mutateRef.current({
				id: bookId,
				current_page: pageRef.current,
				seconds: Math.min(seconds, 120)
			});
		};

		lastSentRef.current = Date.now();
		flush();
		const id = window.setInterval(flush, HEARTBEAT_MS);
		const onUnload = () => flush();
		window.addEventListener('beforeunload', onUnload);
		return () => {
			window.clearInterval(id);
			window.removeEventListener('beforeunload', onUnload);
			flush();
		};
	}, [bookId, currentPage, enabled]);
}
