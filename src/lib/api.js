import axios from 'axios';

import { isMobileApp } from './desktop';

// CUSTOMIZE: rename these keys. Mobile uses a separate namespace so a
// WKWebView session does not collide with Safari / desktop tokens.
const ACCESS_KEY = isMobileApp() ? 'dumaread.mobile.access' : 'dumaread.access';
const REFRESH_KEY = isMobileApp() ? 'dumaread.mobile.refresh' : 'dumaread.refresh';
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60;

function cookieGet(name) {
	if (typeof document === 'undefined') return null;
	const prefix = `${name}=`;
	const found = document.cookie.split('; ').find((row) => row.startsWith(prefix));
	if (!found) return null;
	try {
		return decodeURIComponent(found.slice(prefix.length));
	} catch {
		return found.slice(prefix.length);
	}
}

function cookieSet(name, value) {
	if (typeof document === 'undefined') return;
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function cookieClear(name) {
	if (typeof document === 'undefined') return;
	document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function readToken(key) {
	try {
		const fromStorage = localStorage.getItem(key);
		if (fromStorage) return fromStorage;
	} catch {
		/* private mode / blocked storage */
	}
	const fromCookie = cookieGet(key);
	if (fromCookie) {
		try {
			localStorage.setItem(key, fromCookie);
		} catch {
			/* ignore */
		}
	}
	return fromCookie;
}

function writeToken(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch {
		/* ignore */
	}
	cookieSet(key, value);
}

function removeToken(key) {
	try {
		localStorage.removeItem(key);
	} catch {
		/* ignore */
	}
	cookieClear(key);
}

export const tokenStore = {
	get access() {
		return readToken(ACCESS_KEY);
	},
	get refresh() {
		return readToken(REFRESH_KEY);
	},
	set({ access, refresh }) {
		if (access) writeToken(ACCESS_KEY, access);
		if (refresh) writeToken(REFRESH_KEY, refresh);
	},
	clear() {
		removeToken(ACCESS_KEY);
		removeToken(REFRESH_KEY);
	}
};

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
	const token = tokenStore.access;
	if (token) config.headers.Authorization = `Bearer ${token}`;
	return config;
});

const ANON_AUTH_PATHS = [
	'/auth/login/',
	'/auth/register/',
	'/auth/refresh/',
	'/auth/mfa/verify/',
	'/auth/oauth/',
	'/auth/email/verify/',
	'/auth/email/resend/'
];

function isAnonymousAuthRequest(url = '') {
	return ANON_AUTH_PATHS.some((path) => String(url).includes(path));
}

let refreshPromise = null;

export async function refreshAccessToken() {
	const refresh = tokenStore.refresh;
	if (!refresh) throw new Error('No refresh token');
	const { data } = await axios.post(`${baseURL}/auth/refresh/`, { refresh });
	tokenStore.set({
		access: data.access,
		...(data.refresh ? { refresh: data.refresh } : {})
	});
	return data.access;
}

api.interceptors.response.use(
	(response) => response,
	async (error) => {
		const original = error.config;
		const status = error.response?.status;

		if (
			status === 401 &&
			original &&
			!original._retry &&
			!isAnonymousAuthRequest(original.url) &&
			tokenStore.refresh
		) {
			original._retry = true;
			try {
				refreshPromise = refreshPromise || refreshAccessToken();
				const access = await refreshPromise;
				refreshPromise = null;
				original.headers.Authorization = `Bearer ${access}`;
				return api(original);
			} catch (refreshError) {
				refreshPromise = null;
				tokenStore.clear();
				if (typeof window !== 'undefined' && !isMobileApp()) {
					window.location.assign('/login');
				}
				return Promise.reject(refreshError);
			}
		}
		return Promise.reject(error);
	}
);

export const get = (url, config) => api.get(url, config).then((r) => r.data);
export const post = (url, body, config) => api.post(url, body, config).then((r) => r.data);
export const patch = (url, body, config) => api.patch(url, body, config).then((r) => r.data);
export const put = (url, body, config) => api.put(url, body, config).then((r) => r.data);
export const del = (url, config) => api.delete(url, config).then((r) => r.data);
export const getBlob = (url, config) =>
	api.get(url, { ...config, responseType: 'blob' }).then((r) => r.data);
