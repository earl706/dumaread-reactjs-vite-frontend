import { useSearchParams } from 'react-router-dom';

import { Button } from '../ui';

/** Default Settings sections for Dumas (Goals is app-specific). */
export const DEFAULT_SETTINGS_TABS = [
	{ id: 'shortcuts', label: 'Shortcuts', mobileOnly: true },
	{ id: 'account', label: 'Account' },
	{ id: 'security', label: 'Security' },
	{ id: 'goals', label: 'Goals' }
];

export function visibleSettingTabs(tabs, mobile) {
	return tabs.filter((tab) => !tab.mobileOnly || mobile);
}

export function resolveSettingTab(
	raw,
	tabs,
	mobile,
	{ desktopDefault = 'account', mobileDefault = 'shortcuts' } = {}
) {
	const allowed = visibleSettingTabs(tabs, mobile);
	if (allowed.some((tab) => tab.id === raw)) return raw;
	return mobile ? mobileDefault : desktopDefault;
}

/**
 * URL-synced Settings tab state (`?tab=`).
 * Pass `mobile` so mobile-only tabs (e.g. Shortcuts) appear only on phone shells.
 */
export function useSettingsTabs({
	mobile = false,
	tabs = DEFAULT_SETTINGS_TABS,
	param = 'tab',
	desktopDefault = 'account',
	mobileDefault = 'shortcuts'
} = {}) {
	const [searchParams, setSearchParams] = useSearchParams();
	const visible = visibleSettingTabs(tabs, mobile);
	const activeTab = resolveSettingTab(searchParams.get(param), tabs, mobile, {
		desktopDefault,
		mobileDefault
	});

	const setActiveTab = (id) => {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.set(param, id);
				return next;
			},
			{ replace: true }
		);
	};

	return { tabs: visible, activeTab, setActiveTab };
}

export function SettingsTabBar({
	tabs,
	active,
	onChange,
	wrap = false,
	'aria-label': ariaLabel = 'Settings sections'
}) {
	return (
		<div className={wrap ? undefined : 'overflow-x-auto'}>
			<div
				className={
					'border-line bg-surface-2 rounded-md border p-0.5 ' +
					(wrap ? 'flex flex-wrap gap-0.5' : 'inline-flex')
				}
				role="tablist"
				aria-label={ariaLabel}
			>
				{tabs.map((tab) => {
					const selected = active === tab.id;
					return (
						<Button
							key={tab.id}
							type="button"
							size="sm"
							variant={selected ? 'primary' : 'ghost'}
							className="h-8 shrink-0 whitespace-nowrap"
							role="tab"
							id={`settings-tab-${tab.id}`}
							aria-selected={selected}
							aria-controls={`settings-panel-${tab.id}`}
							onClick={() => onChange(tab.id)}
						>
							{tab.label}
						</Button>
					);
				})}
			</div>
		</div>
	);
}

/**
 * Unmounts inactive panels so password fields in one section are not in the DOM
 * while another section is open (avoids browser treating edits as a login form).
 */
export function SettingsPanel({ id, active, children }) {
	const selected = active === id;
	return (
		<div
			role="tabpanel"
			id={`settings-panel-${id}`}
			aria-labelledby={`settings-tab-${id}`}
			hidden={!selected}
		>
			{selected ? children : null}
		</div>
	);
}
