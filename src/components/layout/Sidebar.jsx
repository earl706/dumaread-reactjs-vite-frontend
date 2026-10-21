import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PanelLeft, Zap } from 'lucide-react';

import { cn } from '../../lib/format';
import { useUIStore } from '../../stores/uiStore';
import { navGroups } from './navItems';

function IconWell({ collapsed, active = false, children }) {
	return (
		<span
			className={cn(
				'relative flex shrink-0 items-center justify-center',
				collapsed ? 'size-10' : 'size-9'
			)}
		>
			{active ? (
				<motion.span
					layoutId="nav-active"
					className="bg-primary/12 absolute inset-0 rounded-lg"
					transition={{ type: 'spring', stiffness: 400, damping: 32 }}
				/>
			) : (
				<span className="bg-surface-2 absolute inset-0 rounded-lg opacity-0 transition-opacity group-hover:opacity-100" />
			)}
			{children}
		</span>
	);
}

function NavItem({ to, label, icon: Icon, end, collapsed }) {
	const closeSidebar = useUIStore((s) => s.closeSidebar);
	return (
		<NavLink
			to={to}
			end={end}
			title={collapsed ? label : undefined}
			onClick={closeSidebar}
			className={({ isActive }) =>
				cn(
					'group flex cursor-pointer font-medium transition-colors',
					collapsed
						? 'flex-col items-center gap-1 px-1 py-1 text-[11px] leading-tight'
						: 'items-center gap-3 rounded-md px-2 py-1 text-sm',
					isActive ? 'text-fg' : 'text-muted hover:text-fg'
				)
			}
		>
			{({ isActive }) => (
				<>
					<IconWell collapsed={collapsed} active={isActive}>
						<Icon
							size={collapsed ? 20 : 18}
							strokeWidth={1.75}
							className={cn('relative z-10', isActive && 'text-primary')}
						/>
					</IconWell>
					<span className={cn(collapsed && 'max-w-full truncate px-0.5 text-center')}>{label}</span>
				</>
			)}
		</NavLink>
	);
}

function CollapseToggle({ collapsed }) {
	const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);
	return (
		<button
			type="button"
			onClick={toggleSidebarCollapsed}
			className={cn(
				'group text-muted hover:text-fg flex cursor-pointer items-center font-medium transition-colors',
				collapsed ? 'flex-col justify-center px-1 py-1' : 'gap-3 rounded-md px-2 py-1 text-sm'
			)}
			aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			aria-expanded={!collapsed}
			title={collapsed ? 'Expand' : 'Collapse'}
		>
			<IconWell collapsed={collapsed}>
				<PanelLeft size={collapsed ? 20 : 18} strokeWidth={1.75} className="relative z-10" />
			</IconWell>
			{!collapsed && <span>Collapse</span>}
		</button>
	);
}

function AppMark({ size = 36, iconSize = 18 }) {
	return (
		<div
			className="bg-primary text-primary-fg flex shrink-0 items-center justify-center rounded-sm"
			style={{ width: size, height: size }}
			aria-hidden
		>
			<Zap size={iconSize} />
		</div>
	);
}

function SidebarContent({ collapsed = false, showCollapseToggle = false }) {
	return (
		<div className={cn('flex h-full flex-col', collapsed ? 'px-2 py-4' : 'p-4')}>
			<div className={cn('flex flex-col gap-2', collapsed && 'items-center')}>
				<div className={cn('flex items-center pt-1', collapsed ? 'justify-center' : 'gap-2 px-2')}>
					<AppMark size={36} iconSize={18} />
					{!collapsed && <span className="text-fg text-lg font-bold tracking-tight">DumaRead</span>}
				</div>
				{showCollapseToggle && <CollapseToggle collapsed={collapsed} />}
			</div>

			<nav
				className={cn('mt-4 flex-1 overflow-y-auto', collapsed ? 'space-y-3' : 'space-y-6')}
				aria-label="Primary"
			>
				{navGroups.map((group) => (
					<div key={group.label}>
						{!collapsed && (
							<p className="text-muted px-3 pb-1.5 text-xs font-semibold tracking-wider uppercase">
								{group.label}
							</p>
						)}
						<div className="space-y-0.5">
							{group.items.map((item) => (
								<NavItem key={item.to} {...item} collapsed={collapsed} />
							))}
						</div>
					</div>
				))}
			</nav>

			{!collapsed && <p className="text-muted mt-auto px-3 text-xs">DumaRead</p>}
		</div>
	);
}

/** Responsive sidebar: static rail on desktop (expandable), slide-over on mobile. */
export function Sidebar() {
	const { sidebarOpen, closeSidebar, sidebarCollapsed } = useUIStore();
	return (
		<>
			<aside
				className={cn(
					'border-line bg-surface hidden shrink-0 border-r transition-[width] duration-200 ease-out lg:block',
					sidebarCollapsed ? 'w-24' : 'w-64'
				)}
			>
				<SidebarContent collapsed={sidebarCollapsed} showCollapseToggle />
			</aside>

			{sidebarOpen && (
				<div className="fixed inset-0 z-40 lg:hidden">
					<div
						className="absolute inset-0 cursor-pointer bg-black/50"
						onClick={closeSidebar}
						aria-hidden="true"
					/>
					<motion.aside
						initial={{ x: -280 }}
						animate={{ x: 0 }}
						exit={{ x: -280 }}
						className="border-line bg-surface absolute inset-y-0 left-0 w-64 border-r"
					>
						<SidebarContent collapsed={false} />
					</motion.aside>
				</div>
			)}
		</>
	);
}
