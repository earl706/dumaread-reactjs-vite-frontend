import { create } from 'zustand';

import { subscribeConnectivity, isOnline } from '../lib/offline/connectivity';
import { clearOfflineDb, getMeta, setMeta } from '../lib/offline/db';
import { sumPendingSeconds } from '../lib/offline/outbox';
import { listSavedBookIds } from '../lib/offline/savedBooks';
import { flushOutbox } from '../lib/offline/sync';

let unsubConnectivity = null;
let flushTimer = null;
let visibilityHandler = null;
let installHandler = null;

export const useOfflineStore = create((set, get) => ({
	online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
	pendingSeconds: 0,
	syncing: false,
	savedIds: [],
	userId: null,
	installPromptEvent: null,
	initialized: false,

	async init(userId) {
		const uid = userId != null ? String(userId) : null;
		const prev = get().userId;

		if (uid && prev && prev !== uid) {
			try {
				await clearOfflineDb();
			} catch {
				/* ignore */
			}
		}

		if (uid) {
			try {
				const last = await getMeta('activeUserId');
				if (last && String(last) !== uid) await clearOfflineDb();
				await setMeta('activeUserId', uid);
			} catch {
				/* IndexedDB may be blocked */
			}
		}

		set({ userId: uid, initialized: true });

		if (unsubConnectivity) unsubConnectivity();
		unsubConnectivity = subscribeConnectivity((online) => {
			set({ online });
			if (online) get().flush();
		});

		if (visibilityHandler) {
			document.removeEventListener('visibilitychange', visibilityHandler);
		}
		visibilityHandler = () => {
			if (document.visibilityState === 'visible' && get().online) get().flush();
		};
		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', visibilityHandler);
		}

		if (installHandler) {
			window.removeEventListener('beforeinstallprompt', installHandler);
		}
		installHandler = (e) => {
			e.preventDefault();
			set({ installPromptEvent: e });
		};
		if (typeof window !== 'undefined') {
			window.addEventListener('beforeinstallprompt', installHandler);
		}

		if (flushTimer) clearInterval(flushTimer);
		flushTimer = setInterval(() => {
			if (get().pendingSeconds > 0 && get().online) get().flush();
		}, 30_000);

		await get().hydrateSaved();
		await get().refreshPending();
		if (get().online && uid) get().flush();
	},

	async hydrateSaved() {
		const uid = get().userId;
		if (!uid) {
			set({ savedIds: [] });
			return;
		}
		try {
			const ids = await listSavedBookIds(uid);
			set({ savedIds: ids });
		} catch {
			set({ savedIds: [] });
		}
	},

	async refreshPending() {
		const uid = get().userId;
		if (!uid) {
			set({ pendingSeconds: 0 });
			return 0;
		}
		try {
			const pendingSeconds = await sumPendingSeconds(uid);
			set({ pendingSeconds });
			return pendingSeconds;
		} catch {
			return get().pendingSeconds;
		}
	},

	markSaved(bookId) {
		const id = Number(bookId);
		set((s) => ({
			savedIds: s.savedIds.includes(id) ? s.savedIds : [...s.savedIds, id]
		}));
	},

	markUnsaved(bookId) {
		const id = Number(bookId);
		set((s) => ({ savedIds: s.savedIds.filter((x) => x !== id) }));
	},

	isSaved(bookId) {
		return get().savedIds.includes(Number(bookId));
	},

	async flush() {
		const uid = get().userId;
		if (!uid || !isOnline()) return;
		if (get().syncing) return;
		set({ syncing: true, online: true });
		try {
			await flushOutbox(uid, {
				onProgress: (pendingSeconds) => set({ pendingSeconds })
			});
			await get().refreshPending();
		} catch {
			await get().refreshPending();
		} finally {
			set({ syncing: false });
		}
	},

	clearInstallPrompt() {
		set({ installPromptEvent: null });
	},

	async promptInstall() {
		const evt = get().installPromptEvent;
		if (!evt) return false;
		evt.prompt();
		try {
			await evt.userChoice;
		} catch {
			/* ignore */
		}
		set({ installPromptEvent: null });
		return true;
	}
}));
