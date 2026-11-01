import { GOAL_PERIODS } from '../../lib/readingGoals';
import { Input } from '../ui';

/** Shared daily / weekly / monthly minute inputs (blank = unset). */
export function ReadingGoalsFields({ form, onChange, idPrefix = 'goal' }) {
	return (
		<div className="space-y-3">
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
			<p className="text-muted text-xs">Leave a field blank to clear that period’s goal.</p>
		</div>
	);
}
