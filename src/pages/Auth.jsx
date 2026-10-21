import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { defaultRememberMe, isMobileApp } from '../lib/desktop';
import { Button, Input, LoadingScreen } from '../components/ui';
import PinInput from '../components/auth/PinInput';

function RememberMeCheckbox({ checked, onChange }) {
	return (
		<label className="text-muted flex cursor-pointer items-center gap-2 text-sm">
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				className="accent-primary h-4 w-4"
			/>
			Remember me for 90 days
		</label>
	);
}

export function AuthShell({ children }) {
	return (
		<div className="bg-bg flex min-h-screen">
			<div className="bg-primary relative hidden w-1/2 overflow-hidden lg:block">
				<div className="text-primary-fg relative flex h-full flex-col justify-between p-12">
					<div className="flex items-center gap-2">
						<div className="flex h-10 w-10 items-center justify-center rounded-sm bg-white/20">
							<BookOpen size={22} />
						</div>
						<span className="text-2xl font-bold">DumaRead</span>
					</div>
					<h1 className="text-4xl leading-tight font-bold">
						Upload a book. Read it. Track every page.
					</h1>
					<p className="text-primary-fg/70 text-sm">
						Your library, progress, and reading time — in one place.
					</p>
				</div>
			</div>
			<div className="flex w-full items-center justify-center p-6 lg:w-1/2">
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					className="w-full max-w-sm"
				>
					{children}
				</motion.div>
			</div>
		</div>
	);
}

function OAuthButtons() {
	const oauthStart = useAuthStore((s) => s.oauthStart);
	// OAuth leaves the WKWebView and will not round-trip. Email/password only.
	if (isMobileApp()) return null;
	return (
		<>
			<div className="my-4 flex items-center gap-3">
				<div className="bg-line h-px flex-1" />
				<span className="text-muted text-xs">or</span>
				<div className="bg-line h-px flex-1" />
			</div>
			<div className="space-y-2">
				<Button
					type="button"
					variant="secondary"
					className="w-full"
					onClick={() => oauthStart('google')}
				>
					Continue with Google
				</Button>
				<Button
					type="button"
					variant="secondary"
					className="w-full"
					onClick={() => oauthStart('github')}
				>
					Continue with GitHub
				</Button>
			</div>
		</>
	);
}

function MfaForm() {
	const navigate = useNavigate();
	const verifyMfa = useAuthStore((s) => s.verifyMfa);
	const clearMfa = useAuthStore((s) => s.clearMfa);
	const error = useAuthStore((s) => s.error);
	const pendingRemember = useAuthStore((s) => s.pendingRemember);
	const [code, setCode] = useState('');
	const [recoveryCode, setRecoveryCode] = useState('');
	const [useRecovery, setUseRecovery] = useState(false);
	const [loading, setLoading] = useState(false);
	const [remember, setRemember] = useState(
		pendingRemember !== undefined ? !!pendingRemember : defaultRememberMe()
	);

	const runVerify = async ({ totp, recovery } = {}) => {
		if (loading) return;
		setLoading(true);
		try {
			await verifyMfa({
				code: recovery ? undefined : totp,
				recoveryCode: recovery || undefined,
				remember
			});
			navigate('/', { replace: true });
		} catch {
			setCode('');
		} finally {
			setLoading(false);
		}
	};

	const submit = async (e) => {
		e.preventDefault();
		if (useRecovery) {
			await runVerify({ recovery: recoveryCode });
		} else if (code.length === 6) {
			await runVerify({ totp: code });
		}
	};

	const handlePinComplete = (nextCode) => {
		runVerify({ totp: nextCode });
	};

	return (
		<AuthShell>
			<h2 className="text-fg text-2xl font-bold">Two-factor authentication</h2>
			<p className="text-muted mt-2 text-sm">Enter the code from your authenticator app.</p>
			<form onSubmit={submit} className="mt-6 space-y-4">
				{useRecovery ? (
					<Input
						label="Recovery code"
						value={recoveryCode}
						onChange={(e) => setRecoveryCode(e.target.value)}
						placeholder="abcd1234"
						required
					/>
				) : (
					<div className="space-y-2">
						<p className="text-fg text-sm font-medium">Authentication code</p>
						<PinInput
							value={code}
							onChange={setCode}
							onComplete={handlePinComplete}
							disabled={loading}
							error={Boolean(error)}
						/>
					</div>
				)}
				<RememberMeCheckbox checked={remember} onChange={setRemember} />
				{error && <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">{error}</p>}
				{useRecovery && (
					<Button type="submit" className="w-full" loading={loading}>
						Verify
					</Button>
				)}
				{!useRecovery && loading && <p className="text-muted text-center text-xs">Verifying…</p>}
				<button
					type="button"
					className="text-primary w-full cursor-pointer text-sm"
					onClick={() => {
						setUseRecovery((v) => !v);
						setCode('');
					}}
				>
					{useRecovery ? 'Use authenticator code' : 'Use a recovery code'}
				</button>
				<button
					type="button"
					className="text-muted w-full cursor-pointer text-sm"
					onClick={() => {
						clearMfa();
						navigate('/login', { replace: true });
					}}
				>
					Cancel
				</button>
			</form>
		</AuthShell>
	);
}

export function LoginPage() {
	const navigate = useNavigate();
	const login = useAuthStore((s) => s.login);
	const error = useAuthStore((s) => s.error);
	const mfaRequired = useAuthStore((s) => s.mfaRequired);
	const status = useAuthStore((s) => s.status);
	const user = useAuthStore((s) => s.user);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [remember, setRemember] = useState(defaultRememberMe());
	const [loading, setLoading] = useState(false);

	if (mfaRequired) return <MfaForm />;
	if (status === 'idle' || status === 'loading') {
		return <LoadingScreen label="Restoring your session…" />;
	}
	if (status === 'authenticated' && user) {
		return <Navigate to="/" replace />;
	}

	const submit = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			await login(email, password, { remember });
			const user = useAuthStore.getState().user;
			if (user) navigate('/', { replace: true });
		} catch (err) {
			if (err.message === 'verification_required') {
				navigate('/check-email', { replace: true });
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthShell>
			<h2 className="text-fg text-2xl font-bold">Welcome back</h2>
			<form onSubmit={submit} className="mt-6 space-y-4" autoComplete="off">
				<Input
					label="Email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="Email"
					autoComplete="username"
					required
				/>
				<Input
					label="Password"
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					placeholder="Password"
					autoComplete="off"
					required
				/>
				<RememberMeCheckbox checked={remember} onChange={setRemember} />
				{error && <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">{error}</p>}
				<Button type="submit" className="w-full" loading={loading}>
					Sign in
				</Button>
			</form>
			<OAuthButtons />
			<p className="text-muted mt-6 text-center text-sm">
				No account?{' '}
				<Link to="/register" className="text-primary">
					Create one
				</Link>
			</p>
		</AuthShell>
	);
}

export function RegisterPage() {
	const navigate = useNavigate();
	const register = useAuthStore((s) => s.register);
	const error = useAuthStore((s) => s.error);
	const [form, setForm] = useState({ full_name: '', email: '', password: '' });
	const [confirmPassword, setConfirmPassword] = useState('');
	const [confirmError, setConfirmError] = useState('');
	const [loading, setLoading] = useState(false);
	const submit = async (e) => {
		e.preventDefault();
		if (form.password !== confirmPassword) {
			setConfirmError('Passwords do not match.');
			return;
		}
		setConfirmError('');
		setLoading(true);
		try {
			await register(form);
			navigate('/check-email', { replace: true });
		} finally {
			setLoading(false);
		}
	};
	return (
		<AuthShell>
			<h2 className="text-fg text-2xl font-bold">Create account</h2>
			{isMobileApp() && (
				<p className="text-muted mt-2 text-sm">
					If you already use DumaRead on your Mac, sign in with that email instead. New accounts:
					open the verification link on the Mac, then sign in here.
				</p>
			)}
			<form onSubmit={submit} className="mt-6 space-y-4">
				<Input
					label="Full name"
					value={form.full_name}
					onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
					required
				/>
				<Input
					label="Email"
					type="email"
					value={form.email}
					onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
					placeholder="you@example.com"
					required
				/>
				<Input
					label="Password"
					type="password"
					minLength={8}
					value={form.password}
					onChange={(e) => {
						setForm((f) => ({ ...f, password: e.target.value }));
						if (confirmError) setConfirmError('');
					}}
					placeholder="At least 8 characters"
					autoComplete="new-password"
					required
				/>
				<Input
					label="Confirm password"
					type="password"
					minLength={8}
					value={confirmPassword}
					onChange={(e) => {
						setConfirmPassword(e.target.value);
						if (confirmError) setConfirmError('');
					}}
					placeholder="Re-enter password"
					autoComplete="new-password"
					error={confirmError}
					required
				/>
				{error && <p className="bg-danger/10 text-danger rounded-md px-3 py-2 text-sm">{error}</p>}
				<Button type="submit" className="w-full" loading={loading}>
					Create account
				</Button>
			</form>
			<OAuthButtons />
			<p className="text-muted mt-6 text-center text-sm">
				Have an account?{' '}
				<Link to="/login" className="text-primary">
					Sign in
				</Link>
			</p>
		</AuthShell>
	);
}
