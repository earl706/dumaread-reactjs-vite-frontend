import { useMemo, useState } from 'react';
import { eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';

import { cn, formatDate } from '../../lib/format';

/** Default 5-step primary intensity scale (theme-aware). */
export const DEFAULT_LEVEL_BG = [
	'color-mix(in srgb, var(--fg) 6%, var(--surface))',
	'color-mix(in srgb, var(--primary) 28%, var(--surface))',
	'color-mix(in srgb, var(--primary) 48%, var(--surface))',
	'color-mix(in srgb, var(--primary) 72%, var(--surface))',
	'var(--primary)'
];

export function defaultGetLevel(intensity, max) {
	if (intensity <= 0) return 0;
	const ratio = intensity / (max || 1);
	if (ratio > 0.75) return 4;
	if (ratio > 0.5) return 3;
	if (ratio > 0.25) return 2;
	return 1;
}

function buildHeatmapWeeks(timeline, weekStartsOn = 0) {
	if (!timeline?.length) return { weeks: [] };

	const byDate = new Map(timeline.map((d) => [d.date, d]));
	const first = parseISO(timeline[0].date);
	const last = parseISO(timeline[timeline.length - 1].date);
	const gridStart = startOfWeek(first, { weekStartsOn });
	const gridEnd = endOfWeek(last, { weekStartsOn });
	const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

	const weeks = [];
	for (let i = 0; i < allDays.length; i += 7) {
		weeks.push(
			allDays.slice(i, i + 7).map((d) => {
				const key = format(d, 'yyyy-MM-dd');
				return byDate.get(key) || { date: key, intensity: 0, outOfRange: true };
			})
		);
	}

	return { weeks };
}

function buildCompactWeeks(timeline, weekCount = 7, weekStartsOn = 0) {
	const { weeks } = buildHeatmapWeeks(timeline, weekStartsOn);
	const recent = weeks.slice(-weekCount);
	while (recent.length < weekCount) {
		recent.unshift(Array.from({ length: 7 }, () => ({ date: '', intensity: 0, outOfRange: true })));
	}
	return recent;
}

function monthLabels(weeks) {
	const labels = [];
	let lastMonth = '';
	weeks.forEach((week, col) => {
		const day = week.find((d) => d.date && !d.outOfRange) || week.find((d) => d.date);
		if (!day?.date) return;
		const month = formatDate(day.date, 'MMM');
		if (month !== lastMonth) {
			labels.push({ col, month });
			lastMonth = month;
		}
	});
	return labels;
}

function daySummary(day, emptyLabel) {
	if (!day?.date || day.outOfRange) return null;
	const when = formatDate(day.date, 'EEE, MMM d');
	if (day.label) return `${when} · ${day.label}`;
	if (day.meta != null && day.meta !== '') return `${when} · ${day.meta}`;
	if (day.intensity > 0) return `${when} · ${day.intensity} activity`;
	return `${when} · ${emptyLabel}`;
}

function resolveColors(colors) {
	return colors?.length ? colors : DEFAULT_LEVEL_BG;
}

function resolveGetLevel(getLevel) {
	return typeof getLevel === 'function' ? getLevel : defaultGetLevel;
}

function HeatmapFooter({ status, colors }) {
	const scale = resolveColors(colors);
	return (
		<div className="flex w-full shrink-0 items-center justify-between gap-2">
			<p className="text-muted min-w-0 flex-1 truncate text-[10px] leading-tight">{status}</p>
			<div className="text-muted flex shrink-0 items-center gap-1 text-[9px]">
				<span className="hidden sm:inline">Less</span>
				<div className="flex gap-[2px]">
					{scale.map((bg, i) => (
						<span key={i} className="h-2 w-2 rounded-[2px]" style={{ background: bg }} />
					))}
				</div>
				<span className="hidden sm:inline">More</span>
			</div>
		</div>
	);
}

function CellButton({ day, col, row, lvl, active, isFocus, colors, onFocusDate, onClearFocus }) {
	const scale = resolveColors(colors);
	return (
		<button
			type="button"
			disabled={!active}
			className={cn(
				'min-h-0 min-w-0 rounded-[3px] transition-[box-shadow,background-color] duration-150',
				active
					? 'hover:ring-primary/50 focus-visible:ring-primary cursor-pointer hover:ring-1 focus-visible:ring-1 focus-visible:outline-none'
					: 'pointer-events-none opacity-25',
				isFocus && 'ring-primary ring-1'
			)}
			style={{ background: day.outOfRange ? 'transparent' : scale[lvl] }}
			aria-label={
				day.date ? `${formatDate(day.date, 'MMM d')}: ${day.intensity || 0} activity` : undefined
			}
			onMouseEnter={() => active && onFocusDate(day.date)}
			onMouseLeave={onClearFocus}
			onFocus={() => active && onFocusDate(day.date)}
			onBlur={onClearFocus}
			data-col={col}
			data-row={row}
		/>
	);
}

/**
 * Compact contribution-style activity grid.
 * Weeks flex to the container width so the tile does not need horizontal scroll.
 *
 * Day shape: `{ date: 'YYYY-MM-DD', intensity: number, label?: string, meta?: string }`
 */
export function CompactActivityTile({
	timeline = [],
	weeks = 7,
	className = '',
	emptyLabel = 'No activity',
	colors,
	getLevel,
	weekStartsOn = 0
}) {
	const [focus, setFocus] = useState(null);
	const levelOf = resolveGetLevel(getLevel);
	const gridWeeks = useMemo(
		() => buildCompactWeeks(timeline, weeks, weekStartsOn),
		[timeline, weeks, weekStartsOn]
	);
	const maxIntensity = useMemo(
		() => Math.max(1, ...timeline.map((d) => d.intensity || 0)),
		[timeline]
	);
	const labels = useMemo(() => monthLabels(gridWeeks), [gridWeeks]);
	const activeCount = useMemo(
		() => timeline.filter((d) => d.intensity > 0 || d.label).length,
		[timeline]
	);

	if (!timeline.length) {
		return (
			<div className={cn('text-muted flex items-center justify-center text-xs', className)}>
				No activity yet
			</div>
		);
	}

	const focusDay = focus ? gridWeeks.flat().find((d) => d.date === focus) : null;
	const status =
		daySummary(focusDay, emptyLabel) ||
		`${activeCount} active day${activeCount === 1 ? '' : 's'} · last ${weeks} weeks`;

	return (
		<div
			className={cn(
				'flex max-h-full min-h-0 w-full flex-col items-stretch justify-center gap-2',
				className
			)}
		>
			<div
				className="flex w-full shrink-0 flex-col gap-1.5"
				aria-label={`Activity over the last ${weeks} weeks`}
			>
				<div
					className="grid w-full"
					style={{
						gridAutoFlow: 'column',
						gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
						gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
						gap: 3,
						aspectRatio: `${weeks} / 7`
					}}
				>
					{gridWeeks.flatMap((week, col) =>
						week.map((day, row) => {
							const lvl = day.outOfRange ? 0 : levelOf(day.intensity || 0, maxIntensity);
							const active = !day.outOfRange && day.date;
							return (
								<CellButton
									key={`${col}-${row}`}
									day={day}
									col={col}
									row={row}
									lvl={lvl}
									active={active}
									isFocus={focus === day.date}
									colors={colors}
									onFocusDate={setFocus}
									onClearFocus={() => setFocus(null)}
								/>
							);
						})
					)}
				</div>
				<div className="relative h-3 w-full shrink-0 text-[9px] leading-none">
					{labels.map(({ col, month }) => (
						<span
							key={`${month}-${col}`}
							className="text-muted absolute top-0"
							style={{ left: `${(col / weeks) * 100}%` }}
						>
							{month}
						</span>
					))}
				</div>
			</div>
			<HeatmapFooter status={status} colors={colors} />
		</div>
	);
}

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

/**
 * Full-range GitHub-style activity heatmap (horizontal scroll when needed).
 * Pass a contiguous daily timeline (e.g. 365 days from GET /books/activity/).
 */
export function ActivityHeatmap({
	timeline = [],
	className = '',
	emptyLabel = 'No activity',
	colors,
	getLevel,
	weekStartsOn = 0,
	cellSize = 11,
	gap = 3
}) {
	const [focus, setFocus] = useState(null);
	const levelOf = resolveGetLevel(getLevel);
	const { weeks: gridWeeks } = useMemo(
		() => buildHeatmapWeeks(timeline, weekStartsOn),
		[timeline, weekStartsOn]
	);
	const maxIntensity = useMemo(
		() => Math.max(1, ...timeline.map((d) => d.intensity || 0)),
		[timeline]
	);
	const labels = useMemo(() => monthLabels(gridWeeks), [gridWeeks]);
	const activeCount = useMemo(
		() => timeline.filter((d) => d.intensity > 0 || d.label).length,
		[timeline]
	);
	const weekCount = gridWeeks.length || 1;

	if (!timeline.length) {
		return (
			<div className={cn('text-muted flex items-center justify-center text-xs', className)}>
				No activity yet
			</div>
		);
	}

	const focusDay = focus ? gridWeeks.flat().find((d) => d.date === focus) : null;
	const status =
		daySummary(focusDay, emptyLabel) ||
		`${activeCount} active day${activeCount === 1 ? '' : 's'} · ${timeline.length} days`;

	const colWidth = cellSize + gap;
	const gridWidth = weekCount * cellSize + Math.max(0, weekCount - 1) * gap;

	return (
		<div className={cn('flex w-full flex-col gap-2', className)}>
			<div className="overflow-x-auto" aria-label="Activity heatmap">
				<div className="inline-flex gap-2" style={{ minWidth: gridWidth + 28 }}>
					<div
						className="text-muted grid shrink-0 text-[9px] leading-none"
						style={{
							gridTemplateRows: `repeat(7, ${cellSize}px)`,
							gap,
							paddingTop: 14
						}}
					>
						{WEEKDAY_LABELS.map((label, i) => (
							<span key={i} className="flex items-center">
								{label}
							</span>
						))}
					</div>
					<div className="flex flex-col gap-1.5">
						<div
							className="relative h-3 w-full text-[9px] leading-none"
							style={{ width: gridWidth }}
						>
							{labels.map(({ col, month }) => (
								<span
									key={`${month}-${col}`}
									className="text-muted absolute top-0"
									style={{ left: col * colWidth }}
								>
									{month}
								</span>
							))}
						</div>
						<div
							className="grid"
							style={{
								gridAutoFlow: 'column',
								gridTemplateRows: `repeat(7, ${cellSize}px)`,
								gridTemplateColumns: `repeat(${weekCount}, ${cellSize}px)`,
								gap,
								width: gridWidth
							}}
						>
							{gridWeeks.flatMap((week, col) =>
								week.map((day, row) => {
									const lvl = day.outOfRange ? 0 : levelOf(day.intensity || 0, maxIntensity);
									const active = !day.outOfRange && day.date;
									return (
										<CellButton
											key={`${col}-${row}`}
											day={day}
											col={col}
											row={row}
											lvl={lvl}
											active={active}
											isFocus={focus === day.date}
											colors={colors}
											onFocusDate={setFocus}
											onClearFocus={() => setFocus(null)}
										/>
									);
								})
							)}
						</div>
					</div>
				</div>
			</div>
			<HeatmapFooter status={status} colors={colors} />
		</div>
	);
}
