import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { isMobileApp } from '../../lib/desktop';
import { MfaPromptModal, MfaSetupModal } from '../auth/MfaModals';
import { LoadingScreen } from '../ui';
import { useAuthStore } from '../../stores/authStore';
import { CommandPalette } from './CommandPalette';
import { MobileTabBar } from './MobileTabBar';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/** Authenticated app shell: sidebar + topbar on web; bottom tabs on iOS. */
export function AppLayout() {
	const mobile = isMobileApp();
	const showMfaPrompt = useAuthStore((s) => s.user?.show_mfa_prompt);
	const [promptOpen, setPromptOpen] = useState(Boolean(showMfaPrompt));
	const [setupOpen, setSetupOpen] = useState(false);

	return (
		<div className="bg-bg flex h-full overflow-hidden">
			{!mobile && <Sidebar />}
			<div className="flex min-w-0 flex-1 flex-col">
				{!mobile && <Topbar />}
				<main
					className={
						mobile
							? 'flex-1 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
							: 'flex-1 overflow-y-auto'
					}
					id="main-content"
				>
					<div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-4">
						<Suspense fallback={<LoadingScreen />}>
							<Outlet />
						</Suspense>
					</div>
				</main>
			</div>
			{mobile && <MobileTabBar />}
			<CommandPalette />
			<MfaPromptModal
				open={promptOpen && showMfaPrompt}
				onClose={() => {
					setPromptOpen(false);
					setSetupOpen(true);
				}}
			/>
			<MfaSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} />
		</div>
	);
}
