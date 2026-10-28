import { Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { TimerEngine } from './components/layout/TimerEngine';
import { LoadingScreen, Toasts } from './components/ui';
import { publicRoutes, appRoutes, readerRoutes } from './pages/routes';
import { readingTimer } from './stores/readingTimer';

function ThemedSuspense({ children }) {
	return <Suspense fallback={<LoadingScreen />}>{children}</Suspense>;
}

export default function App() {
	const bootstrap = useAuthStore((s) => s.bootstrap);
	const authStatus = useAuthStore((s) => s.status);
	const initTheme = useThemeStore((s) => s.init);
	useEffect(() => {
		initTheme();
		bootstrap();
	}, [bootstrap, initTheme]);
	return (
		<QueryClientProvider client={queryClient}>
			<BrowserRouter>
				<ThemedSuspense>
					<Routes>
						{publicRoutes.map(({ path, Component }) => (
							<Route key={path} path={path} element={<Component />} />
						))}
						<Route
							element={
								<ProtectedRoute>
									<AppLayout />
								</ProtectedRoute>
							}
						>
							{appRoutes.map(({ path, Component }) => (
								<Route
									key={path || 'index'}
									index={path === '/'}
									path={path === '/' ? undefined : path}
									element={<Component />}
								/>
							))}
						</Route>
						<Route
							element={
								<ProtectedRoute>
									<Outlet />
								</ProtectedRoute>
							}
						>
							{readerRoutes.map(({ path, Component }) => (
								<Route key={path} path={path} element={<Component />} />
							))}
						</Route>
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
				</ThemedSuspense>
			</BrowserRouter>
			{authStatus === 'authenticated' && <TimerEngine timer={readingTimer} />}
			<Toasts />
		</QueryClientProvider>
	);
}
