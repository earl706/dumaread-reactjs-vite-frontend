import { useNavigate } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';

import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar, Button } from '../ui';
import { ThemeToggle } from './ThemeToggle';

export function Topbar() {
	const navigate = useNavigate();
	const user = useAuthStore((s) => s.user);
	const { toggleSidebar, openPalette } = useUIStore();

	return (
		<header className="border-line bg-surface/80 sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4 backdrop-blur">
			<Button
				variant="ghost"
				size="icon"
				className="lg:hidden"
				onClick={toggleSidebar}
				aria-label="Open navigation menu"
			>
				<Menu size={20} />
			</Button>

			<button
				onClick={openPalette}
				className="border-line bg-surface-2 text-muted hover:border-primary/40 flex h-10 flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors sm:max-w-xs"
			>
				<Search size={16} />
				<span>Search…</span>
				<kbd className="border-line ml-auto hidden rounded-sm border px-1.5 text-xs sm:inline">
					⌘K
				</kbd>
			</button>

			<div className="flex flex-1 items-center justify-end gap-1">
				<ThemeToggle />
				<button
					onClick={() => navigate('/settings')}
					className="focus-visible:outline-primary ml-1 cursor-pointer rounded-full focus-visible:outline-2"
					aria-label="Account settings"
				>
					<Avatar name={user?.full_name || user?.email} src={user?.avatar_url} size={34} />
				</button>
			</div>
		</header>
	);
}
