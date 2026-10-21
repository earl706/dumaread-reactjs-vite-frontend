import { BookOpen, LayoutDashboard, Settings } from 'lucide-react';

/** Primary navigation, grouped for the sidebar. `end` marks exact-match links. */
export const navGroups = [
	{
		label: 'Library',
		items: [
			{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
			{ to: '/library', label: 'Library', icon: BookOpen }
		]
	}
];

/** iOS shell bottom tabs. Customize labels/routes; keep `end` on the home tab. */
export const mobileTabs = [
	{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
	{ to: '/library', label: 'Library', icon: BookOpen },
	{ to: '/settings', label: 'Settings', icon: Settings }
];
