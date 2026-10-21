import { NavLink, useLocation } from 'react-router-dom';

import { cn } from '../../lib/format';
import { mobileTabs } from './navItems';

function isTabActive(tab, pathname) {
	if (tab.end) return pathname === tab.to;
	return pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}

/**
 * Bottom tabs for the iOS shell. Safe-area padding sits inside the bar.
 * Customize labels and routes in navItems.js (mobileTabs).
 */
export function MobileTabBar() {
	const location = useLocation();

	return (
		<nav
			className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
			aria-label="Primary"
		>
			<ul className="grid h-16 grid-cols-3 items-stretch px-1">
				{mobileTabs.map((tab) => {
					const Icon = tab.icon;
					const active = isTabActive(tab, location.pathname);
					return (
						<li key={tab.to} className="flex h-full items-center justify-center">
							<NavLink
								to={tab.to}
								end={tab.end}
								className={cn(
									'flex h-full min-w-[3.5rem] cursor-pointer flex-col items-center justify-center gap-0.5 px-1',
									active ? 'text-primary' : 'text-muted'
								)}
							>
								<Icon size={22} strokeWidth={active ? 2.4 : 2} />
								<span className="text-[10px] font-medium">{tab.label}</span>
							</NavLink>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
