import { isMobileApp } from './desktop';

const USER_KEY = isMobileApp() ? 'dumaread.mobile.sessionUser' : 'dumaread.sessionUser';

/** Last successful /auth/me/ (or login) user snapshot for offline bootstrap. */
export function readCachedUser() {
	try {
		const raw = localStorage.getItem(USER_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || parsed.id == null) return null;
		return parsed;
	} catch {
		return null;
	}
}

/** Persist a user profile for offline session restore. */
export function writeCachedUser(user) {
	if (!user || user.id == null) return;
	try {
		localStorage.setItem(USER_KEY, JSON.stringify(user));
	} catch {
		/* private mode / quota */
	}
}

/** Drop the cached profile (logout / hard auth failure). */
export function clearCachedUser() {
	try {
		localStorage.removeItem(USER_KEY);
	} catch {
		/* ignore */
	}
}
