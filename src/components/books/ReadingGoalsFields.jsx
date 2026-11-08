import { useState } from 'react';
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';

import { cn, formatDurationSeconds } from '../../lib/format';
import {
	DEFAULT_GOAL_CALIBRATE_MULTIPLIERS,
	GOAL_PERIODS,
	calibrateGoalForm
} from '../../lib/readingGoals';
import { Button, Input } from '../ui';

const PERIOD_ICONS = {
	daily: Calendar,
	weekly: CalendarDays,
	monthly: CalendarRange
};

function formatLogged(entry) {
	if (entry?.seconds != null) return formatDurationSeconds(entry.seconds);
	const mins = Number(entry?.minutes);
	if (!Number.isFinite(mins) || mins <= 0) return '0s';
	return formatDurationSeconds(Math.round(mins * 60));
}

function PeriodChoice({ selected, icon: Icon, label, onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			aria-pressed={selected}
			title={label}
			className={cn(
				'inline-flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1 transition-colors duration-150',
				'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2',
				selected ? 'text-primary' : 'text-muted hover:text-fg'
			)}
		>
			<Icon size={16} aria-hidden />
			<span className="max-w-full truncate text-[10px] font-medium tracking-wide">{label}</span>
		</button>
	);
}

/** Shared daily / weekly / monthly minute inputs (blank = unset). */
export function ReadingGoalsFields({
	form,
	onChange,
	onReplace,
	progress,
	idPrefix = 'goal',
	multipliers = DEFAULT_GOAL_CALIBRATE_MULTIPLIERS
}) {
	const [sourceKey, setSourceKey] = useState('daily');
	const weeklyMult = Number(multipliers?.weekly) || DEFAULT_GOAL_CALIBRATE_MULTIPLIERS.weekly;
	const monthlyMult = Number(multipliers?.monthly) || DEFAULT_GOAL_CALIBRATE_MULTIPLIERS.monthly;

	const applyCalibration = () => {
		const next = calibrateGoalForm(form, sourceKey, { weekly: weeklyMult, monthly: monthlyMult });
		if (onReplace) {
			onReplace(next);
			return;
		}
		for (const { field } of GOAL_PERIODS) {
			if (next[field] !== form[field]) onChange(field, next[field]);
		}
	};

	return (
		<div className="space-y-3">
			{progress && (
				<div className="border-line bg-surface-2 space-y-1.5 rounded-md border p-3">
					<table className="w-full table-fixed border-collapse text-center text-sm">
						<thead>
							<tr>
								{GOAL_PERIODS.map(({ key, label }) => (
									<th key={key} scope="col" className="text-muted px-1 pb-1 font-medium">
										{label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							<tr>
								{GOAL_PERIODS.map(({ key }) => (
									<td key={key} className="text-fg px-1 pt-0.5 font-medium tabular-nums">
										{formatLogged(progress[key])}
									</td>
								))}
							</tr>
						</tbody>
					</table>
				</div>
			)}

			{GOAL_PERIODS.map(({ field, label, hint }) => (
				<div key={field} className="space-y-1">
					<Input
						id={`${idPrefix}-${field}`}
						label={`${label} (minutes)`}
						type="number"
						min={1}
						inputMode="numeric"
						placeholder="Optional"
						value={form[field]}
						onChange={(e) => onChange(field, e.target.value)}
					/>
					<p className="text-muted text-xs">{hint}</p>
				</div>
			))}

			<div className="border-line space-y-2 border-t pt-3">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
					<div className="min-w-0 flex-1 space-y-1.5">
						<p className="text-fg text-sm font-medium">Calibrate from</p>
						<div className="flex gap-1.5" role="group" aria-label="Calibrate from">
							{GOAL_PERIODS.map(({ key, label }) => {
								const Icon = PERIOD_ICONS[key] || Calendar;
								return (
									<PeriodChoice
										key={key}
										icon={Icon}
										label={label}
										selected={sourceKey === key}
										onClick={() => setSourceKey(key)}
									/>
								);
							})}
						</div>
					</div>
					<Button
						type="button"
						variant="secondary"
						className="sm:shrink-0"
						onClick={applyCalibration}
					>
						Apply
					</Button>
				</div>
			</div>
		</div>
	);
}
