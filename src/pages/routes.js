import { lazy } from 'react';

export const publicRoutes = [
	{
		path: '/login',
		Component: lazy(() => import('./Auth').then((m) => ({ default: m.LoginPage })))
	},
	{
		path: '/register',
		Component: lazy(() => import('./Auth').then((m) => ({ default: m.RegisterPage })))
	},
	{
		path: '/oauth/callback',
		Component: lazy(() => import('./OAuthCallback'))
	},
	{
		path: '/check-email',
		Component: lazy(() =>
			import('./EmailVerification').then((m) => ({ default: m.CheckEmailPage }))
		)
	},
	{
		path: '/verify-email',
		Component: lazy(() =>
			import('./EmailVerification').then((m) => ({ default: m.VerifyEmailPage }))
		)
	}
];

export const appRoutes = [
	{ path: '/', Component: lazy(() => import('./Dashboard')) },
	{ path: 'library', Component: lazy(() => import('./Books')) },
	{ path: 'settings', Component: lazy(() => import('./Settings')) }
];

export const readerRoutes = [{ path: 'books/:id/read', Component: lazy(() => import('./Reader')) }];
