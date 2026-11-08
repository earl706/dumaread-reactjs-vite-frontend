/** Current browser online hint (may be stale on mobile). */
export function isOnline() {
	if (typeof navigator === 'undefined') return true;
	return navigator.onLine !== false;
}

/**
 * Subscribe to online/offline changes.
 * @param {(online: boolean) => void} onChange
 * @returns {() => void} unsubscribe
 */
export function subscribeConnectivity(onChange) {
	if (typeof window === 'undefined') return () => {};

	const emit = () => onChange(isOnline());
	window.addEventListener('online', emit);
	window.addEventListener('offline', emit);
	emit();
	return () => {
		window.removeEventListener('online', emit);
		window.removeEventListener('offline', emit);
	};
}

/**
 * Lightweight reachability probe against the API origin.
 * Falls back to navigator.onLine when fetch is unavailable.
 */
export async function probeOnline(timeoutMs = 4000) {
	if (!isOnline()) return false;
	if (typeof fetch === 'undefined') return true;
	const base = import.meta.env.VITE_API_BASE_URL || '/api';
	const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
	const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
	try {
		await fetch(`${base.replace(/\/$/, '')}/books/stats/`, {
			method: 'HEAD',
			credentials: 'omit',
			signal: controller?.signal,
			cache: 'no-store'
		});
		return true;
	} catch {
		// HEAD may 401/405 — any HTTP response means the network path works.
		return isOnline();
	} finally {
		if (timer) clearTimeout(timer);
	}
}

/** True when an axios/fetch error looks like a transport failure. */
export function isNetworkError(err) {
	if (!err) return false;
	if (!err.response && err.request) return true;
	if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') return true;
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
	return false;
}
