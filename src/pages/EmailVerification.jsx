import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { isMobileApp } from '../lib/desktop';
import { Button } from '../components/ui';
import { AuthShell } from './Auth';

export function CheckEmailPage() {
	const navigate = useNavigate();
	const pendingEmail = useAuthStore((s) => s.pendingVerificationEmail);
	const resendVerification = useAuthStore((s) => s.resendVerification);
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState(null);

	const email = pendingEmail || '';

	const resend = async () => {
		if (!email) return;
		setLoading(true);
		setError(null);
		try {
			await resendVerification(email);
			setSent(true);
		} catch (err) {
			setError(err.message || 'Could not resend verification email.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthShell>
			<div className="bg-primary/10 text-primary mx-auto flex h-12 w-12 items-center justify-center rounded-sm">
				<Mail size={24} />
			</div>
			<h2 className="text-fg mt-4 text-2xl font-bold">Check your email</h2>
			<p className="text-muted mt-2 text-sm">
				We sent a verification link to{' '}
				{email ? <span className="text-fg font-medium">{email}</span> : 'your email address'}. Open
				it to activate your account before signing in.
				{isMobileApp()
					? ' Open that link on your Mac — it will not complete inside this phone.'
					: ''}
			</p>
			{sent && (
				<p className="bg-success/10 text-success mt-4 rounded-md px-3 py-2 text-sm">
					Verification email sent again.
				</p>
			)}
			{error && (
				<p className="bg-danger/10 text-danger mt-4 rounded-md px-3 py-2 text-sm">{error}</p>
			)}
			<div className="mt-6 space-y-3">
				<Button
					type="button"
					className="w-full"
					loading={loading}
					disabled={!email}
					onClick={resend}
				>
					Resend email
				</Button>
				<Button
					type="button"
					variant="secondary"
					className="w-full"
					onClick={() => navigate('/login')}
				>
					Back to sign in
				</Button>
			</div>
			<p className="text-muted mt-6 text-center text-sm">
				Wrong address?{' '}
				<Link to="/register" className="text-primary">
					Register again
				</Link>
			</p>
		</AuthShell>
	);
}

export function VerifyEmailPage() {
	const navigate = useNavigate();
	const verifyEmail = useAuthStore((s) => s.verifyEmail);
	const [params] = useSearchParams();
	const key = params.get('key') || '';
	const [status, setStatus] = useState(key ? 'loading' : 'missing');
	const [message, setMessage] = useState('');

	useEffect(() => {
		if (!key) return;
		verifyEmail(key)
			.then((data) => {
				setStatus('success');
				setMessage(data.detail);
			})
			.catch((err) => {
				setStatus('error');
				setMessage(err.message || 'Invalid or expired confirmation link.');
			});
	}, [key, verifyEmail]);

	return (
		<AuthShell>
			<h2 className="text-fg text-2xl font-bold">Email verification</h2>
			{status === 'loading' && <p className="text-muted mt-4 text-sm">Confirming your email…</p>}
			{status === 'missing' && (
				<p className="text-muted mt-4 text-sm">
					Missing confirmation key. Use the link from your email.
				</p>
			)}
			{status === 'success' && (
				<>
					<p className="bg-success/10 text-success mt-4 rounded-md px-3 py-2 text-sm">{message}</p>
					<Button type="button" className="mt-6 w-full" onClick={() => navigate('/login')}>
						Sign in
					</Button>
				</>
			)}
			{status === 'error' && (
				<>
					<p className="bg-danger/10 text-danger mt-4 rounded-md px-3 py-2 text-sm">{message}</p>
					<Button
						type="button"
						variant="secondary"
						className="mt-6 w-full"
						onClick={() => navigate('/login')}
					>
						Back to sign in
					</Button>
				</>
			)}
		</AuthShell>
	);
}
