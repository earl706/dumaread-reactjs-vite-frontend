/**
 * Register the Vite PWA service worker in production builds only.
 * Book binaries stay in IndexedDB — the SW only caches the app shell.
 */
export function registerOfflineServiceWorker() {
	if (!import.meta.env.PROD) return;
	if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

	void import('virtual:pwa-register')
		.then(({ registerSW }) => {
			registerSW({
				immediate: true,
				onRegisteredSW() {
					/* registered */
				},
				onRegisterError(err) {
					console.warn('Service worker registration failed', err);
				}
			});
		})
		.catch((err) => {
			console.warn('PWA register module unavailable', err);
		});
}
