import { cn } from '../../lib/format';

const TONE_COLOR = {
	primary: 'var(--primary)',
	success: 'var(--success)',
	warning: 'var(--warning)',
	danger: 'var(--danger)',
	accent: 'var(--accent)'
};

export function ProgressBar({ value = 0, tone = 'primary', className, showLabel = false }) {
	const pct = Math.max(0, Math.min(100, value));
	return (
		<div className={cn('flex items-center gap-2', className)}>
			<div
				className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full"
				role="progressbar"
				aria-valuenow={Math.round(pct)}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				<div
					className="h-full rounded-full transition-all duration-500"
					style={{ width: `${pct}%`, background: TONE_COLOR[tone] }}
				/>
			</div>
			{showLabel && <span className="text-muted w-9 text-right text-xs">{Math.round(pct)}%</span>}
		</div>
	);
}

/** Circular progress ring used for health/momentum stats. */
export function ProgressRing({ value = 0, size = 64, stroke = 6, tone = 'primary', label }) {
	const pct = Math.max(0, Math.min(100, value));
	const radius = (size - stroke) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (pct / 100) * circumference;
	return (
		<div
			className="relative inline-flex items-center justify-center"
			style={{ width: size, height: size }}
		>
			<svg width={size} height={size} className="-rotate-90">
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--surface-2)"
					strokeWidth={stroke}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={TONE_COLOR[tone]}
					strokeWidth={stroke}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					style={{ transition: 'stroke-dashoffset 0.6s ease' }}
				/>
			</svg>
			<span className="text-fg absolute text-sm font-semibold">
				{label ?? `${Math.round(pct)}`}
			</span>
		</div>
	);
}

const PERIOD_ORDER = [
	{ key: 'daily', tone: 'success', label: 'Daily' },
	{ key: 'weekly', tone: 'primary', label: 'Weekly' },
	{ key: 'monthly', tone: 'accent', label: 'Monthly' }
];

/**
 * Three concentric rings: inner daily, middle weekly, outer monthly.
 * Unset periods render as empty ghost tracks; set periods fill by percent.
 */
export function GoalProgressRings({
	progress,
	size = 40,
	stroke = 3,
	gap = 2.5,
	className,
	trackOpacity = 0.55,
	/** `overlay` = light tracks on dark cover; `surface` = muted tracks on chrome */
	variant = 'overlay',
	title
}) {
	const cx = size / 2;
	const cy = size / 2;
	const outerR = (size - stroke) / 2;
	const middleR = outerR - stroke - gap;
	const innerR = middleR - stroke - gap;
	const radii = { monthly: outerR, weekly: middleR, daily: innerR };
	const trackStroke = variant === 'surface' ? 'var(--surface-2)' : 'rgba(255,255,255,0.55)';

	const ariaParts = PERIOD_ORDER.map(({ key, label }) => {
		const entry = progress?.[key];
		if (entry?.goal_minutes == null) return `${label}: no goal`;
		const pct = entry.percent ?? 0;
		return `${label}: ${entry.minutes ?? 0}/${entry.goal_minutes} min (${Math.round(pct)}%)`;
	});

	return (
		<div
			className={cn('relative inline-flex items-center justify-center', className)}
			style={{ width: size, height: size }}
			role="img"
			aria-label={title || ariaParts.join('; ')}
			title={title || ariaParts.join('\n')}
		>
			<svg width={size} height={size} className="-rotate-90" aria-hidden>
				{PERIOD_ORDER.map(({ key, tone }) => {
					const r = radii[key];
					const entry = progress?.[key];
					const hasGoal = entry?.goal_minutes != null;
					const pct = hasGoal ? Math.max(0, Math.min(100, Number(entry.percent) || 0)) : 0;
					const circumference = 2 * Math.PI * r;
					const offset = circumference - (pct / 100) * circumference;
					return (
						<g key={key}>
							<circle
								cx={cx}
								cy={cy}
								r={r}
								fill="none"
								stroke={trackStroke}
								strokeWidth={stroke}
								opacity={trackOpacity}
							/>
							{hasGoal ? (
								<circle
									cx={cx}
									cy={cy}
									r={r}
									fill="none"
									stroke={TONE_COLOR[tone]}
									strokeWidth={stroke}
									strokeDasharray={circumference}
									strokeDashoffset={offset}
									strokeLinecap="round"
									style={{ transition: 'stroke-dashoffset 0.6s ease' }}
								/>
							) : null}
						</g>
					);
				})}
			</svg>
		</div>
	);
}
