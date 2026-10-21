import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { LoadingScreen } from '../components/ui';

export default function OAuthCallbackPage() {
	const navigate = useNavigate();
	const completeOAuth = useAuthStore((s) => s.completeOAuth);
	const [error, setError] = useState(null);

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const err = params.get('error');
		if (err) {
			setError(err);
			return;
		}
		const code = params.get('code');
		if (!code) {
			setError('missing_code');
			return;
		}
		completeOAuth(code)
			.then(() => {
				if (useAuthStore.getState().mfaRequired) navigate('/login', { replace: true });
				else navigate('/', { replace: true });
			})
			.catch(() => setError('exchange_failed'));
	}, [completeOAuth, navigate]);

	if (error) {
		return (
			<div className="bg-bg flex min-h-screen items-center justify-center p-6">
				<div className="text-center">
					<p className="text-danger mb-4">Sign-in failed ({error}).</p>
					<a href="/login" className="text-primary text-sm">
						Back to login
					</a>
				</div>
			</div>
		);
	}
	return <LoadingScreen />;
}
