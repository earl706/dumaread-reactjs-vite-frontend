import { create } from 'zustand';

import { api, tokenStore } from '../lib/api';
import { effectiveRememberMe } from '../lib/desktop';

function isTransientAuthError(err) {
	if (!err?.response) return true;
	const status = err.response.status;
	return status >= 500 || status === 429;
}

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

function applySession(set, data) {
	if (data.mfa_required) {
		return {
			mfaRequired: true,
			mfaToken: data.mfa_token,
			status: 'mfa_pending',
			error: null
		};
	}
	tokenStore.set({ access: data.access, refresh: data.refresh });
	return {
		user: data.user,
		status: 'authenticated',
		mfaRequired: false,
		mfaToken: null,
		pendingRemember: true,
		error: null,
		pendingVerificationEmail: null
	};
}

export const useAuthStore = create((set, get) => ({
	user: null,
	status: 'idle',
	error: null,
	mfaRequired: false,
	mfaToken: null,
	pendingRemember: true,
	pendingVerificationEmail: null,

	isAuthenticated: () => Boolean(get().user),

	async login(email, password, { remember = true } = {}) {
		const rememberMe = effectiveRememberMe(remember);
		set({ status: 'loading', error: null, pendingRemember: rememberMe });
		try {
			const { data } = await api.post('/auth/login/', {
				email,
				password,
				remember: rememberMe
			});
			if (data.mfa_required) {
				set({
					mfaRequired: true,
					mfaToken: data.mfa_token,
					status: 'mfa_pending',
					error: null,
					pendingRemember: rememberMe
				});
				return null;
			}
			set(applySession(set, data));
			return data.user;
		} catch (err) {
			const data = err.response?.data;
			if (data?.email_verification_required || err.response?.status === 403) {
				set({
					status: 'unauthenticated',
					error: data?.detail || 'Verify your email before signing in.',
					pendingVerificationEmail: data?.email || email
				});
				throw new Error('verification_required', { cause: err });
			}
			const message =
				(typeof data?.detail === 'string' && data.detail) ||
				data?.non_field_errors?.[0] ||
				'Invalid email or password.';
			set({ status: 'unauthenticated', error: message });
			throw new Error(message, { cause: err });
		}
	},

	async verifyMfa({ code, recoveryCode, remember } = {}) {
		set({ status: 'loading', error: null });
		const rememberMe = effectiveRememberMe(
			remember !== undefined ? remember : get().pendingRemember
		);
		try {
			const { data } = await api.post('/auth/mfa/verify/', {
				mfa_token: get().mfaToken,
				code: code || undefined,
				recovery_code: recoveryCode || undefined,
				remember: rememberMe
			});
			set(applySession(set, data));
			return data.user;
		} catch (err) {
			const message = err.response?.data?.detail || 'Invalid code.';
			set({ status: 'mfa_pending', error: message });
			throw new Error(message, { cause: err });
		}
	},

	async register(payload) {
		set({ status: 'loading', error: null });
		try {
			const { data } = await api.post('/auth/register/', payload);
			set({
				status: 'unauthenticated',
				error: null,
				pendingVerificationEmail: data.email
			});
			return data;
		} catch (err) {
			const data = err.response?.data;
			const message =
				data?.email?.[0] || data?.password?.[0] || data?.detail || 'Could not create account.';
			set({ status: 'unauthenticated', error: message });
			throw new Error(message, { cause: err });
		}
	},

	async resendVerification(email) {
		const { data } = await api.post('/auth/email/resend/', { email });
		return data;
	},

	async verifyEmail(key) {
		const { data } = await api.post('/auth/email/verify/', { key });
		return data;
	},

	async changeEmail(email) {
		const { data } = await api.post('/auth/email/change/', { email });
		return data;
	},

	oauthStart(provider) {
		window.location.assign(`${baseURL}/auth/oauth/${provider}/start/`);
	},

	async completeOAuth(code) {
		set({ status: 'loading', error: null });
		try {
			const { data } = await api.post('/auth/oauth/exchange/', { code });
			if (data.mfa_required) {
				set({
					mfaRequired: true,
					mfaToken: data.mfa_token,
					status: 'mfa_pending',
					error: null,
					pendingRemember: true
				});
				return null;
			}
			set(applySession(set, data));
			return data.user;
		} catch (err) {
			const message = err.response?.data?.detail || 'OAuth sign-in failed.';
			set({ status: 'unauthenticated', error: message });
			throw new Error(message, { cause: err });
		}
	},

	async bootstrap() {
		if (!tokenStore.access && !tokenStore.refresh) {
			set({ status: 'unauthenticated' });
			return;
		}
		set({ status: 'loading' });
		const attempts = 8;
		for (let i = 0; i < attempts; i += 1) {
			try {
				const { data } = await api.get('/auth/me/');
				set({ user: data, status: 'authenticated', error: null });
				return;
			} catch (err) {
				const status = err.response?.status;
				if (status === 401 || status === 403) {
					tokenStore.clear();
					set({ user: null, status: 'unauthenticated' });
					return;
				}
				if (i < attempts - 1 && isTransientAuthError(err)) {
					await new Promise((resolve) => setTimeout(resolve, 400));
					continue;
				}
				set({ user: null, status: 'unauthenticated' });
				return;
			}
		}
	},

	updateUser(partial) {
		set((s) => ({ user: { ...s.user, ...partial } }));
	},

	clearMfa() {
		set({
			mfaRequired: false,
			mfaToken: null,
			pendingRemember: true,
			status: 'unauthenticated',
			error: null
		});
	},

	logout() {
		tokenStore.clear();
		set({
			user: null,
			status: 'unauthenticated',
			mfaRequired: false,
			mfaToken: null,
			pendingRemember: true,
			pendingVerificationEmail: null
		});
	}
}));
