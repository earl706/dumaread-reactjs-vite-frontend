import { isValidElement } from 'react';

import { cn } from '../../lib/format';
import { Button } from './Button';

export function Card({ className, as: Tag = 'div', ...props }) {
	return <Tag className={cn('border-line bg-surface rounded-md border', className)} {...props} />;
}

export function CardHeader({ className, title, subtitle, action, children }) {
	return (
		<div className={cn('flex items-start justify-between gap-3 p-5', className)}>
			<div className="min-w-0">
				{title && <h3 className="text-fg truncate font-semibold">{title}</h3>}
				{subtitle && <p className="text-muted mt-0.5 text-sm">{subtitle}</p>}
				{children}
			</div>
			{action}
		</div>
	);
}

export function CardBody({ className, ...props }) {
	return <div className={cn('p-5 pt-0', className)} {...props} />;
}

/** Compact chip for CoverCard overlays (icon + optional value). */
export function OverlayStat({ icon: Icon, value, label }) {
	return (
		<span
			title={label}
			aria-label={label}
			className="inline-flex items-center gap-0.5 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums backdrop-blur-sm"
		>
			{Icon ? <Icon size={12} strokeWidth={2} aria-hidden /> : null}
			{value != null ? <span>{value}</span> : null}
		</span>
	);
}

function asList(value) {
	if (value == null) return [];
	return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

function stop(e) {
	e.stopPropagation();
}

function CoverPrimaryAction({ action }) {
	if (!action) return null;
	if (isValidElement(action)) {
		return (
			<div className="absolute right-2 bottom-2 z-10" onClick={stop} onKeyDown={stop}>
				{action}
			</div>
		);
	}
	const Icon = action.icon;
	return (
		<Button
			size="icon"
			className={cn('absolute right-2 bottom-2 z-10 h-9 w-9 shadow-md', action.className)}
			onClick={(e) => {
				stop(e);
				action.onClick?.(e);
			}}
			title={action.label}
			aria-label={action.label}
		>
			{Icon ? <Icon size={16} /> : action.children}
		</Button>
	);
}

/**
 * Image-overlay resource tile for visual grids.
 *
 * Pass domain-specific icons, stats, hover actions, and an optional primary
 * CTA. Selection, accent color, and footer are optional.
 *
 * @example
 * <CoverCard
 *   title={item.title}
 *   subtitle={formatDate(item.created_at)}
 *   imageSrc={item.cover_url}
 *   fallbackIcon={Boxes}
 *   onOpen={() => navigate(`/items/${item.id}`)}
 *   stats={[{ icon: Tag, value: 3, label: '3 tags' }]}
 *   actions={[
 *     { icon: Pencil, label: 'Edit', onClick: () => openEdit(item) },
 *     { icon: Trash2, label: 'Delete', onClick: () => remove(item), tone: 'danger' },
 *   ]}
 *   primaryAction={{ icon: Play, label: 'Open', onClick: () => open(item) }}
 * />
 */
export function CoverCard({
	className,
	style,
	title,
	subtitle,
	imageSrc,
	fallbackIcon: FallbackIcon,
	fallback,
	accentColor,
	selected = false,
	onOpen,
	openLabel,
	stats,
	select,
	actions,
	primaryAction,
	footer,
	footerClassName,
	children,
	coverClassName,
	...props
}) {
	const statList = asList(stats);
	const actionList = asList(actions);
	const below = footer ?? children;
	const openable = typeof onOpen === 'function';
	const showMeta = Boolean(title || subtitle || statList.length);
	const coverLabel = openLabel || (title ? `Open ${title}` : 'Open');

	const onCoverKeyDown = (e) => {
		if (!openable) return;
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onOpen();
		}
	};

	return (
		<Card
			className={cn(
				'group flex flex-col overflow-hidden transition hover:shadow-md',
				accentColor && 'border-r-[3px]',
				selected && 'ring-primary/40 ring-2',
				className
			)}
			style={accentColor ? { borderRightColor: accentColor, ...style } : style}
			{...props}
		>
			<div
				role={openable ? 'link' : undefined}
				tabIndex={openable ? 0 : undefined}
				className={cn(
					'relative outline-none',
					coverClassName || 'h-40',
					openable && 'cursor-pointer'
				)}
				onClick={openable ? onOpen : undefined}
				onKeyDown={openable ? onCoverKeyDown : undefined}
				aria-label={openable ? coverLabel : undefined}
			>
				{imageSrc ? (
					<img src={imageSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
				) : fallback ? (
					<div className="absolute inset-0">{fallback}</div>
				) : (
					<div
						className="bg-surface-2 text-muted absolute inset-0 flex items-center justify-center"
						aria-hidden
					>
						{FallbackIcon ? <FallbackIcon size={28} strokeWidth={1.5} /> : null}
					</div>
				)}
				<div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-linear-to-b from-black/85 via-black/50 to-transparent" />
				<div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />

				{select ? (
					<label
						className="absolute top-2 left-2 z-20 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-black/50 backdrop-blur-sm"
						onClick={stop}
						onKeyDown={stop}
					>
						<input
							type="checkbox"
							checked={Boolean(select.checked)}
							onChange={select.onChange}
							className="accent-primary"
							aria-label={select.label || (select.checked ? 'Deselect' : 'Select')}
						/>
					</label>
				) : null}

				{showMeta ? (
					<div
						className={cn(
							'absolute top-2 z-10 min-w-0 text-white',
							select ? 'right-2 left-11' : 'inset-x-2'
						)}
					>
						{title ? (
							<h3 className="line-clamp-3 text-sm font-semibold leading-snug break-words drop-shadow-sm">
								{title}
							</h3>
						) : null}
						{subtitle ? (
							<p className="text-[10px] text-white/80 drop-shadow-sm">{subtitle}</p>
						) : null}
						{statList.length > 0 ? (
							<div className="mt-1.5 flex flex-wrap gap-1">
								{statList.map((stat, i) =>
									isValidElement(stat) ? (
										<span key={stat.key ?? i}>{stat}</span>
									) : (
										<OverlayStat
											key={stat.label ?? i}
											icon={stat.icon}
											value={stat.value}
											label={stat.label}
										/>
									)
								)}
							</div>
						) : null}
					</div>
				) : null}

				{actionList.length > 0 ? (
					<div
						className={cn(
							'absolute bottom-2 left-2 z-10 flex items-center gap-0.5 rounded-md bg-black/45 p-0.5 backdrop-blur-sm transition-opacity',
							'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
						)}
						onClick={stop}
						onKeyDown={stop}
					>
						{actionList.map((action, i) => {
							if (isValidElement(action)) {
								return <span key={action.key ?? i}>{action}</span>;
							}
							const { icon: Icon, label, onClick, tone, className: actionClass, ...rest } = action;
							return (
								<Button
									key={label ?? i}
									variant="ghost"
									size="icon"
									className={cn(
										'h-8 w-8 text-white hover:bg-white/15 hover:text-white',
										tone === 'danger' && 'text-danger hover:text-danger',
										actionClass
									)}
									onClick={onClick}
									title={label}
									aria-label={label}
									{...rest}
								>
									{Icon ? <Icon size={14} /> : null}
								</Button>
							);
						})}
					</div>
				) : null}

				<CoverPrimaryAction action={primaryAction} />
			</div>

			{below ? <div className={cn('p-1', footerClassName)}>{below}</div> : null}
		</Card>
	);
}
